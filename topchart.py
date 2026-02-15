import sqlite3
import requests
import threading
import time
from datetime import datetime, timedelta
from flask import Flask, jsonify, request
from concurrent.futures import ThreadPoolExecutor, as_completed
import logging
from typing import List, Dict, Optional, Tuple

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('phira_stats.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Flask应用
app = Flask(__name__)

# 全局配置
CONFIG = {
    'update_interval': 0.1,  # 单个谱面更新间隔（秒），避免请求过快
    'interval': 3600,  # 游玩记录获取间隔（秒，1小时）
    'chart_list_interval': 3600,  # 谱面列表更新间隔（秒）
    'per_page': 30,  # 每页谱面数量
    'all_mode': True,  # 是否全量模式
    'max_workers': 10,  # 最大线程数（降低避免被限流）
    'db_path': 'phira_stats.db',
    'request_timeout': 15  # 请求超时时间
}

# 全局状态
STATUS = {
    'last_chart_list_update': None,
    'last_record_update': None,
    'cached_charts_count': 0,
    'queue_size': 0,
    'is_updating': False,
    'error_count': 0
}


class Database:
    """数据库操作类"""
    
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.lock = threading.Lock()
        self.init_database()
    
    def get_connection(self):
        """获取数据库连接"""
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn
    
    def init_database(self):
        """初始化数据库表结构"""
        with self.lock:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            # 谱面基本信息表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS charts (
                    id INTEGER PRIMARY KEY,
                    name TEXT,
                    level TEXT,
                    difficulty REAL,
                    charter TEXT,
                    composer TEXT,
                    created TEXT,
                    updated TEXT
                )
            ''')
            
            # 小时记录表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS hourly_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    chart_id INTEGER,
                    timestamp TEXT,
                    count INTEGER,
                    increase INTEGER DEFAULT 0,
                    UNIQUE(chart_id, timestamp)
                )
            ''')
            
            # 每日统计表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS daily_stats (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    chart_id INTEGER,
                    date TEXT,
                    increase INTEGER,
                    rank INTEGER,
                    UNIQUE(chart_id, date)
                )
            ''')
            
            # 每周统计表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS weekly_stats (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    chart_id INTEGER,
                    week TEXT,
                    increase INTEGER,
                    rank INTEGER,
                    UNIQUE(chart_id, week)
                )
            ''')
            
            # 每月统计表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS monthly_stats (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    chart_id INTEGER,
                    month TEXT,
                    increase INTEGER,
                    rank INTEGER,
                    UNIQUE(chart_id, month)
                )
            ''')
            
            # 创建索引
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_hourly_chart_time ON hourly_records(chart_id, timestamp)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_hourly_timestamp ON hourly_records(timestamp)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_daily_chart_date ON daily_stats(chart_id, date)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_daily_date ON daily_stats(date)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_weekly_chart_week ON weekly_stats(chart_id, week)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_weekly_week ON weekly_stats(week)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_monthly_chart_month ON monthly_stats(chart_id, month)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_monthly_month ON monthly_stats(month)')
            
            conn.commit()
            conn.close()
            logger.info("数据库初始化完成")
    
    def upsert_chart(self, chart_data: Dict):
        """插入或更新谱面信息"""
        with self.lock:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            try:
                cursor.execute('''
                    INSERT OR REPLACE INTO charts 
                    (id, name, level, difficulty, charter, composer, created, updated)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    chart_data['id'],
                    chart_data.get('name', ''),
                    chart_data.get('level', ''),
                    chart_data.get('difficulty', 0.0),
                    chart_data.get('charter', ''),
                    chart_data.get('composer', ''),
                    chart_data.get('created', ''),
                    chart_data.get('updated', '')
                ))
                
                conn.commit()
            except Exception as e:
                logger.error(f"保存谱面信息失败 (id={chart_data.get('id')}): {e}")
                conn.rollback()
            finally:
                conn.close()
    
    def insert_hourly_record(self, chart_id: int, timestamp: str, count: int, increase: int):
        """插入小时记录"""
        with self.lock:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            try:
                # 使用精确到小时的时间戳
                hour_timestamp = timestamp[:13] + ':00:00'
                
                cursor.execute('''
                    INSERT OR REPLACE INTO hourly_records 
                    (chart_id, timestamp, count, increase)
                    VALUES (?, ?, ?, ?)
                ''', (chart_id, hour_timestamp, count, increase))
                
                conn.commit()
            except Exception as e:
                logger.error(f"插入小时记录失败 (chart_id={chart_id}): {e}")
                conn.rollback()
            finally:
                conn.close()
    
    def get_latest_count(self, chart_id: int) -> int:
        """获取谱面最新的count值"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                SELECT count FROM hourly_records 
                WHERE chart_id = ? 
                ORDER BY timestamp DESC 
                LIMIT 1
            ''', (chart_id,))
            
            result = cursor.fetchone()
            return result['count'] if result else 0
        finally:
            conn.close()
    
    def get_count_at_time(self, chart_id: int, timestamp: str) -> int:
        """获取指定时间之前的最新count值"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                SELECT count FROM hourly_records 
                WHERE chart_id = ? AND timestamp <= ? 
                ORDER BY timestamp DESC 
                LIMIT 1
            ''', (chart_id, timestamp))
            
            result = cursor.fetchone()
            return result['count'] if result else 0
        finally:
            conn.close()
    
    def calculate_and_store_stats(self, time_range: str, timestamp: str):
        """计算并存储统计数据"""
        logger.info(f"开始计算{time_range}统计数据...")
        
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            dt = datetime.fromisoformat(timestamp)
            
            # 计算时间范围
            if time_range == 'hour':
                start_time = (dt - timedelta(hours=1)).isoformat()
                period = timestamp[:13]
            elif time_range == 'day':
                start_time = (dt - timedelta(days=1)).isoformat()
                period = timestamp[:10]
            elif time_range == 'week':
                start_time = (dt - timedelta(weeks=1)).isoformat()
                period = f"{dt.year}-W{dt.isocalendar()[1]:02d}"
            elif time_range == 'month':
                if dt.month == 1:
                    start_time = f"{dt.year-1}-12-01T00:00:00"
                else:
                    start_time = f"{dt.year}-{dt.month-1:02d}-01T00:00:00"
                period = timestamp[:7]
            else:
                return
            
            # 获取所有谱面ID
            cursor.execute('SELECT id FROM charts')
            chart_ids = [row['id'] for row in cursor.fetchall()]
            
            logger.info(f"正在计算{len(chart_ids)}个谱面的{time_range}增量...")
            
            # 计算每个谱面的增量
            increases = []
            for chart_id in chart_ids:
                current_count = self.get_count_at_time(chart_id, timestamp)
                previous_count = self.get_count_at_time(chart_id, start_time)
                increase = current_count - previous_count
                
                if increase > 0:
                    increases.append((chart_id, increase))
            
            # 排序并计算排名
            increases.sort(key=lambda x: x[1], reverse=True)
            
            logger.info(f"{time_range}统计：共{len(increases)}个谱面有增量")
            
            # 存储统计数据
            if time_range == 'day':
                for rank, (chart_id, increase) in enumerate(increases, 1):
                    cursor.execute('''
                        INSERT OR REPLACE INTO daily_stats 
                        (chart_id, date, increase, rank)
                        VALUES (?, ?, ?, ?)
                    ''', (chart_id, period, increase, rank))
            elif time_range == 'week':
                for rank, (chart_id, increase) in enumerate(increases, 1):
                    cursor.execute('''
                        INSERT OR REPLACE INTO weekly_stats 
                        (chart_id, week, increase, rank)
                        VALUES (?, ?, ?, ?)
                    ''', (chart_id, period, increase, rank))
            elif time_range == 'month':
                for rank, (chart_id, increase) in enumerate(increases, 1):
                    cursor.execute('''
                        INSERT OR REPLACE INTO monthly_stats 
                        (chart_id, month, increase, rank)
                        VALUES (?, ?, ?, ?)
                    ''', (chart_id, period, increase, rank))
            
            conn.commit()
            logger.info(f"完成{time_range}统计计算")
            
        except Exception as e:
            logger.error(f"计算{time_range}统计失败: {e}")
            conn.rollback()
        finally:
            conn.close()
    
    def get_hot_rank(self, time_range: str, page: int = 1, per_page: int = 20) -> List[Dict]:
        """获取热门排行榜"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            offset = (page - 1) * per_page
            
            if time_range == 'hour':
                cursor.execute('''
                    SELECT chart_id, increase 
                    FROM hourly_records 
                    WHERE timestamp = (SELECT MAX(timestamp) FROM hourly_records)
                    AND increase > 0
                    ORDER BY increase DESC 
                    LIMIT ? OFFSET ?
                ''', (per_page, offset))
            elif time_range == 'day':
                cursor.execute('''
                    SELECT chart_id, increase 
                    FROM daily_stats 
                    WHERE date = (SELECT MAX(date) FROM daily_stats)
                    ORDER BY rank 
                    LIMIT ? OFFSET ?
                ''', (per_page, offset))
            elif time_range == 'week':
                cursor.execute('''
                    SELECT chart_id, increase 
                    FROM weekly_stats 
                    WHERE week = (SELECT MAX(week) FROM weekly_stats)
                    ORDER BY rank 
                    LIMIT ? OFFSET ?
                ''', (per_page, offset))
            elif time_range == 'month':
                cursor.execute('''
                    SELECT chart_id, increase 
                    FROM monthly_stats 
                    WHERE month = (SELECT MAX(month) FROM monthly_stats)
                    ORDER BY rank 
                    LIMIT ? OFFSET ?
                ''', (per_page, offset))
            else:
                return []
            
            results = [dict(row) for row in cursor.fetchall()]
            return results
            
        finally:
            conn.close()
    
    def get_chart_stats(self, chart_id: int) -> Dict:
        """获取指定谱面的统计信息"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            stats = {}
            
            # 小时数据 - 获取最新小时的增量
            cursor.execute('''
                SELECT increase, timestamp
                FROM hourly_records 
                WHERE chart_id = ? 
                ORDER BY timestamp DESC 
                LIMIT 1
            ''', (chart_id,))
            hour_result = cursor.fetchone()
            
            # 计算小时排名
            hour_rank = None
            if hour_result:
                cursor.execute('''
                    SELECT COUNT(*) + 1 as rank
                    FROM hourly_records 
                    WHERE timestamp = ? AND increase > ?
                ''', (hour_result['timestamp'], hour_result['increase']))
                rank_result = cursor.fetchone()
                hour_rank = rank_result['rank'] if rank_result else None
            
            stats['hour'] = {
                'increase': hour_result['increase'] if hour_result else 0,
                'rank': hour_rank
            }
            
            # 日数据
            cursor.execute('''
                SELECT increase, rank 
                FROM daily_stats 
                WHERE chart_id = ? 
                ORDER BY date DESC 
                LIMIT 1
            ''', (chart_id,))
            day_result = cursor.fetchone()
            stats['day'] = {
                'increase': day_result['increase'] if day_result else 0,
                'rank': day_result['rank'] if day_result else None
            }
            
            # 周数据
            cursor.execute('''
                SELECT increase, rank 
                FROM weekly_stats 
                WHERE chart_id = ? 
                ORDER BY week DESC 
                LIMIT 1
            ''', (chart_id,))
            week_result = cursor.fetchone()
            stats['week'] = {
                'increase': week_result['increase'] if week_result else 0,
                'rank': week_result['rank'] if week_result else None
            }
            
            # 月数据
            cursor.execute('''
                SELECT increase, rank 
                FROM monthly_stats 
                WHERE chart_id = ? 
                ORDER BY month DESC 
                LIMIT 1
            ''', (chart_id,))
            month_result = cursor.fetchone()
            stats['month'] = {
                'increase': month_result['increase'] if month_result else 0,
                'rank': month_result['rank'] if month_result else None
            }
            
            return stats
            
        finally:
            conn.close()
    
    def get_all_chart_ids(self) -> List[int]:
        """获取所有谱面ID"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('SELECT id FROM charts ORDER BY id')
            chart_ids = [row['id'] for row in cursor.fetchall()]
            return chart_ids
        finally:
            conn.close()


class PhiraAPI:
    """Phira API 客户端"""
    
    BASE_URL = 'https://phira.5wyxi.com'
    
    @staticmethod
    def get_chart_list(page: int) -> Optional[Dict]:
        """获取谱面列表"""
        url = f'{PhiraAPI.BASE_URL}/chart?pageNum=30&page={page}&order=-updated'
        try:
            logger.debug(f"请求谱面列表: page={page}")
            response = requests.get(url, timeout=CONFIG['request_timeout'])
            response.raise_for_status()
            data = response.json()
            logger.debug(f"获取到{len(data.get('results', []))}个谱面 (page={page})")
            return data
        except requests.exceptions.RequestException as e:
            logger.error(f"获取谱面列表失败 (page={page}): {e}")
            STATUS['error_count'] += 1
            return None
        except Exception as e:
            logger.error(f"解析谱面列表失败 (page={page}): {e}")
            STATUS['error_count'] += 1
            return None
    
    @staticmethod
    def get_record_count(chart_id: int) -> Optional[int]:
        """获取谱面游玩记录数量"""
        url = f'{PhiraAPI.BASE_URL}/record/query/{chart_id}?pageNum=20&includePlayer=true&best=true&page=1&std=false'
        try:
            response = requests.get(url, timeout=CONFIG['request_timeout'])
            response.raise_for_status()
            data = response.json()
            count = data.get('count', 0)
            logger.debug(f"谱面 {chart_id} 记录数: {count}")
            return count
        except requests.exceptions.RequestException as e:
            logger.warning(f"获取谱面记录失败 (chart_id={chart_id}): {e}")
            STATUS['error_count'] += 1
            return None
        except Exception as e:
            logger.error(f"解析谱面记录失败 (chart_id={chart_id}): {e}")
            STATUS['error_count'] += 1
            return None


class DataCollector:
    """数据收集器"""
    
    def __init__(self, db: Database):
        self.db = db
        self.is_running = False
        self.stop_event = threading.Event()
    
    def fetch_all_charts(self) -> List[int]:
        """获取所有谱面信息"""
        logger.info("=" * 50)
        logger.info("开始获取谱面列表...")
        all_charts = []
        page = 1
        max_pages = 1000  # 防止无限循环
        
        while page <= max_pages:
            data = PhiraAPI.get_chart_list(page)
            
            if not data or 'results' not in data:
                logger.warning(f"第{page}页没有数据，停止获取")
                break
            
            results = data['results']
            if not results:
                logger.info(f"第{page}页为空，已获取所有谱面")
                break
            
            all_charts.extend(results)
            logger.info(f"已获取第{page}页，共{len(results)}个谱面，累计{len(all_charts)}个")
            
            if not CONFIG['all_mode'] and len(all_charts) >= CONFIG['per_page']:
                all_charts = all_charts[:CONFIG['per_page']]
                logger.info(f"非全量模式，只保留前{CONFIG['per_page']}个谱面")
                break
            
            # 检查是否还有更多数据
            if len(results) < 30:
                logger.info(f"第{page}页数据不足30个，已到达末页")
                break
            
            page += 1
            time.sleep(0.1)  # 避免请求过快
        
        logger.info(f"谱面列表获取完成，共{len(all_charts)}个谱面")
        
        # 保存到数据库
        saved_count = 0
        for chart in all_charts:
            self.db.upsert_chart(chart)
            saved_count += 1
        
        logger.info(f"已保存{saved_count}个谱面到数据库")
        
        STATUS['cached_charts_count'] = len(all_charts)
        STATUS['last_chart_list_update'] = datetime.now().isoformat()
        
        chart_ids = [chart['id'] for chart in all_charts]
        logger.info(f"谱面ID范围: {min(chart_ids) if chart_ids else 'N/A'} ~ {max(chart_ids) if chart_ids else 'N/A'}")
        
        return chart_ids
    
    def fetch_record_count(self, chart_id: int) -> Tuple[int, Optional[int]]:
        """获取单个谱面的记录数"""
        count = PhiraAPI.get_record_count(chart_id)
        time.sleep(CONFIG['update_interval'])  # 控制请求速率
        return chart_id, count
    
    def update_all_records(self):
        """更新所有谱面的游玩记录"""
        if STATUS['is_updating']:
            logger.warning("已有更新任务在运行，跳过本次更新")
            return
        
        STATUS['is_updating'] = True
        logger.info("=" * 50)
        logger.info("开始更新游玩记录...")
        
        try:
            # 获取所有谱面ID
            chart_ids = self.db.get_all_chart_ids()
            if not chart_ids:
                logger.warning("数据库中没有谱面数据，先获取谱面列表")
                chart_ids = self.fetch_all_charts()
            
            if not chart_ids:
                logger.error("无法获取谱面列表，放弃本次更新")
                return
            
            logger.info(f"准备更新{len(chart_ids)}个谱面的游玩记录")
            STATUS['queue_size'] = len(chart_ids)
            
            # 当前时间戳
            current_time = datetime.now().isoformat()
            
            # 多线程获取记录数
            results = []
            success_count = 0
            fail_count = 0
            
            with ThreadPoolExecutor(max_workers=CONFIG['max_workers']) as executor:
                futures = {executor.submit(self.fetch_record_count, cid): cid for cid in chart_ids}
                
                for future in as_completed(futures):
                    chart_id, count = future.result()
                    STATUS['queue_size'] -= 1
                    
                    if count is not None:
                        results.append((chart_id, count))
                        success_count += 1
                    else:
                        fail_count += 1
                    
                    # 每100个输出一次进度
                    if (success_count + fail_count) % 100 == 0:
                        logger.info(f"进度: {success_count + fail_count}/{len(chart_ids)} (成功: {success_count}, 失败: {fail_count})")
            
            logger.info(f"记录获取完成: 成功{success_count}个, 失败{fail_count}个")
            
            # 计算增量并保存
            update_count = 0
            for chart_id, count in results:
                previous_count = self.db.get_latest_count(chart_id)
                increase = count - previous_count
                
                self.db.insert_hourly_record(chart_id, current_time, count, increase)
                update_count += 1
                
                if increase > 0:
                    logger.debug(f"谱面 {chart_id}: {previous_count} -> {count} (+{increase})")
            
            logger.info(f"已更新{update_count}个谱面的记录")
            
            STATUS['last_record_update'] = current_time
            STATUS['queue_size'] = 0
            
            # 计算统计数据
            self.calculate_stats(current_time)
            
            logger.info("游玩记录更新完成")
            
        except Exception as e:
            logger.error(f"更新游玩记录时出错: {e}", exc_info=True)
        finally:
            STATUS['is_updating'] = False
    
    def calculate_stats(self, current_time: str):
        """计算各时间段的统计数据"""
        dt = datetime.fromisoformat(current_time)
        
        # 每小时都计算
        logger.info("计算小时统计...")
        self.db.calculate_and_store_stats('hour', current_time)
        
        # 每天计算日统计（可以在任何时间计算，不必等到00:00）
        logger.info("计算日统计...")
        self.db.calculate_and_store_stats('day', current_time)
        
        # 每周计算周统计
        logger.info("计算周统计...")
        self.db.calculate_and_store_stats('week', current_time)
        
        # 每月计算月统计
        logger.info("计算月统计...")
        self.db.calculate_and_store_stats('month', current_time)
    
    def run_scheduled_tasks(self):
        """运行定时任务"""
        self.is_running = True
        
        # 首次启动时立即执行一次
        logger.info("=" * 50)
        logger.info("Phira 热度统计系统启动")
        logger.info(f"配置: 更新间隔={CONFIG['interval']}秒, 线程数={CONFIG['max_workers']}, 全量模式={CONFIG['all_mode']}")
        logger.info("=" * 50)
        
        logger.info("执行初始数据收集...")
        self.fetch_all_charts()
        self.update_all_records()
        
        last_chart_update = time.time()
        last_record_update = time.time()
        
        logger.info(f"定时任务已启动，谱面列表更新间隔: {CONFIG['chart_list_interval']}秒, 记录更新间隔: {CONFIG['interval']}秒")
        
        while self.is_running and not self.stop_event.is_set():
            try:
                current = time.time()
                
                # 检查是否需要更新谱面列表
                if current - last_chart_update >= CONFIG['chart_list_interval']:
                    logger.info("定时更新谱面列表")
                    self.fetch_all_charts()
                    last_chart_update = current
                
                # 检查是否需要更新游玩记录
                if current - last_record_update >= CONFIG['interval']:
                    logger.info("定时更新游玩记录")
                    self.update_all_records()
                    last_record_update = current
                
                # 每10秒检查一次
                time.sleep(10)
                
            except Exception as e:
                logger.error(f"定时任务执行出错: {e}", exc_info=True)
                time.sleep(60)  # 出错后等待1分钟
        
        logger.info("定时任务已停止")
    
    def stop(self):
        """停止定时任务"""
        self.is_running = False
        self.stop_event.set()


# 初始化数据库和收集器
db = Database(CONFIG['db_path'])
collector = DataCollector(db)


# Flask API路由
@app.route('/status', methods=['GET'])
def get_status():
    """获取服务状态"""
    return jsonify({
        'last_chart_list_update': STATUS['last_chart_list_update'],
        'last_record_update': STATUS['last_record_update'],
        'cached_charts_count': STATUS['cached_charts_count'],
        'queue_size': STATUS['queue_size'],
        'update_interval': CONFIG['update_interval'],
        'interval': CONFIG['interval'],
        'chart_list_interval': CONFIG['chart_list_interval'],
        'per_page': CONFIG['per_page'],
        'all_mode': CONFIG['all_mode'],
        'is_updating': STATUS['is_updating'],
        'error_count': STATUS['error_count']
    })


@app.route('/hot_rank/<time_range>', methods=['GET'])
def get_hot_rank(time_range):
    """获取热门排行榜"""
    if time_range not in ['hour', 'day', 'week', 'month']:
        return jsonify({'error': 'Invalid time range'}), 400
    
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    
    if page < 1:
        page = 1
    if per_page < 1 or per_page > 100:
        per_page = 20
    
    results = db.get_hot_rank(time_range, page, per_page)
    
    return jsonify({
        'last_chart_list_update': STATUS['last_chart_list_update'],
        'last_record_update': STATUS['last_record_update'],
        'page': page,
        'per_page': per_page,
        'results': results,
        'time_range': time_range,
        'total_results': len(results)
    })


@app.route('/chart/<int:chart_id>/stats', methods=['GET'])
def get_chart_stats(chart_id):
    """获取指定谱面的统计信息"""
    stats = db.get_chart_stats(chart_id)
    
    return jsonify({
        'chart_id': chart_id,
        'stats': stats,
        'last_chart_list_update': STATUS['last_chart_list_update'],
        'last_record_update': STATUS['last_record_update']
    })


@app.route('/debug/charts', methods=['GET'])
def debug_charts():
    """调试：查看数据库中的谱面"""
    limit = request.args.get('limit', 10, type=int)
    
    conn = db.get_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM charts ORDER BY id LIMIT ?', (limit,))
    charts = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    return jsonify({
        'total_charts': STATUS['cached_charts_count'],
        'sample_charts': charts
    })


@app.route('/debug/records', methods=['GET'])
def debug_records():
    """调试：查看最近的记录"""
    limit = request.args.get('limit', 10, type=int)
    
    conn = db.get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT * FROM hourly_records 
        ORDER BY timestamp DESC, increase DESC 
        LIMIT ?
    ''', (limit,))
    records = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    return jsonify({
        'recent_records': records
    })


def run_flask_app():
    """运行Flask应用"""
    logger.info("启动Flask API服务器 (端口7002)")
    app.run(host='0.0.0.0', port=7002, debug=False, threaded=True, use_reloader=False)


def main():
    """主函数"""
    # 在后台线程运行数据收集
    collector_thread = threading.Thread(target=collector.run_scheduled_tasks, daemon=True)
    collector_thread.start()
    
    # 等待一下让初始数据收集完成
    time.sleep(5)
    
    # 运行Flask应用（主线程）
    try:
        run_flask_app()
    except KeyboardInterrupt:
        logger.info("收到停止信号")
        collector.stop()
        logger.info("系统已关闭")


if __name__ == '__main__':
    main()
