import re
import time
import json
import threading
import os
import traceback
import logging
from datetime import datetime
from flask import Flask, jsonify
from collections import defaultdict

# ===================== 配置 =====================
LOG_FILE_PATH = "/root/phira-mp/server.log"
USER_INFO_PATH = "user_info.json"
ROOM_CLEANUP_INTERVAL = 60  # 秒，清理不活动房间
LOG_POLL_INTERVAL = 0.1     # 日志轮询间隔
REOPEN_INTERVAL = 10        # 重新打开日志文件间隔

# ===================== 初始化日志系统 =====================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger('RoomMonitor')

# ===================== 全局状态 =====================
# 房间扩展信息存储
room_state = {}   # room_name -> 当前状态
room_cycle = {}   # room_name -> True / False
room_chart = {}   # room_name -> 谱面名称
rooms = {}                     # room_name -> {host_id, host_name, created_at}
room_users = defaultdict(set)  # room_name -> set(user_ids)
user_room_map = {}             # user_id -> room_name
user_info = {}                 # user_id -> username
last_activity = {}             # room_name -> 最后活动时间戳
running = True                 # 控制线程退出

# 使用可重入锁支持嵌套锁定
lock = threading.RLock()

app = Flask(__name__)

# ===================== 预编译正则表达式 =====================
# 清理ANSI转义码
ANSI_ESCAPE_RE = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')

# 创建房间模式
CREATE_ROOM_RE = re.compile(r'user=(\d+)\s+room="([^"]+)"')

# 用户事件模式
USER_EVENT_RE = re.compile(r'Message\((JoinRoom|LeaveRoom) { user: (\d+), name: "(.*?)" }\)')

# 新房主模式
NEW_HOST_RE = re.compile(r'user:\s*(\d+)')

# 时间戳模式
TIMESTAMP_RE = re.compile(r'^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)')

# 房间解散模式
ROOM_DROP_RE = re.compile(r'room users all disconnected, dropping room')

# ===================== 用户信息持久化 =====================
def update_user_info(user_id, user_name):
    """更新用户信息，如果需要则保存"""
    if user_info.get(user_id) != user_name:
        user_info[user_id] = user_name
        save_user_info()
        logger.debug(f"Updated user info: {user_id} -> {user_name}")

def load_user_info():
    if os.path.exists(USER_INFO_PATH):
        try:
            with open(USER_INFO_PATH, "r") as f:
                data = json.load(f)
                for k, v in data.items():
                    user_info[int(k)] = v
                logger.info(f"Loaded {len(user_info)} user mappings")
        except Exception as e:
            logger.error(f"Failed to load user info: {str(e)}")
    else:
        logger.info("No existing user info found")

def save_user_info():
    try:
        with open(USER_INFO_PATH, "w") as f:
            json.dump({str(k): v for k, v in user_info.items()}, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to save user info: {str(e)}")

# ===================== 房间管理函数 =====================
def translate_state(raw):
    if raw in ("SelectChart", "WaitingForReady"):
        return "选谱中"
    elif raw in ("Playing",):
        return "进行中"
    return "未知"

def extract_room_name_from_line(line):
    m = re.search(r'room="([^"]+)"', line)
    return m.group(1) if m else None
    
def create_room(room_name, host_id):
    """创建新房间"""
    with lock:
        if room_name in rooms:
            logger.warning(f"Room already exists: {room_name}")
            return
        
        host_name = user_info.get(host_id, f"User{host_id}")
        rooms[room_name] = {
            'host_id': host_id,
            'host_name': host_name,
            'created_at': time.time()
        }
        room_users[room_name].add(host_id)
        user_room_map[host_id] = room_name
        last_activity[room_name] = time.time()
        logger.info(f"Room created: {room_name} by {host_name} ({host_id})")

def delete_room(room_name):
    """删除房间及其所有关联数据"""
    with lock:
        if room_name not in rooms:
            logger.warning(f"Room does not exist: {room_name}")
            return
        
        # 记录删除信息
        host_name = rooms[room_name]["host_name"]
        user_count = len(room_users.get(room_name, []))
        
        # 清理用户映射
        for user_id in list(room_users.get(room_name, [])):  # 使用 list() 避免并发修改问题
            if user_id in user_room_map and user_room_map[user_id] == room_name:
                del user_room_map[user_id]
        
        # 移除房间数据
        if room_name in rooms:
            del rooms[room_name]
        if room_name in room_users:
            del room_users[room_name]
        if room_name in last_activity:
            del last_activity[room_name]
        
        logger.info(f"Room deleted: {room_name} (host: {host_name}, users: {user_count})")

def add_user_to_room(user_id, user_name, room_name=None):
    """添加用户到房间"""
    with lock:
        # 如果房间名未指定，尝试从用户映射中获取
        if room_name is None:
            room_name = find_user_room(user_id)
            if not room_name:
                logger.warning(f"Cannot determine room for user {user_name} ({user_id})")
                return
        
        # 验证房间存在
        if room_name not in rooms:
            logger.warning(f"Room does not exist: {room_name}")
            return
        
        # 检查是否已在房间
        if user_id in room_users[room_name]:
            logger.debug(f"User already in room: {user_name} ({user_id}) in {room_name}")
            return
        
        # 添加用户
        room_users[room_name].add(user_id)
        user_room_map[user_id] = room_name
        last_activity[room_name] = time.time()
        logger.info(f"User joined: {user_name} ({user_id}) -> {room_name}")

def remove_user_from_room(user_id, room_name=None):
    """从房间移除用户"""
    with lock:
        # 获取房间名
        if room_name is None:
            room_name = find_user_room(user_id)
            if not room_name:
                logger.debug(f"User not in any room: {user_id}")
                return
        
        # 验证房间存在
        if room_name not in room_users:
            logger.debug(f"Room does not exist: {room_name}")
            return
        
        # 检查用户是否在房间
        if user_id not in room_users[room_name]:
            logger.debug(f"User not in room: {user_id} in {room_name}")
            return
        
        # 移除用户
        user_name = user_info.get(user_id, f"User{user_id}")
        room_users[room_name].discard(user_id)
        
        if user_id in user_room_map and user_room_map[user_id] == room_name:
            del user_room_map[user_id]
        
        last_activity[room_name] = time.time()
        logger.info(f"User left: {user_name} ({user_id}) <- {room_name}")
        
        # 如果房间为空则删除
        if not room_users[room_name]:
            delete_room(room_name)

        
        # 验证房间存在
        if room_name not in room_users:
            logger.debug(f"Room does not exist: {room_name}")
            return
        
        # 检查用户是否在房间
        if user_id not in room_users[room_name]:
            logger.debug(f"User not in room: {user_id} in {room_name}")
            return
        
        # 移除用户
        user_name = user_info.get(user_id, f"User{user_id}")
        room_users[room_name].discard(user_id)
        
        if user_id in user_room_map and user_room_map[user_id] == room_name:
            del user_room_map[user_id]
        
        last_activity[room_name] = time.time()
        logger.info(f"User left: {user_name} <- {room_name}")
        
        # 如果房间为空则删除
        if not room_users[room_name]:
            delete_room(room_name)

def update_room_host(room_name, new_host_id):
    """更新房间房主"""
    with lock:
        if room_name not in rooms:
            logger.warning(f"Room does not exist: {room_name}")
            return
        
        new_host_name = user_info.get(new_host_id, f"User{new_host_id}")
        rooms[room_name]['host_id'] = new_host_id
        rooms[room_name]['host_name'] = new_host_name
        last_activity[room_name] = time.time()
        logger.info(f"New host for {room_name}: {new_host_name}")

def find_user_room(user_id):
    """查找用户所在的房间"""
    # 首先检查直接映射
    if user_id in user_room_map:
        room_name = user_room_map[user_id]
        logger.debug(f"Found room via direct mapping: {user_id} -> {room_name}")
        return room_name
    
    # 然后搜索所有房间
    with lock:
        for room_name, users in room_users.items():
            if user_id in users:
                logger.debug(f"Found room via room_users: {user_id} -> {room_name}")
                return room_name
    
    logger.debug(f"No room found for user: {user_id}")
    return None

# ===================== 日志处理核心 =====================
def clean_ansi(line):
    """清理ANSI转义序列"""
    return ANSI_ESCAPE_RE.sub('', line)

def extract_timestamp(line):
    """从日志行提取时间戳"""
    m = TIMESTAMP_RE.match(line)
    if m:
        try:
            return datetime.strptime(m.group(1), "%Y-%m-%dT%H:%M:%S.%fZ")
        except:
            return datetime.utcnow()
    return datetime.utcnow()

def process_line(line):
    """处理单行日志"""
    try:
        line = clean_ansi(line.strip())
        if not line:
            return

        # 调试日志
        if 'CreateRoom' in line or 'JoinRoom' in line or 'LeaveRoom' in line:
            logger.debug(f"Processing: {line}")

        # 记录 user -> room 映射（用于 JoinRoom 补充）
        if 'user join room' in line:
            m = re.search(r'user join room user=(\d+) room="(.*?)"', line)
            if m:
                user_id = int(m.group(1))
                room_name = m.group(2)
                user_room_map[user_id] = room_name
                logger.debug(f"[预登记] user_room_map[{user_id}] = {room_name}")

        # 房间创建事件
        elif 'user create room' in line:
            m = CREATE_ROOM_RE.search(line)
            if m:
                user_id, room_name = int(m.group(1)), m.group(2)
                create_room(room_name, user_id)
        
        # 正确提取并保存 cycle 状态
        elif 'cycle room user=' in line:
            m = re.search(r'cycle room user=(\d+) room="([^"]+)" cycle=(true|false)', line)
            if m:
                user_id = int(m.group(1))
                room_name = m.group(2)
                cycle = m.group(3) == "true"

                user_room_map[user_id] = room_name  # 可选：更新 user → room 映射
                room_cycle[room_name] = cycle
                logger.debug(f"[循环] 房间 {room_name} 设置循环={cycle}（由用户 {user_id}）")
                        
        elif 'Message(CycleRoom' in line:
            m = re.search(r'CycleRoom { cycle: (true|false) }', line)
            if m:
              cycle = m.group(1) == "true"
              m_user = re.search(r'user=(\d+)', line)
              if m_user:
                 user_id = int(m_user.group(1))
                 room_name = user_room_map.get(user_id)
                 if room_name:
                    room_cycle[room_name] = cycle
                    logger.debug(f"[循环] 房间 {room_name} 设置循环={cycle}")


        # JoinRoom 解析
        elif 'Message(JoinRoom' in line:
            m = USER_EVENT_RE.search(line)
            if m:
                event, user_id, user_name = m.groups()
                user_id = int(user_id)
                update_user_info(user_id, user_name)
                room_name = user_room_map.get(user_id) or find_user_room(user_id)
                if room_name:
                    logger.debug(f"[JoinRoom] {user_name} ({user_id}) 加入房间 {room_name}")
                    add_user_to_room(user_id, user_name, room_name)
                else:
                    logger.warning(f"[JoinRoom] 无法定位用户 {user_id} 的房间，跳过加人数")

        # LeaveRoom
        elif 'Message(LeaveRoom' in line:
            m = USER_EVENT_RE.search(line)
            if m:
                event, user_id, user_name = m.groups()
                user_id = int(user_id)
                update_user_info(user_id, user_name)
                remove_user_from_room(user_id)

        # 直接 leave 日志
        elif 'user leave room' in line:
            m = CREATE_ROOM_RE.search(line)
            if m:
                user_id, room_name = int(m.group(1)), m.group(2)
                remove_user_from_room(user_id, room_name)

        # 房主变更
        elif 'Message(NewHost' in line:
            m = NEW_HOST_RE.search(line)
            if m:
                new_host_id = int(m.group(1))
                room_name = find_user_room(new_host_id)
                if room_name:
                    update_room_host(room_name, new_host_id)

        # 房间解散
        elif ROOM_DROP_RE.search(line):
            current_time = time.time()
            with lock:
                for room_name in list(rooms.keys()):
                    if not room_users.get(room_name) and current_time - last_activity.get(room_name, 0) < 10:
                        delete_room(room_name)
                        break

        # ✅ 状态变更：ChangeState(...)
        elif 'broadcast ChangeState(' in line:
            m = re.search(r'broadcast ChangeState\((\w+)', line)
            if m:
                state_raw = m.group(1)
                room_name = extract_room_name_from_line(line)
                if room_name:
                    room_state[room_name] = translate_state(state_raw)
                    logger.debug(f"[状态] 房间 {room_name} 状态切换为 {room_state[room_name]}")

        # ✅ 循环切换：CycleRoom
        elif 'Message(CycleRoom' in line:
           m = re.search(r'CycleRoom { cycle: (true|false) }', line)
           if m:
              cycle = m.group(1) == "true"
              m_user = re.search(r'user=(\d+)', line)
              if m_user:
                  user_id = int(m_user.group(1))
                  room_name = user_room_map.get(user_id)
                  if room_name:
                     room_cycle[room_name] = cycle
                     logger.debug(f"[循环] 房间 {room_name} 设置循环={cycle}")

        # ✅ 谱面选择：SelectChart
        elif 'Message(SelectChart' in line:
           m = re.search(r'room="([^"]+)".*?id: (\d+)', line)
           if m:
              room_name, chart_id = m.groups()
              chart_id = int(chart_id)
              room_chart[room_name] = chart_id
              logger.debug(f"[谱面] 房间 {room_name} 选择谱面 ID：{chart_id}")

    except Exception as e:
        logger.error(f"Error processing line: {line}\n{str(e)}")
        logger.debug(traceback.format_exc())

# ===================== 后台线程 =====================
def tail_log():
    """跟踪日志文件变化"""
    logger.info(f"Starting log monitor for: {LOG_FILE_PATH}")
    last_reopen = time.time()
    
    while running:
        try:
            # 等待文件出现
            if not os.path.exists(LOG_FILE_PATH):
                logger.warning(f"Log file not found, retrying in 5 seconds...")
                time.sleep(5)
                continue
            
            # 定期重新打开文件
            if time.time() - last_reopen > REOPEN_INTERVAL:
                try:
                    with open(LOG_FILE_PATH, "r") as f:
                        current_position = f.tell()
                        f.close()
                    logger.debug("Reopened log file")
                except Exception as e:
                    logger.error(f"Failed to reopen log: {str(e)}")
                last_reopen = time.time()
            
            # 读取新内容
            with open(LOG_FILE_PATH, "r") as f:
                # 定位到上次位置或文件末尾
                try:
                    f.seek(0, 2)  # 默认到文件末尾
                except:
                    pass
                
                while running:
                    line = f.readline()
                    if not line:
                        time.sleep(LOG_POLL_INTERVAL)
                        continue
                    process_line(line)
        
        except Exception as e:
            logger.error(f"Log monitor error: {str(e)}")
            logger.debug(traceback.format_exc())
            time.sleep(1)

def room_cleanup_task():
    """定期清理不活动的房间"""
    logger.info("Starting room cleanup task")
    while running:
        try:
            time.sleep(ROOM_CLEANUP_INTERVAL)
            current_time = time.time()
            with lock:
                # 清理超过1小时没有活动的房间
                for room_name in list(rooms.keys()):
                    if current_time - last_activity.get(room_name, 0) > 3600:
                        logger.info(f"Cleaning up inactive room: {room_name}")
                        delete_room(room_name)
        except Exception as e:
            logger.error(f"Room cleanup error: {str(e)}")
            logger.debug(traceback.format_exc())

# ===================== API端点 =====================
@app.route("/rooms")
def get_rooms():
    with lock:
        output = []
        for room_name, info in rooms.items():
            users = room_users.get(room_name, set())
            output.append({
                "name": room_name,
                "host_id": info["host_id"],
                "host_name": info["host_name"],
                "user_count": len(users),
                "user_names": [user_info.get(uid, f"user_{uid}") for uid in users],
                "created_at": info["created_at"],
                "last_activity": last_activity.get(room_name, 0),
                "state": room_state.get(room_name, "未知"),
                "cycle": room_cycle.get(room_name, False),
                "chart": room_chart.get(room_name, "无")
            })
        return jsonify(output)

@app.route("/status")
def get_status():
    """获取系统状态"""
    with lock:
        return jsonify({
            "room_count": len(rooms),
            "user_count": len(user_room_map),
            "last_activity": max(last_activity.values()) if last_activity else 0,
            "running": running
        })

@app.route("/health")
def health_check():
    """健康检查端点"""
    return jsonify({"status": "ok", "timestamp": time.time()})

@app.route("/users/total")
def get_total_users():
    try:
        with open(USER_INFO_PATH, "r", encoding="utf-8") as f:
            info = json.load(f)
    except:
        return jsonify({"error": "无法读取 user_info.json"}), 500

    user_ids = list(info.keys())
    usernames = list(info.values())

    return jsonify({
        "total_users": len(user_ids),
        "example_usernames": usernames[:10]  # 可随机或分页
    })
    
# ===================== 启动入口 =====================
def start_background_tasks():
    """启动后台任务"""
    # 日志监控线程
    log_thread = threading.Thread(target=tail_log, daemon=True)
    log_thread.start()
    
    # 房间清理线程
    cleanup_thread = threading.Thread(target=room_cleanup_task, daemon=True)
    cleanup_thread.start()
    
    return log_thread, cleanup_thread

if __name__ == "__main__":
    # 加载持久化数据
    load_user_info()
    
    # 启动后台任务
    start_background_tasks()
    
    # 启动Flask应用
    try:
        logger.info("Starting API server on port 5000")
        app.run(host="0.0.0.0", port=5000, use_reloader=False)
    except KeyboardInterrupt:
        logger.info("Shutting down...")
        running = False