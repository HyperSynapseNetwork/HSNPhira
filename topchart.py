import asyncio
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
from collections import deque

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 全局变量
DB_PATH = "phira_stats.db"
BASE_URL = "http://phira.5wyxi.com"
CHART_API = "/chart?pageNum=30&order=-updated&page={page}"
RECORD_API = "/record/query/{chart_id}?pageNum=20&includePlayer=true&best=true&page=1&std=false"
UPDATE_INTERVAL = 3600  # 1小时
CHART_LIST_INTERVAL = 86400  # 24小时
PER_PAGE = 30

# 数据库初始化
async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        # 谱面表 - 简化，只存必要信息
        await db.execute("""
            CREATE TABLE IF NOT EXISTS charts (
                id INTEGER PRIMARY KEY,
                last_count INTEGER DEFAULT 0,
                last_updated TEXT
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
        
        # 创建索引
        await db.execute("CREATE INDEX IF NOT EXISTS idx_stats_hourly_chart_time ON stats_hourly(chart_id, timestamp)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_stats_daily_chart_date ON stats_daily(chart_id, date)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_stats_weekly_chart_week ON stats_weekly(chart_id, week_start)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_stats_monthly_chart_month ON stats_monthly(chart_id, month_start)")
        
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
                "SELECT id, last_count FROM charts WHERE id = ?",
                (chart_id,)
            )
            row = await cursor.fetchone()
            if row:
                return {
                    "id": row[0],
                    "last_count": row[1]
                }
            return None
            
    async def save_chart(self, chart_id: int, count: int, timestamp: str):
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(
                """INSERT OR REPLACE INTO charts (id, last_count, last_updated)
                   VALUES (?, ?, ?)""",
                (chart_id, count, timestamp)
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
                """SELECT chart_id, count, timestamp 
                   FROM stats_hourly 
                   WHERE chart_id = ? 
                   ORDER BY timestamp DESC LIMIT 1""",
                (chart_id,)
            )
            row = await cursor.fetchone()
            if row:
                return {
                    "chart_id": row[0],
                    "count": row[1],
                    "timestamp": row[2]
                }
            return None
            
    async def get_chart_stats(self, chart_id: int, time_range: str = "hour") -> Dict:
        """获取指定谱面在指定时间范围内的统计数据"""
        if time_range not in ["hour", "day", "week", "month"]:
            raise ValueError("Invalid time range")
            
        async with aiosqlite.connect(self.db_path) as db:
            if time_range == "hour":
                # 获取最近一小时的数据
                query = """
                    SELECT SUM(increase) as total_increase
                    FROM stats_hourly 
                    WHERE chart_id = ? 
                    AND timestamp >= datetime('now', '-1 hour')
                """
            elif time_range == "day":
                # 获取最近24小时的数据
                query = """
                    SELECT SUM(increase) as total_increase
                    FROM stats_hourly 
                    WHERE chart_id = ? 
                    AND timestamp >= datetime('now', '-1 day')
                """
            elif time_range == "week":
                # 获取最近一周的数据
                cursor = await db.execute(
                    "SELECT SUM(increase) FROM stats_weekly WHERE chart_id = ? AND week_start >= date('now', '-7 days')",
                    (chart_id,)
                )
                result = await cursor.fetchone()
                return {"increase": result[0] or 0 if result else 0}
            elif time_range == "month":
                # 获取最近一个月的数据
                cursor = await db.execute(
                    "SELECT SUM(increase) FROM stats_monthly WHERE chart_id = ? AND month_start >= date('now', '-1 month')",
                    (chart_id,)
                )
                result = await cursor.fetchone()
                return {"increase": result[0] or 0 if result else 0}
            
            cursor = await db.execute(query, (chart_id,))
            result = await cursor.fetchone()
            return {"increase": result[0] or 0 if result else 0}
            
    async def get_all_chart_stats(self, time_range: str, page: int = 1, per_page: int = 20) -> Dict:
        """获取所有谱面在指定时间范围内的统计数据（分页）"""
        offset = (page - 1) * per_page
        
        if time_range not in ["hour", "day", "week", "month"]:
            raise ValueError("Invalid time range")
            
        async with aiosqlite.connect(self.db_path) as db:
            if time_range == "hour":
                # 获取最近一小时的数据
                query = """
                    SELECT chart_id, SUM(increase) as total_increase
                    FROM stats_hourly 
                    WHERE timestamp >= datetime('now', '-1 hour')
                    GROUP BY chart_id
                    ORDER BY total_increase DESC
                    LIMIT ? OFFSET ?
                """
            elif time_range == "day":
                # 获取最近24小时的数据
                query = """
                    SELECT chart_id, SUM(increase) as total_increase
                    FROM stats_hourly 
                    WHERE timestamp >= datetime('now', '-1 day')
                    GROUP BY chart_id
                    ORDER BY total_increase DESC
                    LIMIT ? OFFSET ?
                """
            elif time_range == "week":
                query = """
                    SELECT chart_id, SUM(increase) as total_increase
                    FROM stats_weekly 
                    WHERE week_start >= date('now', '-7 days')
                    GROUP BY chart_id
                    ORDER BY total_increase DESC
                    LIMIT ? OFFSET ?
                """
            elif time_range == "month":
                query = """
                    SELECT chart_id, SUM(increase) as total_increase
                    FROM stats_monthly 
                    WHERE month_start >= date('now', '-1 month')
                    GROUP BY chart_id
                    ORDER BY total_increase DESC
                    LIMIT ? OFFSET ?
                """
            
            cursor = await db.execute(query, (per_page, offset))
            results = []
            async for row in cursor:
                results.append({
                    "chart_id": row[0],
                    "increase": row[1] or 0
                })
                
            return {
                "page": page,
                "per_page": per_page,
                "results": results,
                "time_range": time_range,
                "total_results": len(results)
            }
            
    async def get_comprehensive_stats(self, chart_id: int) -> Dict:
        """获取谱面在所有时间范围内的综合统计数据"""
        stats = {}
        for time_range in ["hour", "day", "week", "month"]:
            data = await self.get_chart_stats(chart_id, time_range)
            stats[f"{time_range}_increase"] = data.get("increase", 0)
        
        # 获取最新计数
        chart = await self.get_chart(chart_id)
        stats["last_count"] = chart.get("last_count", 0) if chart else 0
        
        return stats
            
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
            
    async def calculate_daily_stats(self):
        """计算天级统计"""
        now = datetime.now()
        yesterday = now - timedelta(days=1)
        date_str = yesterday.strftime("%Y-%m-%d")
        
        async with aiosqlite.connect(self.db_path) as db:
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
        
        async with aiosqlite.connect(self.db_path) as db:
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
        
        async with aiosqlite.connect(self.db_path) as db:
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
        self.update_queue = deque()
        
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
                
                # 检查是否还有下一页
                if len(data["results"]) < PER_PAGE:
                    break
                page += 1
                
        # 更新队列
        self.update_queue = deque(chart_ids)
        self.cached_charts_count = len(chart_ids)
        self.last_chart_list_update = current_time
        await self.db.update_config("last_chart_list_update", current_time)
        logger.info(f"谱面列表更新完成, 共 {self.cached_charts_count} 个谱面, 队列大小: {len(self.update_queue)}")
        
    async def update_single_chart_records(self, chart_id: int):
        """更新单个谱面的游玩记录"""
        async with PhiraClient() as client:
            data = await self.client.get_records(chart_id)
            if not data:
                return None
                
            current_count = data["count"]
            current_time = datetime.now().isoformat()
            
            # 获取上次统计
            last_stat = await self.db.get_last_hourly_stat(chart_id)
            last_count = last_stat["count"] if last_stat else 0
            increase = max(0, current_count - last_count)  # 确保增量非负
            
            # 保存小时统计
            await self.db.save_hourly_stat(chart_id, current_count, increase, current_time)
            
            # 更新谱面的最新计数
            await self.db.save_chart(chart_id, current_count, current_time)
            
            self.last_record_update = current_time
            await self.db.update_config("last_record_update", current_time)
            
            logger.info(f"谱面 {chart_id} 更新完成: count={current_count}, increase={increase}")
            return current_count
            
    async def process_all_charts(self):
        """处理所有谱面（异步并发）"""
        logger.info("开始处理所有谱面游玩记录")
        start_time = time.time()
        
        # 从队列中获取谱面ID
        chart_ids = list(self.update_queue)
        self.queue_size = len(chart_ids)
        
        if not chart_ids:
            logger.info("没有谱面需要更新")
            return
            
        # 并发处理
        semaphore = asyncio.Semaphore(5)  # 限制并发数
        
        async def process_chart(chart_id):
            async with semaphore:
                try:
                    result = await self.update_single_chart_records(chart_id)
                    if result is not None:
                        # 从队列中移除
                        if chart_id in self.update_queue:
                            self.update_queue.remove(chart_id)
                        self.queue_size = len(self.update_queue)
                except Exception as e:
                    logger.error(f"处理谱面 {chart_id} 失败: {e}")
                    
        # 每次最多处理100个谱面
        batch = chart_ids[:100]
        tasks = [process_chart(chart_id) for chart_id in batch]
        await asyncio.gather(*tasks, return_exceptions=True)
        
        logger.info(f"谱面处理完成, 处理了 {len(batch)} 个谱面, 耗时: {time.time() - start_time:.2f}秒")
        self.queue_size = len(self.update_queue)
        
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
            self.db.calculate_daily_stats,
            "cron",
            hour=0,
            minute=0,
            id="calculate_daily_stats"
        )
        
        self.scheduler.add_job(
            self.db.calculate_weekly_stats,
            "cron",
            day_of_week=0,  # 每周日
            hour=0,
            minute=0,
            id="calculate_weekly_stats"
        )
        
        self.scheduler.add_job(
            self.db.calculate_monthly_stats,
            "cron",
            day=1,  # 每月1号
            hour=0,
            minute=0,
            id="calculate_monthly_stats"
        )
        
        self.scheduler.start()
        
        # 立即执行一次初始化
        await self.update_chart_list()
        if self.update_queue:
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
    """获取热门排行榜"""
    if time_range not in ["hour", "day", "week", "month"]:
        raise HTTPException(status_code=400, detail="Invalid time range")
        
    try:
        result = await service.db.get_all_chart_stats(time_range, page, per_page)
        result["last_chart_list_update"] = service.last_chart_list_update
        result["last_record_update"] = service.last_record_update
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/chart/{chart_id}/rank")
async def get_chart_rank(chart_id: int, time_range: str = "hour"):
    """获取指定谱面的排行榜数据"""
    if time_range not in ["hour", "day", "week", "month"]:
        raise HTTPException(status_code=400, detail="Invalid time range")
    
    # 检查谱面是否存在
    chart = await service.db.get_chart(chart_id)
    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")
    
    # 获取综合统计数据
    stats = await service.db.get_comprehensive_stats(chart_id)
    
    # 获取指定时间范围的增量
    time_stats = await service.db.get_chart_stats(chart_id, time_range)
    
    return {
        "chart_id": chart_id,
        "last_count": stats["last_count"],
        "increase": time_stats["increase"],
        "hour_increase": stats["hour_increase"],
        "day_increase": stats["day_increase"],
        "week_increase": stats["week_increase"],
        "month_increase": stats["month_increase"],
        "time_range": time_range
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7002)