import asyncio
import aiohttp
import time
import json
from datetime import datetime, timedelta
from flask import Flask, jsonify, request
import threading
from typing import Dict, Optional, List, Tuple
import logging
from collections import deque
import statistics

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class ServerStatusMonitor:
    def __init__(self, username: str, password: str, check_interval: int = 600, history_hours: int = 48):
        """
        初始化服务器状态监控器
        
        Args:
            username: 服务器用户名
            password: 服务器密码
            check_interval: 检查间隔（秒），默认600秒（10分钟）
            history_hours: 历史数据保留小时数，默认48小时
        """
        self.username = username
        self.password = password
        self.check_interval = check_interval
        self.history_hours = history_hours
        
        # 计算最大历史数据点数
        checks_per_hour = 3600 // check_interval
        self.max_history_points = history_hours * checks_per_hour
        
        # 历史数据存储（使用deque自动清理旧数据）
        self.history_data = deque(maxlen=self.max_history_points)
        self.history_lock = threading.Lock()
        
        # 当前状态
        self.last_check_time: Optional[float] = None
        self.last_status: Dict = {
            "online": False,
            "latency": None,
            "last_check": None,
            "error_message": None
        }
        
        # 监控控制
        self.is_running = False
        self.check_thread: Optional[threading.Thread] = None
        
        # 服务器配置
        self.login_url = "https://phira.5wyxi.com/login"
        self.server_host = "service.htadiy.cc"
        self.server_port = 7865

    async def _perform_status_check(self) -> Dict:
        """执行服务器状态检查并返回结果"""
        start_time = time.time()
        token = None
        reader = None
        writer = None
        
        try:
            # 第一步：登录获取token
            async with aiohttp.ClientSession() as session:
                login_data = {
                    "email": self.username,
                    "password": self.password
                }
                
                async with session.post(
                    self.login_url, 
                    json=login_data,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status != 200:
                        return {
                            "online": False,
                            "latency": None,
                            "error_message": f"登录失败，状态码: {response.status}"
                        }
                    
                    result = await response.json()
                    token = result.get("token")
                    
                    if not token:
                        return {
                            "online": False,
                            "latency": None,
                            "error_message": "获取token失败"
                        }
            
            # 第二步：连接服务器检查状态
            token_hex = token.encode('utf-8').hex()
            connect_start = time.time()
            
            try:
                reader, writer = await asyncio.wait_for(
                    asyncio.open_connection(self.server_host, self.server_port),
                    timeout=10.0
                )
                connect_time = time.time() - connect_start
                
            except (ConnectionRefusedError, OSError, asyncio.TimeoutError) as e:
                return {
                    "online": False,
                    "latency": None,
                    "error_message": f"连接被拒绝: {str(e)}"
                }
            
            # 第三步：发送验证包并测量延迟
            header = bytes.fromhex('01160114')
            token_bytes = bytes.fromhex(token_hex)
            packet = header + token_bytes
            
            send_start = time.time()
            writer.write(packet)
            await writer.drain()
            
            try:
                response = await asyncio.wait_for(reader.read(1024), timeout=5.0)
                receive_time = time.time()
                latency = (receive_time - send_start) * 1000  # 转换为毫秒
                
                if response:
                    return {
                        "online": True,
                        "latency": round(latency, 2),
                        "error_message": None
                    }
                else:
                    return {
                        "online": False,
                        "latency": None,
                        "error_message": "服务器无响应"
                    }
                    
            except asyncio.TimeoutError:
                return {
                    "online": False,
                    "latency": None,
                    "error_message": "服务器响应超时"
                }
                
        except Exception as e:
            return {
                "online": False,
                "latency": None,
                "error_message": f"检查过程中发生错误: {str(e)}"
            }
        finally:
            # 清理资源
            if writer and not writer.is_closing():
                writer.close()
                try:
                    await writer.wait_closed()
                except:
                    pass

    def _add_to_history(self, status_data: Dict):
        """将检查结果添加到历史记录"""
        with self.history_lock:
            # 创建历史记录条目
            history_entry = {
                "timestamp": datetime.now().isoformat(),
                "online": status_data.get("online", False),
                "latency_ms": status_data.get("latency"),
                "error_message": status_data.get("error_message")
            }
            
            # 移除空值字段
            if history_entry["error_message"] is None:
                del history_entry["error_message"]
            
            # 添加到历史记录
            self.history_data.append(history_entry)
            logger.debug(f"已添加到历史记录: {history_entry}")

    def _clean_old_history(self):
        """清理过期历史数据"""
        with self.history_lock:
            cutoff_time = datetime.now() - timedelta(hours=self.history_hours)
            
            # 由于使用了deque，当达到最大长度时会自动移除最旧的数据
            # 这里我们只需要确保记录的时间戳是有效的
            current_count = len(self.history_data)
            if current_count > 0:
                logger.info(f"当前历史记录数量: {current_count}/{self.max_history_points}")

    def _get_history_summary(self, data_points: List[Dict]) -> Dict:
        """计算历史数据统计摘要"""
        if not data_points:
            return {
                "total_points": 0,
                "online_points": 0,
                "offline_points": 0,
                "availability_rate": 0.0,
                "avg_latency": None,
                "max_latency": None,
                "min_latency": None
            }
        
        # 统计数据
        total_points = len(data_points)
        online_points = sum(1 for point in data_points if point.get("online", False))
        offline_points = total_points - online_points
        availability_rate = (online_points / total_points * 100) if total_points > 0 else 0.0
        
        # 计算延迟统计
        latencies = [point["latency_ms"] for point in data_points 
                     if point.get("online", False) and point.get("latency_ms") is not None]
        
        avg_latency = round(statistics.mean(latencies), 2) if latencies else None
        max_latency = max(latencies) if latencies else None
        min_latency = min(latencies) if latencies else None
        
        return {
            "total_points": total_points,
            "online_points": online_points,
            "offline_points": offline_points,
            "availability_rate": round(availability_rate, 2),
            "avg_latency": avg_latency,
            "max_latency": max_latency,
            "min_latency": min_latency
        }

    def _check_wrapper(self):
        """包装异步检查函数供线程使用"""
        async def run_check():
            result = await self._perform_status_check()
            
            # 添加时间戳
            result["last_check"] = datetime.now().isoformat()
            result["total_check_time"] = time.time() - self.last_check_time if self.last_check_time else 0
            
            # 更新当前状态
            self.last_status = result
            
            # 添加到历史记录
            self._add_to_history(result)
            
            # 清理过期数据
            self._clean_old_history()
            
            logger.info(f"服务器状态检查完成: 在线={result['online']}, 延迟={result.get('latency', 'N/A')}ms")
        
        # 在新的事件循环中运行
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(run_check())
        except Exception as e:
            logger.error(f"检查任务执行失败: {str(e)}")
        finally:
            loop.close()

    def _scheduled_check(self):
        """定时检查任务"""
        while self.is_running:
            try:
                self.last_check_time = time.time()
                self._check_wrapper()
            except Exception as e:
                logger.error(f"定时检查任务出错: {str(e)}")
                self.last_status = {
                    "online": False,
                    "latency": None,
                    "last_check": datetime.now().isoformat(),
                    "error_message": f"检查任务异常: {str(e)}"
                }
            
            # 等待下一个检查周期
            time.sleep(self.check_interval)

    def start_monitoring(self):
        """启动监控"""
        if self.is_running:
            logger.warning("监控已经在运行中")
            return
        
        self.is_running = True
        self.check_thread = threading.Thread(target=self._scheduled_check, daemon=True)
        self.check_thread.start()
        logger.info(f"服务器状态监控已启动，检查间隔: {self.check_interval}秒，历史数据保留: {self.history_hours}小时")

    def stop_monitoring(self):
        """停止监控"""
        self.is_running = False
        if self.check_thread:
            self.check_thread.join(timeout=5.0)
        logger.info("服务器状态监控已停止")

    def get_status(self) -> Dict:
        """获取当前服务器状态"""
        return self.last_status

    def get_history(self, hours: Optional[int] = None) -> Dict:
        """
        获取历史数据
        
        Args:
            hours: 返回多少小时的数据，None表示返回全部数据
            
        Returns:
            包含历史数据和统计信息的字典
        """
        with self.history_lock:
            # 复制当前历史数据
            all_data = list(self.history_data)
        
        # 如果指定了小时数，过滤数据
        if hours is not None and hours > 0:
            cutoff_time = datetime.now() - timedelta(hours=hours)
            filtered_data = [
                point for point in all_data
                if datetime.fromisoformat(point["timestamp"]) >= cutoff_time
            ]
        else:
            filtered_data = all_data
        
        # 按时间戳降序排序（最新的在前）
        filtered_data.sort(key=lambda x: x["timestamp"], reverse=True)
        
        # 计算统计信息
        summary = self._get_history_summary(filtered_data)
        
        return {
            "server_name": "HSNPhira",
            "data_points": filtered_data,
            "summary": summary
        }


# 创建Flask应用和监控实例
app = Flask(__name__)
monitor: Optional[ServerStatusMonitor] = None

@app.route('/api/status', methods=['GET'])
def get_server_status():
    """API接口：获取当前服务器状态"""
    if monitor is None:
        return jsonify({
            "error": "监控服务未初始化",
            "online": False,
            "latency": None
        }), 500
    
    status = monitor.get_status()
    
    # 构建响应数据
    response_data = {
        "online": status["online"],
        "latency_ms": status.get("latency"),
        "last_check": status.get("last_check"),
        "server_name": "HSNPhira",
        "timestamp": datetime.now().isoformat()
    }
    
    if status.get("error_message"):
        response_data["error_message"] = status["error_message"]
    
    return jsonify(response_data)

@app.route('/api/history', methods=['GET'])
def get_server_history():
    """API接口：获取历史延迟数据"""
    if monitor is None:
        return jsonify({
            "error": "监控服务未初始化",
            "data_points": [],
            "summary": {}
        }), 500
    
    # 获取查询参数
    hours = request.args.get('hours', type=int, default=48)
    
    # 限制查询范围
    if hours <= 0:
        return jsonify({
            "error": "hours参数必须大于0",
            "data_points": [],
            "summary": {}
        }), 400
    
    # 获取历史数据
    history_data = monitor.get_history(hours)
    
    return jsonify(history_data)

@app.route('/api/health', methods=['GET'])
def health_check():
    """健康检查端点"""
    if monitor is None or not monitor.is_running:
        status = "unhealthy"
    else:
        status = "healthy"
    
    return jsonify({
        "status": status,
        "service": "server_status_monitor",
        "timestamp": datetime.now().isoformat(),
        "check_interval_seconds": monitor.check_interval if monitor else None,
        "history_hours": monitor.history_hours if monitor else None
    })

@app.route('/', methods=['GET'])
def index():
    """根路径返回基本信息"""
    return jsonify({
        "service": "CK服务器状态监控API",
        "version": "1.1.0",
        "features": [
            "每10分钟自动检查服务器状态",
            "保留48小时历史延迟数据",
            "提供实时状态和历史数据API"
        ],
        "endpoints": {
            "/api/status": "获取当前服务器状态和延迟",
            "/api/history": "获取历史延迟数据和统计（可指定hours参数）",
            "/api/health": "服务健康检查"
        },
        "parameters": {
            "check_interval": "600秒（10分钟）",
            "history_retention": "48小时",
            "max_data_points": "288个数据点"
        }
    })

def main():
    """主函数"""
    global monitor
    
    # 配置参数
    USERNAME = "fucked"  # 替换为实际用户名
    PASSWORD = "fucked"  # 替换为实际密码
    CHECK_INTERVAL = 600  # 检查间隔（10分钟，600秒）
    HISTORY_HOURS = 48    # 历史数据保留小时数
    API_PORT = 5000       # API服务端口
    API_HOST = "0.0.0.0"  # 监听地址
    
    # 创建监控实例
    monitor = ServerStatusMonitor(
        username=USERNAME,
        password=PASSWORD,
        check_interval=CHECK_INTERVAL,
        history_hours=HISTORY_HOURS
    )
    
    try:
        # 启动监控
        monitor.start_monitoring()
        logger.info(f"启动服务器状态监控")
        logger.info(f"检查间隔: {CHECK_INTERVAL}秒 ({CHECK_INTERVAL/60}分钟)")
        logger.info(f"历史数据保留: {HISTORY_HOURS}小时")
        logger.info(f"API服务端口: {API_PORT}")
        
        # 启动Flask应用
        app.run(
            host=API_HOST,
            port=API_PORT,
            debug=False,
            use_reloader=False
        )
        
    except KeyboardInterrupt:
        logger.info("收到中断信号，正在关闭服务...")
    except Exception as e:
        logger.error(f"服务运行错误: {str(e)}")
    finally:
        if monitor:
            monitor.stop_monitoring()
        logger.info("服务已关闭")

if __name__ == "__main__":
    main()
