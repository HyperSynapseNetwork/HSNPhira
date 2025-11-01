import sqlite3
import requests
import time
import json
from datetime import datetime, timedelta
from flask import Flask, jsonify, request
from apscheduler.schedulers.background import BackgroundScheduler
import threading
import sys
import os
import math
from collections import deque

app = Flask(__name__)

# ================ 全局配置 ================
INTERVAL = 60 * 60  # 游玩记录获取间隔（秒）
CHART_LIST_UPDATE_INTERVAL = 60 * 60 * 24  # 谱面列表更新间隔（秒）
PER_PAGE = 50     # 每次获取谱面数量
ALL_MODE = True   # 是否获取所有谱面
API_BASE = "https://phira.5wyxi.com"
DB_NAME = "phira_data.db"
# ========================================

# 全局状态
last_chart_list_update = None
last_record_update = None
cached_charts = []  # 暂存的谱面列表
chart_list_lock = threading.Lock()  # 谱面列表锁
update_queue = deque()  # 更新队列
update_thread = None
update_thread_running = True
update_interval = 10  # 每个谱面更新间隔（秒）

# 初始化数据库
def init_db():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS chart_counts (
                 id INTEGER PRIMARY KEY AUTOINCREMENT,
                 chart_id INTEGER NOT NULL,
                 count INTEGER NOT NULL,
                 timestamp DATETIME NOT NULL,
                 UNIQUE(chart_id, timestamp)
              )''')
    conn.commit()
    conn.close()

# 获取谱面列表
def fetch_charts(page_size=30, page=1):
    url = f"{API_BASE}/chart?pageNum={page_size}&page={page}&order=-updated"
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"获取谱面列表失败: {e}")
        return None

# 获取所有谱面列表
def fetch_all_charts_list():
    global last_chart_list_update, cached_charts

    # 获取总谱面数
    data = fetch_charts(page_size=1, page=1)
    if not data:
        return []

    total_count = data.get("count", 0)
    charts = []
    page_size = 30
    total_pages = (total_count + page_size - 1) // page_size

    for page in range(1, total_pages + 1):
        data = fetch_charts(page_size=page_size, page=page)
        if not data or not data.get("results"):
            break
        charts.extend(data["results"])

    # 更新缓存
    with chart_list_lock:
        cached_charts = charts
        last_chart_list_update = datetime.utcnow().isoformat()

    print(f"谱面列表更新完成，共获取 {len(charts)} 个谱面")
    return charts

# 获取定量谱面列表
def fetch_limited_charts_list():
    global last_chart_list_update, cached_charts

    page_size = 30
    pages_needed = (PER_PAGE + page_size - 1) // page_size
    charts = []

    for page in range(1, pages_needed + 1):
        data = fetch_charts(page_size=page_size, page=page)
        if not data or not data.get("results"):
            break
        charts.extend(data["results"])
        if len(charts) >= PER_PAGE:
            charts = charts[:PER_PAGE]
            break

    # 更新缓存
    with chart_list_lock:
        cached_charts = charts
        last_chart_list_update = datetime.utcnow().isoformat()

    print(f"谱面列表更新完成，共获取 {len(charts)} 个谱面")
    return charts

# 获取谱面游玩记录数量
def fetch_chart_count(chart_id):
    url = f"{API_BASE}/record/query/{chart_id}?pageNum=30&includePlayer=true&best=true&page=1&std=false"
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        return response.json().get("count", 0)
    except Exception as e:
        print(f"获取谱面 {chart_id} 游玩记录失败: {e}")
        return 0

# 存储数据到数据库
def store_chart_data(chart_id, count, timestamp):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    try:
        c.execute("INSERT OR IGNORE INTO chart_counts (chart_id, count, timestamp) VALUES (?, ?, ?)",
                  (chart_id, count, timestamp))
        conn.commit()
    except Exception as e:
        print(f"存储数据失败: {e}")
    finally:
        conn.close()

# 更新线程 - 分散压力
def update_worker():
    global update_thread_running, update_queue, last_record_update

    while update_thread_running:
        if not update_queue:
            # 队列为空，等待新任务
            time.sleep(1)
            continue

        # 从队列中取出一个谱面
        chart = update_queue.popleft()
        chart_id = chart["id"]

        # 获取当前时间戳
        timestamp = datetime.utcnow().isoformat()
        last_record_update = timestamp

        # 获取谱面游玩记录
        count = fetch_chart_count(chart_id)

        # 存储数据
        store_chart_data(chart_id, count, timestamp)

        # 按指定间隔等待
        time.sleep(update_interval)

# 初始化更新队列
def init_update_queue():
    global update_queue

    # 获取当前谱面列表快照
    with chart_list_lock:
        charts = cached_charts.copy()

    if not charts:
        print("没有可用的谱面列表，跳过初始化队列")
        return

    # 清空队列并添加所有谱面
    update_queue.clear()
    for chart in charts:
        update_queue.append(chart)

    print(f"更新队列已初始化，共 {len(charts)} 个谱面")

# 启动更新线程
def start_update_thread():
    global update_thread, update_thread_running

    if update_thread and update_thread.is_alive():
        return

    update_thread_running = True
    update_thread = threading.Thread(target=update_worker)
    update_thread.daemon = True
    update_thread.start()
    print("更新线程已启动")

# 停止更新线程
def stop_update_thread():
    global update_thread_running

    update_thread_running = False
    if update_thread and update_thread.is_alive():
        update_thread.join(timeout=5)
    print("更新线程已停止")

# 热门排行榜API - 保持原有格式
@app.route('/hot_rank/<time_range>', methods=['GET'])
def hot_rank(time_range):
    # 解析分页参数
    page = request.args.get('page', default=1, type=int)
    per_page = request.args.get('per_page', default=20, type=int)
    offset = (page - 1) * per_page

    # 确定时间范围
    now = datetime.utcnow()
    if time_range == "hour":
        start_time = now - timedelta(hours=1)
    elif time_range == "day":
        start_time = now - timedelta(days=1)
    elif time_range == "week":
        start_time = now - timedelta(weeks=1)
    elif time_range == "month":
        start_time = now - timedelta(days=30)
    else:
        return jsonify({"error": "Invalid time range"}), 400

    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()

    try:
        # 获取增量数据
        c.execute('''
            SELECT a.chart_id, (a.count - COALESCE(b.count, 0)) AS increase
            FROM (
                SELECT chart_id, MAX(timestamp) AS max_ts, count
                FROM chart_counts
                WHERE timestamp <= ?
                GROUP BY chart_id
            ) a
            LEFT JOIN (
                SELECT chart_id, MAX(timestamp) AS max_ts, count
                FROM chart_counts
                WHERE timestamp <= ?
                GROUP BY chart_id
            ) b ON a.chart_id = b.chart_id
            WHERE increase > 0
            ORDER BY increase DESC
            LIMIT ? OFFSET ?
        ''', (now.isoformat(), start_time.isoformat(), per_page, offset))

        results = []
        for row in c.fetchall():
            results.append({
                "chart_id": row[0],
                "increase": row[1]
            })

        return jsonify({
            "last_chart_list_update": last_chart_list_update,
            "last_record_update": last_record_update,
            "page": page,
            "per_page": per_page,
            "results": results,
            "time_range": time_range,
            "total_results": len(results)
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

# 状态API
@app.route('/status', methods=['GET'])
def status():
    return jsonify({
        "last_chart_list_update": last_chart_list_update,
        "last_record_update": last_record_update,
        "cached_charts_count": len(cached_charts),
        "queue_size": len(update_queue),
        "update_interval": update_interval,
        "interval": INTERVAL,
        "chart_list_interval": CHART_LIST_UPDATE_INTERVAL,
        "per_page": PER_PAGE,
        "all_mode": ALL_MODE
    })

# 初始化
init_db()

# 首次获取谱面列表
if ALL_MODE:
    fetch_all_charts_list()
else:
    fetch_limited_charts_list()

# 初始化更新队列
init_update_queue()

# 启动更新线程
start_update_thread()

# 启动定时任务
scheduler = BackgroundScheduler()

# 谱面列表更新任务
scheduler.add_job(
    fetch_all_charts_list if ALL_MODE else fetch_limited_charts_list,
    'interval',
    seconds=CHART_LIST_UPDATE_INTERVAL,
    next_run_time=datetime.now(),  # 立即执行一次
    id='chart_list_update',
    name='Update chart list'
)

# 每次谱面列表更新后重新初始化队列
def on_chart_list_update():
    if ALL_MODE:
        fetch_all_charts_list()
    else:
        fetch_limited_charts_list()
    init_update_queue()

scheduler.add_job(
    on_chart_list_update,
    'interval',
    seconds=CHART_LIST_UPDATE_INTERVAL,
    next_run_time=datetime.now(),
    id='chart_list_update_queue',
    name='Update chart list and queue'
)

scheduler.start()

if __name__ == '__main__':
    try:
        print("Phira数据服务已启动")
        print(f"配置信息:")
        print(f"  游玩记录更新间隔: {INTERVAL}秒")
        print(f"  谱面列表更新间隔: {CHART_LIST_UPDATE_INTERVAL}秒")
        print(f"  每次获取谱面数量: {PER_PAGE}")
        print(f"  全量模式: {'是' if ALL_MODE else '否'}")
        print(f"  API基础地址: {API_BASE}")
        print(f"  数据库文件: {DB_NAME}")
        print(f"  更新间隔: {update_interval}秒/谱面")
        print("\n访问以下API端点:")
        print("  /status - 获取服务状态")
        print("  /hot_rank/<time_range> - 获取热门排行榜 (time_range: hour/day/week/month)")

        app.run(host='0.0.0.0', port=7002)
    except (KeyboardInterrupt, SystemExit):
        stop_update_thread()
        scheduler.shutdown()
        print("\n服务已停止")