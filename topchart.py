import sqlite3
import requests
import time
imporimport asyncio
import aiohttp
import aiosqlite
import time
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI, HTTPException
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 全局变量
DB_PATH = "phira_stats.db"
BASE_URL = "https://phira.5wyxi.com"
CHART_API = "/chart?pageNum=30&order=-updated&page={page}"
RECORD_API = "/record/query/{chart_id}?pageNum=20&includePlayer=true&best=true&page=1&std=false"
UPDATE_INTERVAL = 3600  # 1小时
CHART_LIST_INTERVAL = 86400  # 24小时
PER_PAGE = 30

# 数据库初始化
async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        # 谱面表
        await db.execute("""
            CREATE TABLE IF NOT EXISTS charts (
                id INTEGER PRIMARY KEY,
                name TEXT,
                level TEXT,
                difficulty REAL,
                charter TEXT,
                composer TEXT,
                last_count INTEGER,
                created TEXT,
                updated TEXT
            )
        """)
        
        # 统计表 (小时级)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS stats_hourly (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chart_id INTEGER,
                count INTEGER,
                increase INTEGER,
                timestamp TEXT,
                FOREIGN KEY(chart_id) REFERENCES charts(id)
            )
        """)
        
        # 统计表 (天级)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS stats_daily (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chart_id INTEGER,
                count INTEGER,
                increase INTEGER,
                date TEXT,
                FOREIGN KEY(chart_id) REFERENCES charts(id)
            )
        """)
        
        # 统计表 (周级)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS stats_weekly (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chart_id INTEGER,
                count INTEGER,
                increase INTEGER,
                week_start TEXT,
                FOREIGN KEY(chart_id) REFERENCES charts(id)
            )
        """)
        
        # 统计表 (月级)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS stats_monthly (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chart_id INTEGER,
                count INTEGER,
                increase INTEGER,
                month_start TEXT,
                FOREIGN KEY(chart_id) REFERENCES charts(id)
            )
        """)
        
        # 配置表
        await db.execute("""
            CREATE TABLE IF NOT EXISTS config (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        """)
        
        await db.commit()

# API 客户端
class PhiraClient:
    def __init__(self):
        self.session = None
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
            
    async def fetch_json(self, url: str) -> Optional[Dict]:
        try:
            async with self.session.get(url) as response:
                if response.status == 200:
                    return await response.json()
                logger.error(f"API请求失败: {url}, 状态码: {response.status}")
        except Exception as e:
            logger.error(f"请求异常: {url}, 错误: {e}")
        return None
        
    async def get_charts(self, page: int = 1) -> Optional[Dict]:
        url = f"{BASE_URL}{CHART_API.format(page=page)}"
        return await self.fetch_json(url)
        
    async def get_records(self, chart_id: int) -> Optional[Dict]:
        url = f"{BASE_URL}{RECORD_API.format(chart_id=chart_id)}"
        return await self.fetch_json(url)

# 数据库服务
class DatabaseService:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        
    async def get_chart(self, chart_id: int) -> Optional[Dict]:
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                "SELECT id, name, level, difficulty, charter, composer, last_count FROM charts WHERE id = ?",
                (chart_id,)
            )
            row = await cursor.fetchone()
            if row:
                return {
                    "id": row[0],
                    "name": row[1],
                    "level": row[2],
                    "difficulty": row[3],
                    "charter": row[4],
                    "composer": row[5],
                    "last_count": row[6]
                }
            return None
            
    async def save_chart(self, chart_data: Dict):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """INSERT OR REPLACE INTO charts 
                   (id, name, level, difficulty, charter, composer, last_count, created, updated)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    chart_data["id"],
                    chart_data["name"],
                    chart_data["level"],
                    chart_data["difficulty"],
                    chart_data["charter"],
                    chart_data["composer"],
                    chart_data.get("last_count", 0),
                    chart_data.get("created"),
                    chart_data.get("updated")
                )
            )
            await db.commit()
            
    async def save_hourly_stat(self, chart_id: int, count: int, increase: int, timestamp: str):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """INSERT INTO stats_hourly (chart_id, count, increase, timestamp)
                   VALUES (?, ?, ?, ?)""",
                (chart_id, count, increase, timestamp)
            )
            await db.commit()
            
    async def get_last_hourly_stat(self, chart_id: int) -> Optional[Dict]:
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                """SELECT id, chart_id, count, increase, timestamp 
                   FROM stats_hourly 
                   WHERE chart_id = ? 
                   ORDER BY timestamp DESC LIMIT 1""",
                (chart_id,)
            )
            row = await cursor.fetchone()
            if row:
                return {
                    "id": row[0],
                    "chart_id": row[1],
                    "count": row[2],
                    "increase": row[3],
                    "timestamp": row[4]
                }
            return None
            
    async def update_config(self, key: str, value: str):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                "INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)",
                (key, value)
            )
            await db.commit()
            
    async def get_config(self, key: str) -> Optional[str]:
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(
                "SELECT value FROM config WHERE key = ?",
                (key,)
            )
            row = await cursor.fetchone()
            return row[0] if row else None
            
    async def get_hot_rank(self, time_range: str, page: int = 1, per_page: int = 20) -> Dict:
        offset = (page - 1) * per_page
        table_map = {
            "hour": "stats_hourly",
            "day": "stats_daily",
            "week": "stats_weekly",
            "month": "stats_monthly"
        }
        
        if time_range not in table_map:
            raise ValueError("Invalid time range")
            
        table = table_map[time_range]
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute(f"""
                SELECT chart_id, SUM(increase) as total_increase
                FROM {table}
                GROUP BY chart_id
                ORDER BY total_increase DESC
                LIMIT ? OFFSET ?
            """, (per_page, offset))
            
            results = []
            async for row in cursor:
                results.append({
                    "chart_id": row[0],
                    "increase": row[1]
                })
                
            return {
                "page": page,
                "per_page": per_page,
                "results": results,
                "time_range": time_range,
                "total_results": len(results)
            }

# 核心业务逻辑
class PhiraStatsService:
    def __init__(self):
        self.db = DatabaseService()
        self.scheduler = AsyncIOScheduler()
        self.last_chart_list_update = None
        self.last_record_update = None
        self.cached_charts_count = 0
        self.queue_size = 0
        self.all_mode = True
        
    async def update_chart_list(self):
        """更新谱面列表"""
        current_time = datetime.now().isoformat()
        logger.info(f"开始更新谱面列表: {current_time}")
        
        chart_ids = set()
        page = 1
        async with PhiraClient() as client:
            while True:
                data = await client.get_charts(page)
                if not data or not data.get("results"):
                    break
                    
                # 处理谱面数据
                for chart in data["results"]:
                    chart_id = chart["id"]
                    chart_ids.add(chart_id)
                    
                    # 保存谱面信息
                    await self.db.save_chart({
                        "id": chart_id,
                        "name": chart["name"],
                        "level": chart["level"],
                        "difficulty": chart["difficulty"],
                        "charter": chart["charter"],
                        "composer": chart["composer"],
                        "created": chart["created"],
                        "updated": chart["updated"]
                    })
                
                # 检查是否还有下一页
                if len(data["results"]) < PER_PAGE:
                    break
                page += 1
                
        self.cached_charts_count = len(chart_ids)
        self.last_chart_list_update = current_time
        await self.db.update_config("last_chart_list_update", current_time)
        logger.info(f"谱面列表更新完成, 共 {self.cached_charts_count} 个谱面")
        
    async def update_chart_records(self, chart_id: int):
        """更新单个谱面的游玩记录"""
        async with PhiraClient() as client:
            data = await client.get_records(chart_id)
            if not data:
                return None
                
            current_count = data["count"]
            current_time = datetime.now().isoformat()
            
            # 获取上次统计
            last_stat = await self.db.get_last_hourly_stat(chart_id)
            last_count = last_stat["count"] if last_stat else 0
            increase = current_count - last_count
            
            # 保存小时统计
            await self.db.save_hourly_stat(chart_id, current_count, increase, current_time)
            
            # 更新谱面的最新计数
            chart = await self.db.get_chart(chart_id)
            if chart:
                chart["last_count"] = current_count
                await self.db.save_chart(chart)
                
            self.last_record_update = current_time
            await self.db.update_config("last_record_update", current_time)
            
            return current_count
            
    async def process_all_charts(self):
        """处理所有谱面（异步并发）"""
        logger.info("开始处理所有谱面游玩记录")
        start_time = time.time()
        
        # 获取所有谱面ID
        async with aiosqlite.connect(DB_PATH) as db:
            cursor = await db.execute("SELECT id FROM charts")
            chart_ids = [row[0] async for row in cursor]
            
        self.queue_size = len(chart_ids)
        
        # 并发处理
        semaphore = asyncio.Semaphore(10)  # 限制并发数
        
        async def process_chart(chart_id):
            async with semaphore:
                try:
                    await self.update_chart_records(chart_id)
                except Exception as e:
                    logger.error(f"处理谱面 {chart_id} 失败: {e}")
                    
        tasks = [process_chart(chart_id) for chart_id in chart_ids]
        await asyncio.gather(*tasks, return_exceptions=True)
        
        logger.info(f"所有谱面处理完成, 耗时: {time.time() - start_time:.2f}秒")
        self.queue_size = 0
        
    async def calculate_daily_stats(self):
        """计算天级统计"""
        now = datetime.now()
        yesterday = now - timedelta(days=1)
        date_str = yesterday.strftime("%Y-%m-%d")
        
        async with aiosqlite.connect(DB_PATH) as db:
            # 获取昨天的小时统计
            cursor = await db.execute("""
                SELECT chart_id, MAX(count) as max_count, MIN(count) as min_count
                FROM stats_hourly 
                WHERE timestamp LIKE ?
                GROUP BY chart_id
            """, (f"{date_str}%",))
            
            async for row in cursor:
                chart_id, max_count, min_count = row
                increase = max_count - min_count
                
                # 保存天级统计
                await db.execute("""
                    INSERT INTO stats_daily (chart_id, count, increase, date)
                    VALUES (?, ?, ?, ?)
                """, (chart_id, max_count, increase, date_str))
                
            await db.commit()
        logger.info(f"天级统计计算完成: {date_str}")
        
    async def calculate_weekly_stats(self):
        """计算周级统计"""
        now = datetime.now()
        week_start = now - timedelta(days=now.weekday())
        week_start_str = week_start.strftime("%Y-%m-%d")
        
        async with aiosqlite.connect(DB_PATH) as db:
            # 获取本周的日统计
            cursor = await db.execute("""
                SELECT chart_id, MAX(count) as max_count, MIN(count) as min_count
                FROM stats_daily 
                WHERE date >= ?
                GROUP BY chart_id
            """, (week_start_str,))
            
            async for row in cursor:
                chart_id, max_count, min_count = row
                increase = max_count - min_count
                
                # 保存周级统计
                await db.execute("""
                    INSERT INTO stats_weekly (chart_id, count, increase, week_start)
                    VALUES (?, ?, ?, ?)
                """, (chart_id, max_count, increase, week_start_str))
                
            await db.commit()
        logger.info(f"周级统计计算完成: {week_start_str}")
        
    async def calculate_monthly_stats(self):
        """计算月级统计"""
        now = datetime.now()
        month_start = now.replace(day=1)
        month_start_str = month_start.strftime("%Y-%m-%d")
        
        async with aiosqlite.connect(DB_PATH) as db:
            # 获取本月的日统计
            cursor = await db.execute("""
                SELECT chart_id, MAX(count) as max_count, MIN(count) as min_count
                FROM stats_daily 
                WHERE date >= ?
                GROUP BY chart_id
            """, (month_start_str,))
            
            async for row in cursor:
                chart_id, max_count, min_count = row
                increase = max_count - min_count
                
                # 保存月级统计
                await db.execute("""
                    INSERT INTO stats_monthly (chart_id, count, increase, month_start)
                    VALUES (?, ?, ?, ?)
                """, (chart_id, max_count, increase, month_start_str))
                
            await db.commit()
        logger.info(f"月级统计计算完成: {month_start_str}")
        
    async def startup(self):
        """启动服务"""
        await init_db()
        
        # 加载配置
        self.last_chart_list_update = await self.db.get_config("last_chart_list_update")
        self.last_record_update = await self.db.get_config("last_record_update")
        
        # 添加定时任务
        self.scheduler.add_job(
            self.update_chart_list,
            IntervalTrigger(seconds=CHART_LIST_INTERVAL),
            id="update_chart_list"
        )
        
        self.scheduler.add_job(
            self.process_all_charts,
            IntervalTrigger(seconds=UPDATE_INTERVAL),
            id="process_all_charts"
        )
        
        # 每天凌晨执行统计计算
        self.scheduler.add_job(
            self.calculate_daily_stats,
            "cron",
            hour=0,
            minute=0,
            id="calculate_daily_stats"
        )
        
        self.scheduler.add_job(
            self.calculate_weekly_stats,
            "cron",
            day_of_week=0,  # 每周日
            hour=0,
            minute=0,
            id="calculate_weekly_stats"
        )
        
        self.scheduler.add_job(
            self.calculate_monthly_stats,
            "cron",
            day=1,  # 每月1号
            hour=0,
            minute=0,
            id="calculate_monthly_stats"
        )
        
        self.scheduler.start()
        
        # 立即执行一次初始化
        await self.update_chart_list()
        await self.process_all_charts()
        
    async def shutdown(self):
        """关闭服务"""
        if self.scheduler.running:
            self.scheduler.shutdown()

# FastAPI 应用
app = FastAPI(title="Phira Stats API")
service = PhiraStatsService()

@asynccontextmanager
async def lifespan(app: FastAPI):
    await service.startup()
    yield
    await service.shutdown()

app = FastAPI(lifespan=lifespan)

@app.get("/status")
async def get_status():
    return {
        "last_chart_list_update": service.last_chart_list_update,
        "last_record_update": service.last_record_update,
        "cached_charts_count": service.cached_charts_count,
        "queue_size": service.queue_size,
        "update_interval": UPDATE_INTERVAL,
        "interval": UPDATE_INTERVAL,
        "chart_list_interval": CHART_LIST_INTERVAL,
        "per_page": PER_PAGE,
        "all_mode": service.all_mode
    }

@app.get("/hot_rank/{time_range}")
async def get_hot_rank(time_range: str, page: int = 1, per_page: int = 20):
    if time_range not in ["hour", "day", "week", "month"]:
        raise HTTPException(status_code=400, detail="Invalid time range")
        
    try:
        result = await service.db.get_hot_rank(time_range, page, per_page)
        result["last_chart_list_update"] = service.last_chart_list_update
        result["last_record_update"] = service.last_record_update
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/chart/{chart_id}")
async def get_chart_data(chart_id: int):
    chart = await service.db.get_chart(chart_id)
    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")
    return chart

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
 json
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