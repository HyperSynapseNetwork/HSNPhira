import sqlite3
import threading
import time
import requests
import schedule
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
from flask import Flask, jsonify, request
from typing import Dict, List, Optional, Tuple
import logging

# 设置日志
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

class ChartTracker:
    def __init__(self, db_path: str = "chart_tracker.db"):
        self.db_path = db_path
        self.db_lock = threading.Lock()
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
        
        # 请求配置
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        
        # 添加请求统计
        self.request_count = 0
        self.failed_requests = 0

    def make_request_with_retry(self, url, max_retries=3, timeout=10):
        """带重试机制的请求函数"""
        for attempt in range(max_retries):
            try:
                response = self.session.get(url, timeout=timeout)
                self.request_count += 1
                if response.status_code == 200:
                    return response
                else:
                    logger.warning(f"请求失败，状态码: {response.status_code}, URL: {url}, 尝试 {attempt+1}/{max_retries}")
            except requests.exceptions.Timeout:
                logger.warning(f"请求超时: {url}, 尝试 {attempt+1}/{max_retries}")
            except requests.exceptions.RequestException as e:
                logger.warning(f"请求异常: {e}, URL: {url}, 尝试 {attempt+1}/{max_retries}")
            
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt  # 指数退避
                time.sleep(wait_time)
        
        self.failed_requests += 1
        return None

    def init_database(self):
        """初始化SQLite数据库表结构"""
        with sqlite3.connect(self.db_path, timeout=20) as conn:
            cursor = conn.cursor()
            
            # 创建谱面计数表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS chart_counts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    chart_id INTEGER NOT NULL,
                    count INTEGER NOT NULL,
                    timestamp TEXT NOT NULL,
                    UNIQUE(chart_id, timestamp)
            )''')
            
            # 创建增量排名表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS increment_ranks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    chart_id INTEGER NOT NULL,
                    time_range TEXT NOT NULL,
                    increase INTEGER NOT NULL,
                    rank INTEGER NOT NULL,
                    period_start TEXT NOT NULL,
                    period_end TEXT NOT NULL,
                    UNIQUE(chart_id, time_range, period_start)
            )''')
            
            # 创建谱面信息表
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
            logger.info("数据库初始化完成")

    def get_total_pages(self) -> int:
        """获取总页数"""
        logger.info("正在获取总页数...")
        url = self.chart_list_url.format(page=1)
        response = self.make_request_with_retry(url)
        
        if response:
            try:
                data = response.json()
                total_count = data.get("count", 0)
                total_pages = (total_count + self.per_page - 1) // self.per_page
                logger.info(f"总谱面数: {total_count}, 总页数: {total_pages}")
                return total_pages
            except Exception as e:
                logger.error(f"解析响应数据失败: {e}")
        
        logger.warning("获取总页数失败，使用默认值1")
        return 1  # 返回1而不是0，避免没有页数

    def fetch_chart_page(self, page: int) -> List[Dict]:
        """获取单页谱面列表"""
        logger.debug(f"正在获取第 {page} 页谱面...")
        url = self.chart_list_url.format(page=page)
        response = self.make_request_with_retry(url)
        
        if response:
            try:
                data = response.json()
                return data.get("results", [])
            except Exception as e:
                logger.error(f"解析第{page}页数据失败: {e}")
        return []

    def fetch_all_charts(self) -> List[Dict]:
        """多线程获取所有谱面"""
        logger.info("开始获取所有谱面...")
        total_pages = self.get_total_pages()
        if total_pages <= 0:
            logger.error("无法获取谱面总页数")
            return []
            
        charts = []
        all_page_numbers = list(range(1, total_pages + 1))
        
        # 分批处理，每批20页
        batch_size = 20
        for i in range(0, len(all_page_numbers), batch_size):
            batch_pages = all_page_numbers[i:i+batch_size]
            logger.info(f"处理批次 {i//batch_size + 1}/{(len(all_page_numbers)-1)//batch_size + 1}")
            
            with ThreadPoolExecutor(max_workers=5) as executor:  # 减少线程数
                future_to_page = {
                    executor.submit(self.fetch_chart_page, page): page 
                    for page in batch_pages
                }
                
                for future in as_completed(future_to_page, timeout=30):  # 添加超时
                    try:
                        page = future_to_page[future]
                        page_charts = future.result(timeout=20)  # 单个future超时
                        charts.extend(page_charts)
                        logger.info(f"已完成页面 {page}/{total_pages}, 已获取谱面数: {len(charts)}")
                    except Exception as e:
                        logger.warning(f"获取页面 {future_to_page[future]} 失败: {e}")
                        # 记录失败但继续
            time.sleep(1)  # 批次间暂停
        
        logger.info(f"谱面获取完成，总共获取 {len(charts)} 个谱面")
        self.cached_charts_count = len(charts)
        return charts

    def fetch_chart_count(self, chart_id: int) -> Tuple[int, int]:
        """获取单个谱面的记录数"""
        url = self.record_query_url.format(chart_id=chart_id)
        response = self.make_request_with_retry(url, max_retries=2, timeout=15)
        
        if response:
            try:
                data = response.json()
                current_count = data.get("count", 0)
                return chart_id, current_count
            except Exception as e:
                logger.warning(f"解析谱面 {chart_id} 数据失败: {e}")
        return chart_id, 0

    def save_chart_counts(self, counts: Dict[int, int], current_time: str):
        """保存谱面计数到数据库"""
        with self.db_lock:
            with sqlite3.connect(self.db_path, timeout=20) as conn:
                cursor = conn.cursor()
                for chart_id, count in counts.items():
                    cursor.execute('''
                        INSERT OR REPLACE INTO chart_counts 
                        (chart_id, count, timestamp) VALUES (?, ?, ?)
                    ''', (chart_id, count, current_time))
                conn.commit()
                logger.info(f"已保存 {len(counts)} 个谱面计数")

    def update_all_chart_counts(self):
        """多线程更新所有谱面的计数"""
        logger.info("开始更新所有谱面计数...")
        current_time = datetime.now().isoformat()
        charts = self.fetch_all_charts()
        
        if not charts:
            logger.error("没有获取到谱面数据，跳过更新")
            return
            
        chart_ids = [chart["id"] for chart in charts]
        self.queue_size = len(chart_ids)
        
        logger.info(f"开始更新 {len(chart_ids)} 个谱面的计数...")
        
        counts = {}
        failed_charts = []
        
        # 分批处理，每批50个
        batch_size = 50
        for i in range(0, len(chart_ids), batch_size):
            batch_ids = chart_ids[i:i+batch_size]
            logger.info(f"处理谱面批次 {i//batch_size + 1}/{(len(chart_ids)-1)//batch_size + 1}")
            
            with ThreadPoolExecutor(max_workers=10) as executor:  # 减少线程数
                future_to_chart = {
                    executor.submit(self.fetch_chart_count, chart_id): chart_id 
                    for chart_id in batch_ids
                }
                
                for future in as_completed(future_to_chart, timeout=60):
                    try:
                        chart_id, count = future.result(timeout=30)
                        counts[chart_id] = count
                        self.queue_size = len(chart_ids) - len(counts) - len(failed_charts)
                        
                        completed = len(counts) + len(failed_charts)
                        if completed % 20 == 0:
                            logger.info(f"进度: {completed}/{len(chart_ids)}, 成功: {len(counts)}, 失败: {len(failed_charts)}")
                            
                    except Exception as e:
                        chart_id = future_to_chart[future]
                        logger.warning(f"获取谱面 {chart_id} 失败: {e}")
                        failed_charts.append(chart_id)
                        self.queue_size = len(chart_ids) - len(counts) - len(failed_charts)
            
            # 批次间暂停
            time.sleep(2)
            logger.info(f"批次完成，已处理 {len(counts)} 个谱面")
        
        # 保存成功获取的数据
        if counts:
            self.save_chart_counts(counts, current_time)
        
        logger.info(f"更新完成: 成功 {len(counts)}/{len(chart_ids)}")
        if failed_charts:
            logger.warning(f"失败的谱面ID: {failed_charts[:10]}{'...' if len(failed_charts) > 10 else ''}")
        
        self.last_record_update = current_time
        self.calculate_increments(current_time)

    def get_previous_count(self, chart_id: int, target_time: datetime) -> int:
        """获取指定时间点的计数"""
        with self.db_lock:
            with sqlite3.connect(self.db_path, timeout=20) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT count FROM chart_counts 
                    WHERE chart_id = ? AND timestamp <= ? 
                    ORDER BY timestamp DESC LIMIT 1
                ''', (chart_id, target_time.isoformat()))
                result = cursor.fetchone()
                return result[0] if result else 0

    def calculate_increments(self, current_time_str: str):
        """计算不同时间范围的增量并排名"""
        logger.info("开始计算增量排名...")
        current_time = datetime.fromisoformat(current_time_str)
        time_ranges = {
            "hour": current_time - timedelta(hours=1),
            "day": current_time - timedelta(days=1),
            "week": current_time - timedelta(weeks=1),
            "month": current_time - timedelta(days=30)
        }
        
        with self.db_lock:
            with sqlite3.connect(self.db_path, timeout=20) as conn:
                cursor = conn.cursor()
                
                # 获取当前所有谱面的最新计数
                cursor.execute('''
                    SELECT chart_id, count FROM chart_counts 
                    WHERE timestamp = ?
                ''', (current_time_str,))
                current_counts = dict(cursor.fetchall())
                
                if not current_counts:
                    logger.warning("没有找到当前时间的计数数据")
                    return
                
                logger.info(f"找到 {len(current_counts)} 个谱面的当前计数")
                
                for time_range, start_time in time_ranges.items():
                    increments = []
                    logger.info(f"计算 {time_range} 增量...")
                    
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
                            chart_id, 
                            time_range,
                            increment, 
                            current_rank, 
                            start_time.isoformat(), 
                            current_time_str
                        ))
                    
                    # 保存排名数据
                    cursor.executemany('''
                        INSERT OR REPLACE INTO increment_ranks 
                        (chart_id, time_range, increase, rank, period_start, period_end) 
                        VALUES (?, ?, ?, ?, ?, ?)
                    ''', ranked_increments)
                    
                    logger.info(f"{time_range} 排名计算完成，共 {len(ranked_increments)} 个谱面")
                
                conn.commit()
                logger.info("增量排名计算完成")

    def start_scheduler(self):
        """启动定时任务"""
        schedule.every(self.update_interval).seconds.do(self.scheduled_update)
        
        def run_scheduler():
            while True:
                try:
                    schedule.run_pending()
                except Exception as e:
                    logger.error(f"定时任务执行失败: {e}")
                time.sleep(60)
        
        scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
        scheduler_thread.start()
        logger.info("定时任务调度器已启动")

    def scheduled_update(self):
        """定时执行更新任务"""
        update_time = datetime.now()
        logger.info(f"开始定时更新任务: {update_time}")
        self.last_chart_list_update = update_time.isoformat()
        
        try:
            self.update_all_chart_counts()
            logger.info(f"定时更新任务完成: {datetime.now()}")
        except Exception as e:
            logger.error(f"定时更新任务失败: {e}")

# 创建全局追踪器实例
tracker = ChartTracker()

@app.route('/status', methods=['GET'])
def get_status():
    """获取服务状态"""
    return jsonify({
        "last_chart_list_update": tracker.last_chart_list_update,
        "last_record_update": tracker.last_record_update,
        "cached_charts_count": tracker.cached_charts_count,
        "queue_size": tracker.queue_size,
        "update_interval": tracker.update_interval,
        "interval": tracker.interval,
        "chart_list_interval": tracker.chart_list_interval,
        "per_page": tracker.per_page,
        "all_mode": tracker.all_mode,
        "request_count": tracker.request_count,
        "failed_requests": tracker.failed_requests
    })

@app.route('/hot_rank/<time_range>', methods=['GET'])
def get_hot_rank(time_range: str):
    """获取热门排行榜"""
    if time_range not in ['hour', 'day', 'week', 'month']:
        return jsonify({"error": "Invalid time range"}), 400
    
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 20))
    
    offset = (page - 1) * per_page
    
    with sqlite3.connect(tracker.db_path, timeout=10) as conn:
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
    """获取指定谱面的各时间段排名和增量"""
    time_ranges = ['hour', 'day', 'week', 'month']
    result = {"chart_id": chart_id, "ranks": {}}
    
    with sqlite3.connect(tracker.db_path, timeout=10) as conn:
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
    # 启动定时任务
    tracker.start_scheduler()
    
    # 立即执行一次更新（在后台线程中）
    def initial_update():
        time.sleep(5)  # 等待5秒，让服务完全启动
        try:
            logger.info("开始初始数据更新...")
            tracker.scheduled_update()
        except Exception as e:
            logger.error(f"初始更新失败: {e}")
    
    # 在后台线程中执行初始更新
    import threading
    init_thread = threading.Thread(target=initial_update, daemon=True)
    init_thread.start()
    
    # 启动Flask应用
    logger.info("启动Flask应用...")
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
