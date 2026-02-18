import sqlite3
import pandas as pd
from datetime import datetime
from flask import Flask, jsonify, request
import logging

# 配置全局变量
DB_PATH = "/root/usersfuck/phira_stats.db"  # 数据库文件路径

app = Flask(__name__)

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('chart_generator.log'),
        logging.StreamHandler()
    ]
)

# 从数据库获取游玩时间排行榜数据（所有用户，按总时间降序）
def get_playtime_leaderboard(limit=None):
    try:
        conn = sqlite3.connect(DB_PATH)
        if limit:
            query = """
            SELECT user_id, SUM(play_duration) as total_playtime
            FROM user_playtime
            GROUP BY user_id
            ORDER BY total_playtime DESC
            LIMIT ?
            """
            df = pd.read_sql_query(query, conn, params=(limit,))
        else:
            query = """
            SELECT user_id, SUM(play_duration) as total_playtime
            FROM user_playtime
            GROUP BY user_id
            ORDER BY total_playtime DESC
            """
            df = pd.read_sql_query(query, conn)
        conn.close()
        # 删除负数部分（如有）
        df = df[df['total_playtime'] >= 0]
        return df
    except Exception as e:
        logging.error(f"获取游玩时间排行榜数据时出错: {e}")
        return pd.DataFrame()

# 获取用户游玩时间统计数据（前10名，兼容原有API）
def get_user_playtime_stats():
    try:
        conn = sqlite3.connect(DB_PATH)
        query = """
        SELECT user_id, SUM(play_duration) as total_playtime
        FROM user_playtime
        GROUP BY user_id
        ORDER BY total_playtime DESC
        LIMIT 10
        """
        df = pd.read_sql_query(query, conn)
        conn.close()
        df = df[df['total_playtime'] >= 0]
        return df
    except Exception as e:
        logging.error(f"获取用户游玩时间统计数据时出错: {e}")
        return pd.DataFrame()

# 原有API：获取用户游玩时间排行榜（前10名）
@app.route('/api/user_playtime_ranking', methods=['GET'])
def get_user_playtime_ranking_api():
    try:
        df = get_user_playtime_stats()
        if df.empty:
            return jsonify({"error": "没有可用数据"})
        data = []
        for _, row in df.iterrows():
            data.append({
                "user_id": int(row['user_id']),
                "playtime_seconds": int(row['total_playtime']),
                "playtime_hours": round(row['total_playtime'] / 3600, 2)
            })
        return jsonify({
            "success": True,
            "data": data,
            "count": len(data)
        })
    except Exception as e:
        logging.error(f"获取用户游玩时间排行榜API时出错: {e}")
        return jsonify({"error": "内部服务器错误"}), 500

# 原有API：获取完整游玩时间排行榜
@app.route('/api/playtime_leaderboard', methods=['GET'])
def get_playtime_leaderboard_api():
    try:
        df = get_playtime_leaderboard()
        if df.empty:
            return jsonify({"error": "没有可用数据"})
        data = []
        for _, row in df.iterrows():
            data.append({
                "user_id": int(row['user_id']),
                "total_playtime": int(row['total_playtime'])
            })
        return jsonify({
            "success": True,
            "data": data,
            "timestamp": datetime.now().isoformat(),
            "total_users": len(data)
        })
    except Exception as e:
        logging.error(f"获取游玩时间排行榜API时出错: {e}")
        return jsonify({"error": "内部服务器错误"}), 500

# 原有API：获取前N名用户排行榜
@app.route('/api/playtime_leaderboard/top/<int:limit>', methods=['GET'])
def get_playtime_leaderboard_top_api(limit):
    try:
        if limit <= 0:
            return jsonify({"error": "limit参数必须为正整数"}), 400
        df = get_playtime_leaderboard(limit)
        if df.empty:
            return jsonify({"error": "没有可用数据"})
        data = []
        for _, row in df.iterrows():
            data.append({
                "user_id": int(row['user_id']),
                "total_playtime": int(row['total_playtime'])
            })
        return jsonify({
            "success": True,
            "data": data,
            "timestamp": datetime.now().isoformat(),
            "total_users": len(data)
        })
    except Exception as e:
        logging.error(f"获取前{limit}名游玩时间排行榜API时出错: {e}")
        return jsonify({"error": "内部服务器错误"}), 500

# 新增API：获取指定用户的排名和具体数据
@app.route('/api/user_rank/<int:user_id>', methods=['GET'])
def get_user_rank_api(user_id):
    try:
        # 获取所有用户的总游玩时间（降序）
        df = get_playtime_leaderboard()
        if df.empty:
            return jsonify({"error": "没有可用数据"}), 404

        # 转换为列表并计算排名（处理并列情况）
        records = []
        for _, row in df.iterrows():
            records.append({
                "user_id": int(row['user_id']),
                "total_playtime": int(row['total_playtime'])
            })

        # 查找指定用户并计算排名
        rank = 1
        prev_time = None
        found = None
        for i, record in enumerate(records):
            # 排名逻辑：如果当前时间与上一个不同，则排名为 i+1，否则与上一个相同
            if prev_time is None or record['total_playtime'] != prev_time:
                rank = i + 1
            if record['user_id'] == user_id:
                found = {
                    "user_id": user_id,
                    "rank": rank,
                    "total_playtime_seconds": record['total_playtime'],
                    "total_playtime_hours": round(record['total_playtime'] / 3600, 2)
                }
                break
            prev_time = record['total_playtime']

        if found:
            return jsonify({
                "success": True,
                "data": found
            })
        else:
            return jsonify({"error": "用户不存在"}), 404

    except Exception as e:
        logging.error(f"获取用户排名API时出错: {e}")
        return jsonify({"error": "内部服务器错误"}), 500

# 健康检查API
@app.route('/health', methods=['GET'])
def health_check():
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.close()
        return jsonify({
            "status": "healthy",
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        logging.error(f"健康检查失败: {e}")
        return jsonify({
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }), 500

if __name__ == '__main__':
    # 启动Flask应用
    app.run(host='0.0.0.0', port=7001, debug=False)