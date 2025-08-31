import sqlite3
import time
import threading
import requests
from flask import Flask, jsonify
import logging
from datetime import datetime

app = Flask(__name__)
DB_NAME = 'phira_stats.db'
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# 初始化数据库
def init_db():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    
    # 房间表 (包含程序分配的room_id)
    c.execute('''
        CREATE TABLE IF NOT EXISTS rooms (
            room_id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_name TEXT NOT NULL,
            host_id INTEGER NOT NULL,
            created_at REAL NOT NULL,
            dissolved_at REAL
        )
    ''')
    
    # 用户房间活动表
    c.execute('''
        CREATE TABLE IF NOT EXISTS user_room_activity (
            activity_id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            room_id INTEGER NOT NULL,
            enter_time REAL NOT NULL,
            leave_time REAL,
            FOREIGN KEY(room_id) REFERENCES rooms(room_id)
        )
    ''')
    
    # 用户房间停留时间汇总表
    c.execute('''
        CREATE TABLE IF NOT EXISTS user_room_duration (
            user_id INTEGER NOT NULL,
            room_id INTEGER NOT NULL,
            total_duration REAL NOT NULL,
            visit_count INTEGER NOT NULL DEFAULT 1,
            last_enter_time REAL,
            last_leave_time REAL,
            PRIMARY KEY (user_id, room_id),
            FOREIGN KEY(room_id) REFERENCES rooms(room_id)
        )
    ''')
    
    # 游戏记录表
    c.execute('''
        CREATE TABLE IF NOT EXISTS game_rounds (
            round_id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_id INTEGER NOT NULL,
            chart_id INTEGER,
            start_time REAL NOT NULL,
            end_time REAL,
            FOREIGN KEY(room_id) REFERENCES rooms(room_id)
        )
    ''')
    
    # 用户游戏时长表
    c.execute('''
        CREATE TABLE IF NOT EXISTS user_playtime (
            user_id INTEGER NOT NULL,
            round_id INTEGER NOT NULL,
            play_duration REAL NOT NULL,
            FOREIGN KEY(round_id) REFERENCES game_rounds(round_id)
        )
    ''')
    
    conn.commit()
    conn.close()

# 获取房间信息
def fetch_rooms_info():
    try:
        response = requests.get('https://phira.htadiy.cc/api/rooms/info', timeout=5)
        if response.status_code == 200:
            return response.json()
        else:
            logging.error(f"Failed to fetch rooms info: {response.status_code}")
            return []
    except Exception as e:
        logging.error(f"Error fetching rooms info: {str(e)}")
        return []

# 更新用户房间停留时间
def update_user_room_duration(conn, user_id, room_id, enter_time, leave_time):
    c = conn.cursor()
    duration = leave_time - enter_time
    
    # 检查是否已有记录
    c.execute('''
        SELECT total_duration, visit_count FROM user_room_duration
        WHERE user_id = ? AND room_id = ?
    ''', (user_id, room_id))
    existing = c.fetchone()
    
    if existing:
        # 更新现有记录
        new_duration = existing[0] + duration
        new_count = existing[1] + 1
        c.execute('''
            UPDATE user_room_duration
            SET total_duration = ?, visit_count = ?, last_enter_time = ?, last_leave_time = ?
            WHERE user_id = ? AND room_id = ?
        ''', (new_duration, new_count, enter_time, leave_time, user_id, room_id))
    else:
        # 创建新记录
        c.execute('''
            INSERT INTO user_room_duration (user_id, room_id, total_duration, last_enter_time, last_leave_time)
            VALUES (?, ?, ?, ?, ?)
        ''', (user_id, room_id, duration, enter_time, leave_time))
    
    logging.info(f"Updated room duration for user {user_id} in room {room_id}: {duration:.2f} seconds")

# 房间监控服务
def room_monitor_service():
    last_rooms = {}
    
    while True:
        try:
            current_rooms_info = fetch_rooms_info()
            if not isinstance(current_rooms_info, list):
                time.sleep(1)
                continue
                
            current_rooms = {}
            for room in current_rooms_info:
                # 确保房间数据格式正确
                if not isinstance(room, dict):
                    continue
                    
                room_name = room.get('name')
                if not room_name:
                    continue
                    
                # 确保有必要的字段
                if 'host' not in room or 'users' not in room:
                    continue
                    
                current_rooms[room_name] = room
            
            current_time = time.time()
            
            conn = sqlite3.connect(DB_NAME)
            c = conn.cursor()
            
            # 处理消失的房间
            for room_name in set(last_rooms) - set(current_rooms):
                logging.info(f"Room dissolved: {room_name}")
                c.execute('''
                    UPDATE rooms SET dissolved_at = ?
                    WHERE room_id = (
                        SELECT room_id FROM rooms 
                        WHERE room_name = ? AND dissolved_at IS NULL
                        ORDER BY created_at DESC LIMIT 1
                    )
                ''', (current_time, room_name))
                
                # 标记用户离开
                c.execute('''
                    SELECT activity_id, user_id, enter_time 
                    FROM user_room_activity
                    WHERE room_id = (
                        SELECT room_id FROM rooms 
                        WHERE room_name = ? AND dissolved_at = ?
                    ) AND leave_time IS NULL
                ''', (room_name, current_time))
                
                for activity_id, user_id, enter_time in c.fetchall():
                    c.execute('''
                        UPDATE user_room_activity SET leave_time = ?
                        WHERE activity_id = ?
                    ''', (current_time, activity_id))
                    
                    # 更新停留时间汇总
                    update_user_room_duration(conn, user_id, room_id, enter_time, current_time)
            
            # 处理新房间和现有房间
            for room_name, room in current_rooms.items():
                # 检查是否为新房间
                c.execute('''
                    SELECT room_id FROM rooms 
                    WHERE room_name = ? AND dissolved_at IS NULL
                ''', (room_name,))
                existing_room = c.fetchone()
                
                if not existing_room:
                    # 创建新房间记录
                    logging.info(f"New room created: {room_name}")
                    c.execute('''
                        INSERT INTO rooms (room_name, host_id, created_at)
                        VALUES (?, ?, ?)
                    ''', (room_name, room['host'], current_time))
                    room_id = c.lastrowid
                else:
                    room_id = existing_room[0]
                    # 更新房主（如果变化）
                    c.execute('''
                        SELECT host_id FROM rooms WHERE room_id = ?
                    ''', (room_id,))
                    current_host = c.fetchone()[0]
                    
                    if current_host != room['host']:
                        logging.info(f"Host changed in room {room_name}: {current_host} -> {room['host']}")
                        c.execute('''
                            UPDATE rooms SET host_id = ?
                            WHERE room_id = ?
                        ''', (room['host'], room_id))
                
                # 处理用户进出
                current_users = set(room['users'])
                c.execute('''
                    SELECT user_id FROM user_room_activity
                    WHERE room_id = ? AND leave_time IS NULL
                ''', (room_id,))
                previous_users = {row[0] for row in c.fetchall()}
                
                # 新加入的用户
                for user_id in current_users - previous_users:
                    logging.info(f"User {user_id} entered room {room_name}")
                    c.execute('''
                        INSERT INTO user_room_activity (user_id, room_id, enter_time)
                        VALUES (?, ?, ?)
                    ''', (user_id, room_id, current_time))
                
                # 离开的用户
                for user_id in previous_users - current_users:
                    logging.info(f"User {user_id} left room {room_name}")
                    # 获取最近的进入记录
                    c.execute('''
                        SELECT activity_id, enter_time FROM user_room_activity
                        WHERE user_id = ? AND room_id = ? AND leave_time IS NULL
                        ORDER BY enter_time DESC LIMIT 1
                    ''', (user_id, room_id))
                    activity = c.fetchone()
                    
                    if activity:
                        activity_id, enter_time = activity
                        c.execute('''
                            UPDATE user_room_activity SET leave_time = ?
                            WHERE activity_id = ?
                        ''', (current_time, activity_id))
                        
                        # 更新停留时间汇总
                        update_user_room_duration(conn, user_id, room_id, enter_time, current_time)
                
                # 处理游戏回合
                if room.get('state') == 'PLAYING':
                    # 检查是否为新回合
                    c.execute('''
                        SELECT round_id FROM game_rounds
                        WHERE room_id = ? AND end_time IS NULL
                        ORDER BY start_time DESC LIMIT 1
                    ''', (room_id,))
                    active_round = c.fetchone()
                    
                    if not active_round:
                        # 新回合开始
                        logging.info(f"New round started in room {room_name}")
                        chart_id = room.get('chart') or 0  # 处理可能的null值
                        c.execute('''
                            INSERT INTO game_rounds (room_id, chart_id, start_time)
                            VALUES (?, ?, ?)
                        ''', (room_id, chart_id, current_time))
                        round_id = c.lastrowid
                        
                        # 初始化玩家时长
                        playing_users = room.get('playing_users', [])
                        for user_id in playing_users:
                            c.execute('''
                                INSERT INTO user_playtime (user_id, round_id, play_duration)
                                VALUES (?, ?, 0)
                            ''', (user_id, round_id))
                
                # 更新进行中的游戏时长
                if room.get('state') == 'PLAYING':
                    c.execute('''
                        SELECT round_id FROM game_rounds
                        WHERE room_id = ? AND end_time IS NULL
                    ''', (room_id,))
                    round_row = c.fetchone()
                    
                    if round_row:
                        round_id = round_row[0]
                        # 更新所有正在游戏的用户时长
                        playing_users = room.get('playing_users', [])
                        for user_id in playing_users:
                            # 每次更新增加1秒（因为监控每秒运行一次）
                            c.execute('''
                                UPDATE user_playtime 
                                SET play_duration = play_duration + 1
                                WHERE user_id = ? AND round_id = ?
                            ''', (user_id, round_id))
                
                # 结束已完成的回合
                last_room = last_rooms.get(room_name)
                if last_room:
                    last_state = last_room.get('state')
                else:
                    last_state = None
                    
                current_state = room.get('state')
                
                if last_state == 'PLAYING' and current_state != 'PLAYING':
                    logging.info(f"Round ended in room {room_name}")
                    c.execute('''
                        UPDATE game_rounds SET end_time = ?
                        WHERE room_id = ? AND end_time IS NULL
                    ''', (current_time, room_id))
            
            conn.commit()
            conn.close()
            last_rooms = current_rooms
        except Exception as e:
            logging.error(f"Error in room monitor service: {str(e)}")
            import traceback
            logging.error(traceback.format_exc())
        
        time.sleep(1)  # 每秒更新一次

# API端点：获取总在线人数
@app.route('/users', methods=['GET'])
def get_total_users():
    try:
        conn = sqlite3.connect(DB_NAME)
        c = conn.cursor()
        c.execute('''
            SELECT COUNT(DISTINCT user_id) 
            FROM user_room_activity 
            WHERE leave_time IS NULL
        ''')
        count = c.fetchone()[0]
        conn.close()
        return jsonify({"total_online_users": count})
    except Exception as e:
        logging.error(f"Error in /users endpoint: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    init_db()
    logging.info("Database initialized")
    
    # 启动监控线程
    monitor_thread = threading.Thread(target=room_monitor_service, daemon=True)
    monitor_thread.start()
    logging.info("Room monitor service started")
    
    # 启动Flask应用
    app.run(port=5001, debug=False)