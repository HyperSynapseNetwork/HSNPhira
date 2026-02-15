import asyncio
import socket
import time
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any
from threading import Thread
import json

import aiohttp
from flask import Flask, jsonify, request

# ============================================================================
# 配置参数
# ============================================================================

# 服务器认证凭据
EMAIL = "fuckingemail"      # Phira登录邮箱
PASSWORD = "fuckingpassword"            # Phira登录密码

# TCP服务器配置
TCP_HOST = "127.0.0.1"       # TCP服务器地址
TCP_PORT = 7865                       # TCP服务器端口

# API服务配置
API_PORT = 5211                       # API服务端口
API_HOST = "0.0.0.0"                  # API服务监听地址

# 监控配置
CHECK_INTERVAL = 600                  # 检查间隔（10分钟，600秒）
HISTORY_HOURS = 48                    # 历史数据保留小时数

# 登录API配置
LOGIN_URL = "http://phira.5wyxi.com/login"

# 服务器名称
SERVER_NAME = "HSN多人联机服务器"

# ============================================================================
# 日志配置
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================================================
# 服务器状态监控类
# ============================================================================

class ServerStatusMonitor:
    """服务器状态监控管理类"""
    
    def __init__(self):
        """初始化监控器"""
        self.current_status = {
            "online": False,
            "latency_ms": None,
            "last_check": None,
            "server_name": SERVER_NAME,
            "error_message": None
        }
        self.history_data: List[Dict[str, Any]] = []
        self.running = False
        self.monitor_thread = None
        
    def start(self):
        """启动监控线程"""
        if not self.running:
            self.running = True
            self.monitor_thread = Thread(target=self._monitor_loop, daemon=True)
            self.monitor_thread.start()
            logger.info("服务器状态监控已启动")
    
    def stop(self):
        """停止监控线程"""
        self.running = False
        if self.monitor_thread:
            self.monitor_thread.join(timeout=5)
        logger.info("服务器状态监控已停止")
    
    def _monitor_loop(self):
        """监控循环"""
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        # 立即执行一次检查
        loop.run_until_complete(self._check_server_status())
        
        while self.running:
            try:
                time.sleep(CHECK_INTERVAL)
                if self.running:
                    loop.run_until_complete(self._check_server_status())
            except Exception as e:
                logger.error(f"监控循环错误: {e}", exc_info=True)
        
        loop.close()
    
    async def _check_server_status(self):
        """检查服务器状态"""
        logger.info("开始检查服务器状态...")
        
        try:
            # 步骤1: 登录获取token
            token = await self._login()
            if not token:
                raise Exception("登录失败，未获取到token")
            
            # 步骤2: 将token转为hex格式
            token_hex = token.encode('utf-8').hex()
            
            # 步骤3: TCP连接并发送数据
            start_time = time.time()
        
            await self._tcp_check(token_hex)
            
            # 计算延迟
            latency = (time.time() - start_time) * 1000
            
            # 更新状态
            self.current_status = {
                "online": True,
                "latency_ms": round(latency, 2),
                "last_check": datetime.utcnow().isoformat() + "Z",
                "server_name": SERVER_NAME,
                "error_message": None
            }
            
            # 记录历史
            self._add_history_point({
                "timestamp": self.current_status["last_check"],
                "online": True,
                "latency_ms": self.current_status["latency_ms"]
            })
            
            logger.info(f"服务器在线，延迟: {latency:.2f}ms")
            
        except Exception as e:
            error_msg = str(e)
            logger.error(f"服务器状态检查失败: {error_msg}")
            
            # 更新状态为离线
            self.current_status = {
                "online": False,
                "latency_ms": None,
                "last_check": datetime.utcnow().isoformat() + "Z",
                "server_name": SERVER_NAME,
                "error_message": error_msg
            }
            
            # 记录历史
            self._add_history_point({
                "timestamp": self.current_status["last_check"],
                "online": False,
                "latency_ms": None,
                "error_message": error_msg
            })
    
    async def _login(self) -> Optional[str]:
        """登录获取token"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    LOGIN_URL,
                    json={"email": EMAIL, "password": PASSWORD},
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status != 200:
                        raise Exception(f"登录请求失败，状态码: {response.status}")
                    
                    data = await response.json()
                    token = data.get("token")
                    
                    if not token:
                        raise Exception("响应中未找到token字段")
                    
                    logger.info("登录成功，已获取token")
                    return token
                    
        except Exception as e:
            logger.error(f"登录失败: {e}")
            raise Exception(f"登录失败: {e}")
    
    async def _tcp_check(self, token_hex: str):
        """TCP连接检查"""
        try:
            # 创建TCP连接
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(TCP_HOST, TCP_PORT),
                timeout=10
            )
            
            try:
                # 构造数据包: 01 16 01 14 + token_hex
                packet = bytes.fromhex("01160114") + bytes.fromhex(token_hex)
                
                # 发送数据包
                writer.write(packet)
                await writer.drain()
                
                # 等待响应（可选，根据实际协议需求）
                # 这里简单等待一小段时间确认连接成功
                await asyncio.sleep(0.5)
                
                logger.info("TCP连接成功，数据包已发送")
                
            finally:
                # 关闭连接
                writer.close()
                await writer.wait_closed()
                
        except asyncio.TimeoutError:
            raise Exception(f"TCP连接超时: {TCP_HOST}:{TCP_PORT}")
        except Exception as e:
            raise Exception(f"TCP连接失败: {e}")
    
    def _add_history_point(self, data_point: Dict[str, Any]):
        """添加历史数据点"""
        self.history_data.append(data_point)
        
        # 清理过期数据
        cutoff_time = datetime.utcnow() - timedelta(hours=HISTORY_HOURS)
        self.history_data = [
            point for point in self.history_data
            if datetime.fromisoformat(point["timestamp"].replace("Z", "")) > cutoff_time
        ]
        
        logger.debug(f"历史数据点数: {len(self.history_data)}")
    
    def get_current_status(self) -> Dict[str, Any]:
        """获取当前状态"""
        status = self.current_status.copy()
        status["timestamp"] = datetime.utcnow().isoformat() + "Z"
        # 移除error_message字段（只在历史数据中保留）
        if "error_message" in status:
            del status["error_message"]
        return status
    
    def get_history(self, hours: Optional[int] = None) -> Dict[str, Any]:
        """获取历史数据"""
        if hours is None:
            hours = HISTORY_HOURS
        
        # 过滤指定时间范围的数据
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        filtered_data = [
            point for point in self.history_data
            if datetime.fromisoformat(point["timestamp"].replace("Z", "")) > cutoff_time
        ]
        
        # 计算统计信息
        total_points = len(filtered_data)
        online_points = sum(1 for p in filtered_data if p["online"])
        offline_points = total_points - online_points
        
        # 计算延迟统计（仅在线数据）
        online_latencies = [p["latency_ms"] for p in filtered_data if p["online"] and p["latency_ms"] is not None]
        
        if online_latencies:
            avg_latency = round(sum(online_latencies) / len(online_latencies), 2)
            max_latency = round(max(online_latencies), 2)
            min_latency = round(min(online_latencies), 2)
        else:
            avg_latency = None
            max_latency = None
            min_latency = None
        
        # 计算可用率
        availability_rate = round((online_points / total_points * 100), 2) if total_points > 0 else 0.0
        
        return {
            "server_name": SERVER_NAME,
            "data_points": filtered_data,
            "summary": {
                "total_points": total_points,
                "online_points": online_points,
                "offline_points": offline_points,
                "availability_rate": availability_rate,
                "avg_latency": avg_latency,
                "max_latency": max_latency,
                "min_latency": min_latency
            }
        }

# ============================================================================
# Flask API 应用
# ============================================================================

app = Flask(__name__)
monitor = ServerStatusMonitor()

@app.route('/api/status', methods=['GET'])
def get_status():
    """获取当前服务器状态"""
    try:
        status = monitor.get_current_status()
        return jsonify(status), 200
    except Exception as e:
        logger.error(f"获取状态失败: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/history', methods=['GET'])
def get_history():
    """获取历史延迟数据"""
    try:
        hours = request.args.get('hours', type=int)
        if hours is not None and hours <= 0:
            return jsonify({"error": "hours参数必须大于0"}), 400
        
        history = monitor.get_history(hours)
        return jsonify(history), 200
    except Exception as e:
        logger.error(f"获取历史数据失败: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """服务健康检查"""
    return jsonify({
        "status": "healthy",
        "service": "Phira Server Monitor",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "monitoring_active": monitor.running
    }), 200

@app.route('/', methods=['GET'])
def index():
    """根路径"""
    return jsonify({
        "service": "Phira Server Status Monitor API",
        "version": "1.0.0",
        "endpoints": {
            "status": "/api/status",
            "history": "/api/history",
            "health": "/api/health"
        }
    }), 200

# ============================================================================
# 主程序
# ============================================================================

def main():
    """主函数"""
    logger.info("=" * 60)
    logger.info("Phira多人联机服务器状态监控API服务")
    logger.info("=" * 60)
    logger.info(f"API端口: {API_PORT}")
    logger.info(f"检查间隔: {CHECK_INTERVAL}秒")
    logger.info(f"历史数据保留: {HISTORY_HOURS}小时")
    logger.info(f"TCP服务器: {TCP_HOST}:{TCP_PORT}")
    logger.info("=" * 60)
    
    # 启动监控
    monitor.start()
    
    try:
        # 启动Flask应用
        logger.info(f"启动API服务，监听 {API_HOST}:{API_PORT}")
        app.run(host=API_HOST, port=API_PORT, debug=False, threaded=True)
    except KeyboardInterrupt:
        logger.info("收到退出信号")
    finally:
        monitor.stop()
        logger.info("服务已停止")

if __name__ == "__main__":
    main()
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
