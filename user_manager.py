import os
import json
import threading
import time
import requests
import sqlite3
from flask import Flask, request, jsonify
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)

# 配置
USERS_DB_PATH = "phira_users.db"
PHIRA_MAPPING_FILE = "/root/user_info.json"  # Phira映射文件路径
ADMIN_PASSWORD = "nb2022outlook"        # 普通管理员密码
SUPER_ADMIN_PASSWORD = "问号"  # 超级管理员密码
UPDATE_INTERVAL = 10  # 更新间隔（秒）

# 加载Phira映射
def load_phira_mapping():
    try:
        with open(PHIRA_MAPPING_FILE, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return {}
    except json.JSONDecodeError:
        return {}

# 保存Phira映射（如果需要更新）
def save_phira_mapping(mapping):
    with open(PHIRA_MAPPING_FILE, "w") as f:
        json.dump(mapping, f, indent=2)

# 数据库初始化
def init_db():
    with sqlite3.connect(USERS_DB_PATH) as conn:
        c = conn.cursor()
        c.execute('''CREATE TABLE IF NOT EXISTS users (
                     id INTEGER PRIMARY KEY AUTOINCREMENT,
                     name TEXT UNIQUE NOT NULL,
                     phira_id TEXT NOT NULL,
                     phira_name TEXT NOT NULL,
                     phira_rks REAL DEFAULT 0,
                     image_url TEXT DEFAULT '',
                     password TEXT NOT NULL,
                     admin TEXT DEFAULT 'no',
                     dev TEXT DEFAULT 'no',
                     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                     )''')
        conn.commit()

# 数据库连接上下文管理器
def get_db():
    conn = sqlite3.connect(USERS_DB_PATH)
    conn.row_factory = sqlite3.Row  # 允许以字典方式访问行
    return conn

# 初始化数据库
init_db()

def update_phira_info():
    """定时更新用户的Phira信息（头像和RKS）"""
    while True:
        try:
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] 开始更新用户Phira信息...")
            
            with get_db() as conn:
                c = conn.cursor()
                c.execute("SELECT id, phira_id FROM users")
                users = c.fetchall()
                updated_count = 0
                
                for user in users:
                    phira_id = user['phira_id']
                    
                    try:
                        # 获取用户头像
                        user_url = f"https://phira.5wyxi.com/user/{phira_id}"
                        response = requests.get(user_url, timeout=10)
                        
                        if response.status_code == 200:
                            user_data = response.json()
                            avatar = user_data.get("avatar", "")
                            
                            # 检查是否需要更新
                            c.execute("SELECT image_url FROM users WHERE id = ?", (user['id'],))
                            current_avatar = c.fetchone()['image_url']
                            if current_avatar != avatar:
                                c.execute("UPDATE users SET image_url = ? WHERE id = ?", 
                                         (avatar, user['id']))
                                updated_count  = 1
                        else:
                            print(f"获取用户 {phira_id} 头像失败: HTTP {response.status_code}")
                        
                        # 获取用户RKS
                        rks_url = f"https://phira.5wyxi.com/record/get-pool/{phira_id}"
                        response = requests.get(rks_url, timeout=10)
                        
                        if response.status_code == 200:
                            rks_data = response.json()
                            rks = rks_data.get("rks", 0)
                            
                            # 检查是否需要更新
                            c.execute("SELECT phira_rks FROM users WHERE id = ?", (user['id'],))
                            current_rks = c.fetchone()['phira_rks']
                            if current_rks != rks:
                                c.execute("UPDATE users SET phira_rks = ? WHERE id = ?", 
                                         (rks, user['id']))
                                updated_count  = 1
                        else:
                            print(f"获取用户 {phira_id} RKS失败: HTTP {response.status_code}")
                    
                    except requests.RequestException as e:
                        print(f"更新用户 {phira_id} 信息时出错: {str(e)}")
                    except json.JSONDecodeError:
                        print(f"解析用户 {phira_id} 的API响应失败")
                
                conn.commit()
                if updated_count > 0:
                    print(f"成功更新 {updated_count} 个用户的Phira信息")
                else:
                    print("没有需要更新的用户信息")
        
        except Exception as e:
            print(f"更新过程中发生错误: {str(e)}")
        
        # 等待下一次更新
        time.sleep(UPDATE_INTERVAL)

# 启动后台更新线程
update_thread = threading.Thread(target=update_phira_info)
update_thread.daemon = True
update_thread.start()

@app.route('/register', methods=['POST'])
def register():
    """用户注册API"""
    data = request.json
    if not data or 'name' not in data or 'phira_id' not in data or 'password' not in data:
        return jsonify({"status": "error", "message": "Missing parameters"}), 400
    
    name = data['name']
    phira_id = str(data['phira_id'])  # 转换为字符串确保类型一致
    password = data['password']
    
    # 加载Phira映射
    phira_mapping = load_phira_mapping()
    
    with get_db() as conn:
        c = conn.cursor()
        
        # 检查phira_id是否存在
        if phira_id not in phira_mapping:
            return jsonify({"status": "error", "message": "Phira account not found"}), 400
        
        # 检查phira_id是否已被绑定
        c.execute("SELECT 1 FROM users WHERE phira_id = ?", (phira_id,))
        if c.fetchone():
            return jsonify({"status": "error", "message": "Phira account already bound"}), 400
        
        # 检查用户名是否已存在
        c.execute("SELECT 1 FROM users WHERE name = ?", (name,))
        if c.fetchone():
            return jsonify({"status": "error", "message": "Username already exists"}), 400
        
        # 创建新用户 - 密码使用加盐哈希存储
        hashed_password = generate_password_hash(password)
        phira_name = phira_mapping.get(phira_id, f"Phira_{phira_id}")
        c.execute('''INSERT INTO users (name, phira_id, phira_name, password) 
                     VALUES (?, ?, ?, ?)''',
                 (name, phira_id, phira_name, hashed_password))
        
        conn.commit()
        return jsonify({"status": "success", "message": "Registration successful"}), 200

@app.route('/login', methods=['POST'])
def login():
    """用户登录API - 验证密码哈希"""
    data = request.json
    if not data or 'name' not in data or 'password' not in data:
        return jsonify({"status": "error", "message": "Missing parameters"}), 400
    
    name = data['name']
    password = data['password']
    
    with get_db() as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM users WHERE name = ?", (name,))
        user_row = c.fetchone()
        
        if not user_row:
            return jsonify({"status": "error", "message": "Username not found"}), 404
        
        # 验证密码哈希
        if not check_password_hash(user_row['password'], password):
            return jsonify({"status": "error", "message": "Incorrect password"}), 401
        
        # 转换为字典格式返回
        user = dict(user_row)
        user["password"] = password  # 返回明文密码给客户端
        
        return jsonify({
            "status": "success",
            "user": user
        }), 200

@app.route('/info', methods=['POST'])
def get_info():
    """查询用户信息API"""
    data = request.json
    if not data or 'id' not in data or 'password' not in data:
        return jsonify({"status": "error", "message": "Missing parameters"}), 400
    
    user_id = int(data['id'])
    password = data['password']
    
    with get_db() as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        user_row = c.fetchone()
        
        if not user_row:
            return jsonify({"status": "error", "message": "User not found"}), 404
        
        # 验证密码权限
        if password == SUPER_ADMIN_PASSWORD:
            # 超级管理员返回所有信息（密码显示为哈希值）
            user = dict(user_row)
            return jsonify({"status": "success", "user": user}), 200
        elif password == ADMIN_PASSWORD:
            # 普通管理员返回除密码外的信息
            user = dict(user_row)
            user.pop("password", None)
            return jsonify({"status": "success", "user": user}), 200
        else:
            return jsonify({"status": "error", "message": "Unauthorized"}), 403

@app.route('/info_changer', methods=['POST'])
def change_info():
    """修改用户信息API - 处理密码哈希"""
    data = request.json
    if not data or 'id' not in data or 'password' not in data or 'changes' not in data:
        return jsonify({"status": "error", "message": "Missing parameters"}), 400
    
    user_id = int(data['id'])
    password = data['password']
    changes = data['changes']
    
    # 加载Phira映射
    phira_mapping = load_phira_mapping()
    
    with get_db() as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        user = c.fetchone()
        
        if not user:
            return jsonify({"status": "error", "message": "User not found"}), 404
        
        is_super_admin = (password == SUPER_ADMIN_PASSWORD)
        is_admin = (password == ADMIN_PASSWORD)
        
        if not (is_super_admin or is_admin):
            return jsonify({"status": "error", "message": "Unauthorized"}), 403
        
        # 检查权限
        for field in changes:
            if field in ["admin", "dev", "password"]:
                if not is_super_admin:
                    return jsonify({"status": "error", "message": f"Insufficient privileges to modify {field}"}), 403
        
        # 应用修改
        update_fields = []
        update_values = []
        
        if "name" in changes:
            new_name = changes["name"]
            # 检查用户名是否已存在
            c.execute("SELECT 1 FROM users WHERE name = ? AND id != ?", (new_name, user_id))
            if c.fetchone():
                return jsonify({"status": "error", "message": "Username already exists"}), 400
            update_fields.append("name = ?")
            update_values.append(new_name)
        
        if "phira_id" in changes:
            new_phira_id = str(changes["phira_id"])
            # 检查phira_id是否存在
            if new_phira_id not in phira_mapping:
                return jsonify({"status": "error", "message": "Phira account not found"}), 400
            # 检查是否已被其他用户绑定
            c.execute("SELECT 1 FROM users WHERE phira_id = ? AND id != ?", (new_phira_id, user_id))
            if c.fetchone():
                return jsonify({"status": "error", "message": "Phira account already bound"}), 400
            
            phira_name = phira_mapping.get(new_phira_id, f"Phira_{new_phira_id}")
            update_fields.append("phira_id = ?")
            update_values.append(new_phira_id)
            update_fields.append("phira_name = ?")
            update_values.append(phira_name)
            update_fields.append("phira_rks = 0")
            update_fields.append("image_url = ''")
        
        # 处理密码修改 - 使用加盐哈希存储
        if "password" in changes:
            hashed_password = generate_password_hash(changes["password"])
            update_fields.append("password = ?")
            update_values.append(hashed_password)
        
        # 直接更新其他字段
        for field in ["admin", "dev", "phira_name", "phira_rks", "image_url"]:
            if field in changes:
                update_fields.append(f"{field} = ?")
                update_values.append(changes[field])
        
        # 构建SQL更新语句
        if update_fields:
            update_values.append(user_id)
            update_sql = f"UPDATE users SET {', '.join(update_fields)} WHERE id = ?"
            c.execute(update_sql, update_values)
            conn.commit()
        
        return jsonify({"status": "success", "message": "User updated"}), 200

@app.route('/admin/users', methods=['POST'])
def get_all_users():
    """获取所有用户数据"""
    data = request.json
    if not data or 'password' not in data:
        return jsonify({"status": "error", "message": "Missing parameters"}), 400
    
    password = data['password']
    
    # 验证管理员密码
    if password != ADMIN_PASSWORD and password != SUPER_ADMIN_PASSWORD:
        return jsonify({"status": "error", "message": "Unauthorized"}), 403
    
    with get_db() as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM users")
        users = [dict(row) for row in c.fetchall()]
        
        # 根据请求类型决定是否显示密码
        show_passwords = (password == SUPER_ADMIN_PASSWORD)
        
        # 处理用户数据
        processed_users = []
        for user in users:
            user_data = {
                "id": user["id"],
                "name": user["name"],
                "phira_id": user["phira_id"],
                "phira_name": user["phira_name"],
                "phira_rks": user["phira_rks"],
                "image_url": user["image_url"],
                "admin": user["admin"],
                "dev": user["dev"]
            }
            
            if show_passwords:
                user_data["password"] = user["password"]
            
            processed_users.append(user_data)
        
        return jsonify({
            "status": "success",
            "users": processed_users
        }), 200

@app.route('/admin/update', methods=['POST'])
def admin_update_user():
    """管理员更新用户信息"""
    data = request.json
    if not data or 'password' not in data or 'user_id' not in data or 'changes' not in data:
        return jsonify({"status": "error", "message": "Missing parameters"}), 400
    
    admin_password = data['password']
    user_id = int(data['user_id'])
    changes = data['changes']
    
    # 验证管理员密码
    if admin_password != ADMIN_PASSWORD and admin_password != SUPER_ADMIN_PASSWORD:
        return jsonify({"status": "error", "message": "Unauthorized"}), 403
    
    is_super_admin = (admin_password == SUPER_ADMIN_PASSWORD)
    
    # 加载Phira映射
    phira_mapping = load_phira_mapping()
    
    with get_db() as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        user = c.fetchone()
        
        if not user:
            return jsonify({"status": "error", "message": "User not found"}), 404
        
        # 检查权限
        for field in changes:
            if field in ["admin", "dev", "password"]:
                if not is_super_admin:
                    return jsonify({"status": "error", "message": f"Insufficient privileges to modify {field}"}), 403
        
        # 应用修改
        update_fields = []
        update_values = []
        
        if "name" in changes:
            new_name = changes["name"]
            c.execute("SELECT 1 FROM users WHERE name = ? AND id != ?", (new_name, user_id))
            if c.fetchone():
                return jsonify({"status": "error", "message": "Username already exists"}), 400
            update_fields.append("name = ?")
            update_values.append(new_name)
        
        if "password" in changes:
            hashed_password = generate_password_hash(changes["password"])
            update_fields.append("password = ?")
            update_values.append(hashed_password)
        
        if "phira_id" in changes:
            new_phira_id = str(changes["phira_id"])
            # 检查phira_id是否存在
            if new_phira_id not in phira_mapping:
                return jsonify({"status": "error", "message": "Phira account not found"}), 400
            # 检查是否已被其他用户绑定
            c.execute("SELECT 1 FROM users WHERE phira_id = ? AND id != ?", (new_phira_id, user_id))
            if c.fetchone():
                return jsonify({"status": "error", "message": "Phira account already bound"}), 400
            
            phira_name = phira_mapping.get(new_phira_id, f"Phira_{new_phira_id}")
            update_fields.append("phira_id = ?")
            update_values.append(new_phira_id)
            update_fields.append("phira_name = ?")
            update_values.append(phira_name)
            update_fields.append("phira_rks = 0")
            update_fields.append("image_url = ''")
        
        for field in ["admin", "dev", "phira_name", "phira_rks", "image_url"]:
            if field in changes:
                update_fields.append(f"{field} = ?")
                update_values.append(changes[field])
        
        # 构建SQL更新语句
        if update_fields:
            update_values.append(user_id)
            update_sql = f"UPDATE users SET {', '.join(update_fields)} WHERE id = ?"
            c.execute(update_sql, update_values)
            conn.commit()
        
        return jsonify({"status": "success", "message": "User updated"}), 200

@app.route('/admin/batch-update', methods=['POST'])
def admin_batch_update():
    """批量更新用户信息"""
    data = request.json
    if not data or 'password' not in data or 'user_ids' not in data or 'changes' not in data:
        return jsonify({"status": "error", "message": "Missing parameters"}), 400
    
    admin_password = data['password']
    user_ids = data['user_ids']
    changes = data['changes']
    
    # 验证管理员密码
    if admin_password != ADMIN_PASSWORD and admin_password != SUPER_ADMIN_PASSWORD:
        return jsonify({"status": "error", "message": "Unauthorized"}), 403
    
    is_super_admin = (admin_password == SUPER_ADMIN_PASSWORD)
    
    # 加载Phira映射
    phira_mapping = load_phira_mapping()
    
    # 检查权限
    for field in changes:
        if field in ["admin", "dev", "password"]:
            if not is_super_admin:
                return jsonify({"status": "error", "message": f"Insufficient privileges to modify {field}"}), 403
    
    with get_db() as conn:
        c = conn.cursor()
        results = []
        
        for user_id in user_ids:
            c.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            user = c.fetchone()
            
            if not user:
                results.append({"user_id": user_id, "status": "error", "message": "User not found"})
                continue
            
            # 应用修改
            update_fields = []
            update_values = []
            
            if "name" in changes:
                new_name = changes["name"]
                c.execute("SELECT 1 FROM users WHERE name = ? AND id != ?", (new_name, user_id))
                if c.fetchone():
                    results.append({"user_id": user_id, "status": "error", "message": "Username already exists"})
                    continue
                update_fields.append("name = ?")
                update_values.append(new_name)
            
            if "password" in changes:
                hashed_password = generate_password_hash(changes["password"])
                update_fields.append("password = ?")
                update_values.append(hashed_password)
            
            if "phira_id" in changes:
                new_phira_id = str(changes["phira_id"])
                # 检查phira_id是否存在
                if new_phira_id not in phira_mapping:
                    results.append({"user_id": user_id, "status": "error", "message": "Phira account not found"})
                    continue
                # 检查是否已被其他用户绑定
                c.execute("SELECT 1 FROM users WHERE phira_id = ? AND id != ?", (new_phira_id, user_id))
                if c.fetchone():
                    results.append({"user_id": user_id, "status": "error", "message": "Phira account already bound"})
                    continue
                
                phira_name = phira_mapping.get(new_phira_id, f"Phira_{new_phira_id}")
                update_fields.append("phira_id = ?")
                update_values.append(new_phira_id)
                update_fields.append("phira_name = ?")
                update_values.append(phira_name)
                update_fields.append("phira_rks = 0")
                update_fields.append("image_url = ''")
            
            for field in ["admin", "dev", "phira_name", "phira_rks", "image_url"]:
                if field in changes:
                    update_fields.append(f"{field} = ?")
                    update_values.append(changes[field])
            
            # 构建SQL更新语句
            if update_fields:
                update_values.append(user_id)
                update_sql = f"UPDATE users SET {', '.join(update_fields)} WHERE id = ?"
                c.execute(update_sql, update_values)
                results.append({"user_id": user_id, "status": "success", "message": "User updated"})
        
        conn.commit()
        return jsonify({"status": "success", "results": results}), 200

@app.route('/users/total', methods=['GET'])
def get_total_users():
    """获取用户总数"""
    with get_db() as conn:
        c = conn.cursor()
        c.execute("SELECT COUNT(*) FROM users")
        total_users = c.fetchone()[0]
        
        return jsonify({
            "total_users": total_users
        }), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=2345, debug=True)
