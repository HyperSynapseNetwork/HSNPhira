import sqlite3
import threading
import time
import requests
import schedule
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
from flask import Flask, jsonify, request
import json
from typing import Dict, List, Optional, Tuple

app = Flask(__name__)

class ChartTracker:
    def __init__(self, db_path: str = "chart_tracker.db"):
        self.db_path = db_path
        self.lock = threading.Lock()
        self.init_database()
        
        # 状态变量
        self.last_chart_list_update = None
        self.last_record_update = None
        self.cached_charts_count = 0
        self.queue_size = 0
        self.update_interval = 3600  # 1小时
        self.interval = 3600
        self.chart_list_interval = 3600
        self.per_page = 30
        self.all_mode = True
        
        # API基础URL
        self.chart_list_url = "https://phira.5wyxi.com/chart?pageNum=30&page={page}&order=-updated"
        self.record_query_url = "https://phira.5wyxi.com/record/query/{chart_id}?pageNum=20&includePlayer=true&best=true&page=1&std=false"

    def init_database(self):
        """初始化SQLite数据库表结构[10,11](@ref)"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # 创建谱面计数表（存储每个谱面每个小时的count值）
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS chart_counts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    chart_id INTEGER NOT NULL,
                    count INTEGER NOT NULL,
                    timestamp TEXT NOT NULL,
                    UNIQUE(chart_id, timestamp)
            )''')
            
            # 创建增量排名表（存储不同时间范围的增量排名）
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS increment_ranks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    chart_id INTEGER NOT NULL,
                    time_range TEXT NOT NULL,  -- hour, day, week, month
                    increase INTEGER NOT NULL,
                    rank INTEGER NOT NULL,
                    period_start TEXT NOT NULL,
                    period_end TEXT NOT NULL,
                    UNIQUE(chart_id, time_range, period_start)
            )''')
            
            # 创建谱面信息表（缓存谱面基本信息）
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS chart_info (
                    chart_id INTEGER PRIMARY KEY,
                    name TEXT,
                    level TEXT,
                    difficulty REAL,
                    charter TEXT,
                    composer TEXT,
                    updated_time TEXT,
                    last_checked TEXT
            )''')
            
            conn.commit()

    def get_total_pages(self) -> int:
        """获取总页数[1](@ref)"""
        try:
            url = self.chart_list_url.format(page=1)
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                data = response.json()
                total_count = data.get("count", 0)
                return (total_count + self.per_page - 1) // self.per_page
        except Exception as e:
            print(f"获取总页数失败: {e}")
        return 0

    def fetch_chart_page(self, page: int) -> List[Dict]:
        """获取单页谱面列表[1](@ref)"""
        try:
            url = self.chart_list_url.format(page=page)
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                data = response.json()
                return data.get("results", [])
        except Exception as e:
            print(f"获取第{page}页谱面失败: {e}")
        return []

    def fetch_all_charts(self) -> List[Dict]:
        """多线程获取所有谱面[1,5](@ref)"""
        total_pages = self.get_total_pages()
        if total_pages == 0:
            return []
            
        charts = []
        with ThreadPoolExecutor(max_workers=10) as executor:
            future_to_page = {
                executor.submit(self.fetch_chart_page, page): page 
                for page in range(1, total_pages + 1)
            }
            
            for future in as_completed(future_to_page):
                page_charts = future.result()
                charts.extend(page_charts)
                print(f"已完成页面 {future_to_page[future]}/{total_pages}")
        
        self.cached_charts_count = len(charts)
        return charts

    def fetch_chart_count(self, chart_id: int) -> Tuple[int, int]:
        """获取单个谱面的记录数[1](@ref)"""
        try:
            url = self.record_query_url.format(chart_id=chart_id)
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                data = response.json()
                current_count = data.get("count", 0)
                return chart_id, current_count
        except Exception as e:
            print(f"获取谱面{chart_id}记录数失败: {e}")
        return chart_id, 0

    def update_all_chart_counts(self):
        """多线程更新所有谱面的计数[1,4](@ref)"""
        current_time = datetime.now().isoformat()
        charts = self.fetch_all_charts()
        chart_ids = [chart["id"] for chart in charts]
        
        self.queue_size = len(chart_ids)
        print(f"开始更新{len(chart_ids)}个谱面的计数...")
        
        counts = {}
        with ThreadPoolExecutor(max_workers=20) as executor:
            future_to_chart = {
                executor.submit(self.fetch_chart_count, chart_id): chart_id 
                for chart_id in chart_ids
            }
            
            completed = 0
            for future in as_completed(future_to_chart):
                chart_id, count = future.result()
                counts[chart_id] = count
                completed += 1
                self.queue_size = len(chart_ids) - completed
                if completed % 10 == 0:
                    print(f"进度: {completed}/{len(chart_ids)}")
        
        # 保存到数据库
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            for chart_id, count in counts.items():
                cursor.execute('''
                    INSERT OR REPLACE INTO chart_counts 
                    (chart_id, count, timestamp) VALUES (?, ?, ?)
                ''', (chart_id, count, current_time))
            conn.commit()
        
        self.last_record_update = current_time
        self.calculate_increments(current_time)

    def get_previous_count(self, chart_id: int, target_time: datetime) -> int:
        """获取指定时间点的计数[10](@ref)"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT count FROM chart_counts 
                WHERE chart_id = ? AND timestamp <= ? 
                ORDER BY timestamp DESC LIMIT 1
            ''', (chart_id, target_time.isoformat()))
            result = cursor.fetchone()
            return result[0] if result else 0

    def calculate_increments(self, current_time_str: str):
        """计算不同时间范围的增量并排名[10](@ref)"""
        current_time = datetime.fromisoformat(current_time_str)
        time_ranges = {
            "hour": current_time - timedelta(hours=1),
            "day": current_time - timedelta(days=1),
            "week": current_time - timedelta(weeks=1),
            "month": current_time - timedelta(days=30)
        }
        
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # 获取当前所有谱面的最新计数
            cursor.execute('''
                SELECT chart_id, count FROM chart_counts 
                WHERE timestamp = ?
            ''', (current_time_str,))
            current_counts = dict(cursor.fetchall())
            
            for time_range, start_time in time_ranges.items():
                increments = []
                
                for chart_id, current_count in current_counts.items():
                    previous_count = self.get_previous_count(chart_id, start_time)
                    increment = current_count - previous_count
                    increments.append((chart_id, increment))
                
                # 按增量排序并分配排名
                increments.sort(key=lambda x: x[1], reverse=True)
                ranked_increments = []
                current_rank = 1
                last_increment = None
                skip_count = 0
                
                for i, (chart_id, increment) in enumerate(increments):
                    if increment == last_increment:
                        skip_count += 1
                    else:
                        current_rank += skip_count
                        skip_count = 1
                        last_increment = increment
                    
                    ranked_increments.append((
                        chart_id, increment, current_rank, 
                        start_time.isoformat(), current_time_str
                    ))
                
                # 保存排名数据
                cursor.executemany('''
                    INSERT OR REPLACE INTO increment_ranks 
                    (chart_id, time_range, increase, rank, period_start, period_end) 
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', ranked_increments)
            
            conn.commit()

    def start_scheduler(self):
        """启动定时任务[6,7](@ref)"""
        schedule.every(self.update_interval).seconds.do(self.scheduled_update)
        
        def run_scheduler():
            while True:
                schedule.run_pending()
                time.sleep(60)  # 每分钟检查一次
        
        scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
        scheduler_thread.start()

    def scheduled_update(self):
        """定时执行更新任务[6](@ref)"""
        print(f"开始定时更新任务: {datetime.now()}")
        self.last_chart_list_update = datetime.now().isoformat()
        self.update_all_chart_counts()

# 创建全局追踪器实例
tracker = ChartTracker()
tracker.start_scheduler()

@app.route('/status', methods=['GET'])
def get_status():
    """获取服务状态[12](@ref)"""
    return jsonify({
        "last_chart_list_update": tracker.last_chart_list_update,
        "last_record_update": tracker.last_record_update,
        "cached_charts_count": tracker.cached_charts_count,
        "queue_size": tracker.queue_size,
        "update_interval": tracker.update_interval,
        "interval": tracker.interval,
        "chart_list_interval": tracker.chart_list_interval,
        "per_page": tracker.per_page,
        "all_mode": tracker.all_mode
    })

@app.route('/hot_rank/<time_range>', methods=['GET'])
def get_hot_rank(time_range: str):
    """获取热门排行榜[12](@ref)"""
    if time_range not in ['hour', 'day', 'week', 'month']:
        return jsonify({"error": "Invalid time range"}), 400
    
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))
    
    offset = (page - 1) * per_page
    
    with sqlite3.connect(tracker.db_path) as conn:
        cursor = conn.cursor()
        
        # 获取最新时间段的数据
        cursor.execute('''
            SELECT period_end FROM increment_ranks 
            WHERE time_range = ? ORDER BY period_end DESC LIMIT 1
        ''', (time_range,))
        result = cursor.fetchone()
        
        if not result:
            return jsonify({"error": "No data available"}), 404
            
        latest_period = result[0]
        
        # 获取排行榜数据
        cursor.execute('''
            SELECT chart_id, increase FROM increment_ranks 
            WHERE time_range = ? AND period_end = ? 
            ORDER BY rank LIMIT ? OFFSET ?
        ''', (time_range, latest_period, per_page, offset))
        
        results = [{"chart_id": row[0], "increase": row[1]} for row in cursor.fetchall()]
        
        # 获取总数
        cursor.execute('''
            SELECT COUNT(*) FROM increment_ranks 
            WHERE time_range = ? AND period_end = ?
        ''', (time_range, latest_period))
        total_results = cursor.fetchone()[0]
    
    return jsonify({
        "last_chart_list_update": tracker.last_chart_list_update,
        "last_record_update": tracker.last_record_update,
        "page": page,
        "per_page": per_page,
        "results": results,
        "time_range": time_range,
        "total_results": total_results
    })

@app.route('/chart_rank/<int:chart_id>', methods=['GET'])
def get_chart_rank(chart_id: int):
    """获取指定谱面的各时间段排名和增量[12](@ref)"""
    time_ranges = ['hour', 'day', 'week', 'month']
    result = {"chart_id": chart_id, "ranks": {}}
    
    with sqlite3.connect(tracker.db_path) as conn:
        cursor = conn.cursor()
        
        for time_range in time_ranges:
            cursor.execute('''
                SELECT increase, rank, period_end FROM increment_ranks 
                WHERE chart_id = ? AND time_range = ? 
                ORDER BY period_end DESC LIMIT 1
            ''', (chart_id, time_range))
            
            row = cursor.fetchone()
            if row:
                result["ranks"][time_range] = {
                    "increase": row[0],
                    "rank": row[1],
                    "last_updated": row[2]
                }
    
    return jsonify(result)

if __name__ == '__main__':
    # 立即执行一次更新
    tracker.scheduled_update()
    
    # 启动Flask应用[12](@ref)
    app.run(host='0.0.0.0', port=5000, debug=False)
