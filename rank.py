import sqlite3
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from datetime import datetime, timedelta
from flask import Flask, jsonify, request
from apscheduler.schedulers.background import BackgroundScheduler
import numpy as np
import os
from matplotlib import font_manager as fm
import logging
import time
import re

# 配置全局变量
DB_PATH = "/root/usersfuck/phira_stats.db"  # 数据库文件路径
CHECK_INTERVAL = 60  # 图表生成间隔（秒）

# 图表配置
CHART_FOLDER = "charts"  # 图表保存文件夹
CHART_SIZE = (12, 8)  # 图表大小 (宽, 高)
HSN_COLOR = "#87CEEB"  # HSN图表颜色 (天蓝色)

# 设置中文字体
try:
   # 尝试使用文泉驿微米黑字体
   font_path = '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'
   if os.path.exists(font_path):
       prop = fm.FontProperties(fname=font_path)
       plt.rcParams['font.family'] = prop.get_name()
   else:
       # 如果找不到文泉驿字体，尝试使用系统默认中文字体
       plt.rcParams['font.family'] = ['DejaVu Sans', 'SimHei', 'Microsoft YaHei', 'WenQuanYi Zen Hei']
except:
   plt.rcParams['font.family'] = ['DejaVu Sans', 'SimHei', 'Microsoft YaHei', 'WenQuanYi Zen Hei']

plt.rcParams['axes.unicode_minus'] = False  # 解决负号显示问题

app = Flask(__name__)

# 确保图表文件夹存在
if not os.path.exists(CHART_FOLDER):
   os.makedirs(CHART_FOLDER)

# 配置日志
logging.basicConfig(
   level=logging.INFO,
   format='%(asctime)s - %(levelname)s - %(message)s',
   handlers=[
       logging.FileHandler('chart_generator.log'),
       logging.StreamHandler()
   ]
)

# 从数据库获取HSN在线人数历史数据（分钟级别）
def get_hsn_history_minutely(start_time=None, end_time=None):
   try:
       conn = sqlite3.connect(DB_PATH)

       # 基础查询
       query = """
       SELECT
           strftime('%Y-%m-%d %H:%M:00', datetime(enter_time, 'unixepoch')) as minute,
           COUNT(DISTINCT user_id) as online_count
       FROM user_room_activity
       WHERE leave_time IS NULL OR leave_time > enter_time
       """

       # 添加时间范围条件
       conditions = []
       params = []

       if start_time:
           conditions.append("enter_time >= ?")
           params.append(start_time.timestamp())

       if end_time:
           conditions.append("enter_time <= ?")
           params.append(end_time.timestamp())

       if conditions:
           query += " AND " + " AND ".join(conditions)

       query += " GROUP BY minute ORDER BY minute"

       df = pd.read_sql_query(query, conn, params=params)
       conn.close()

       # 转换时间戳
       df['minute'] = pd.to_datetime(df['minute'])

       # 删除负数部分
       df = df[df['online_count'] >= 0]

       return df
   except Exception as e:
       logging.error(f"获取HSN历史数据时出错: {e}")
       return pd.DataFrame()

# 从数据库获取房间使用次数数据
def get_room_usage_stats():
   try:
       conn = sqlite3.connect(DB_PATH)
       query = """
       SELECT room_name, COUNT(*) as usage_count
       FROM rooms
       GROUP BY room_name
       ORDER BY usage_count DESC
       LIMIT 10
       """
       df = pd.read_sql_query(query, conn)
       conn.close()
       return df
   except Exception as e:
       logging.error(f"获取房间使用统计数据时出错: {e}")
       return pd.DataFrame()

# 从数据库获取用户游玩时间数据
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

       # 删除负数部分
       df = df[df['total_playtime'] >= 0]

       return df
   except Exception as e:
       logging.error(f"获取用户游玩时间统计数据时出错: {e}")
       return pd.DataFrame()

# 获取游玩时间排行榜数据
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

       # 删除负数部分
       df = df[df['total_playtime'] >= 0]

       return df
   except Exception as e:
       logging.error(f"获取游玩时间排行榜数据时出错: {e}")
       return pd.DataFrame()

# 生成HSN在线人数变化图表（分钟级别）
def generate_hsn_trend_chart(start_time=None, end_time=None, filename_suffix=""):
   try:
       df = get_hsn_history_minutely(start_time, end_time)
       if df.empty:
           logging.warning("没有HSN历史数据可生成图表")
           return None

       # 创建图表文件名
       if filename_suffix:
           filename = f'hsn_trend_{filename_suffix}.png'
       else:
           filename = 'hsn_trend_minutely.png'

       plt.figure(figsize=CHART_SIZE)
       plt.plot(df['minute'], df['online_count'], color=HSN_COLOR, linewidth=1)

       # 设置标题
       if start_time and end_time:
           plt.title(f'HSN服务器在线人数变化 ({start_time.strftime("%Y-%m-%d %H:%M")} 至 {end_time.strftime("%Y-%m-%d %H:%M")})', fontsize=14)
       else:
           plt.title('HSN服务器在线人数变化 (分钟级别)', fontsize=14)

       plt.xlabel('时间', fontsize=10)
       plt.ylabel('在线人数', fontsize=10)
       plt.grid(True, alpha=0.3)

       # 设置x轴格式
       plt.gca().xaxis.set_major_formatter(mdates.DateFormatter('%m-%d %H:%M'))
       plt.gcf().autofmt_xdate()

       plt.tight_layout()
       plt.savefig(os.path.join(CHART_FOLDER, filename), dpi=80, bbox_inches='tight')
       plt.close()
       logging.info(f"HSN趋势图表生成完成: {filename}")
       return filename
   except Exception as e:
       logging.error(f"生成HSN趋势图表时出错: {e}")
       return None

# 生成房间名使用次数排行榜图表
def generate_room_usage_chart():
   try:
       df = get_room_usage_stats()
       if df.empty:
           logging.warning("没有房间使用数据可生成图表")
           return None

       plt.figure(figsize=CHART_SIZE)
       bars = plt.bar(range(len(df)), df['usage_count'], color=HSN_COLOR, alpha=0.7)
       plt.title('房间名使用次数排行榜', fontsize=14)
       plt.xlabel('房间名', fontsize=10)
       plt.ylabel('使用次数', fontsize=10)

       # 设置x轴标签
       plt.xticks(range(len(df)), df['room_name'], rotation=45, ha='right')

       # 在柱子上添加数值标签
       for i, bar in enumerate(bars):
           height = bar.get_height()
           plt.text(bar.get_x() + bar.get_width()/2., height,
                   f'{int(height)}', ha='center', va='bottom', fontsize=8)

       plt.tight_layout()
       plt.savefig(os.path.join(CHART_FOLDER, 'room_usage_ranking.png'), dpi=80, bbox_inches='tight')
       plt.close()
       logging.info("房间使用排行榜图表生成完成")
       return 'room_usage_ranking.png'
   except Exception as e:
       logging.error(f"生成房间使用排行榜图表时出错: {e}")
       return None

# 生成用户游玩时间排行榜柱状图
def generate_user_playtime_bar_chart():
   try:
       df = get_user_playtime_stats()
       if df.empty:
           logging.warning("没有用户游玩时间数据可生成图表")
           return None

       # 将秒转换为小时
       df['total_playtime_hours'] = df['total_playtime'] / 3600

       plt.figure(figsize=CHART_SIZE)
       x_pos = np.arange(len(df))
       bars = plt.bar(x_pos, df['total_playtime_hours'], color=HSN_COLOR, alpha=0.7)
       plt.title('用户游玩时间排行榜 (小时)', fontsize=14)
       plt.xlabel('用户ID', fontsize=10)
       plt.ylabel('游玩时间 (小时)', fontsize=10)

       # 设置x轴标签
       plt.xticks(x_pos, df['user_id'], rotation=45, ha='right')

       # 在柱子上添加数值标签
       for i, bar in enumerate(bars):
           height = bar.get_height()
           plt.text(bar.get_x() + bar.get_width()/2., height,
                   f'{height:.1f}', ha='center', va='bottom', fontsize=8)

       plt.tight_layout()
       plt.savefig(os.path.join(CHART_FOLDER, 'user_playtime_ranking_bar.png'), dpi=80, bbox_inches='tight')
       plt.close()
       logging.info("用户游玩时间排行榜柱状图生成完成")
       return 'user_playtime_ranking_bar.png'
   except Exception as e:
       logging.error(f"生成用户游玩时间排行榜柱状图时出错: {e}")
       return None

# 生成用户游玩时间排行榜饼状图
def generate_user_playtime_pie_chart():
   try:
       df = get_user_playtime_stats()
       if df.empty:
           logging.warning("没有用户游玩时间数据可生成图表")
           return None

       # 将秒转换为小时
       df['total_playtime_hours'] = df['total_playtime'] / 3600

       # 为饼图创建标签
       labels = [f"用户 {user_id}" for user_id in df['user_id']]

       plt.figure(figsize=CHART_SIZE)
       plt.pie(df['total_playtime_hours'], labels=labels, autopct='%1.1f%%', startangle=90)
       plt.title('用户游玩时间分布', fontsize=14)
       plt.axis('equal')  # 确保饼图是圆的

       plt.tight_layout()
       plt.savefig(os.path.join(CHART_FOLDER, 'user_playtime_ranking_pie.png'), dpi=80, bbox_inches='tight')
       plt.close()
       logging.info("用户游玩时间排行榜饼状图生成完成")
       return 'user_playtime_ranking_pie.png'
   except Exception as e:
       logging.error(f"生成用户游玩时间排行榜饼状图时出错: {e}")
       return None

# 生成所有图表
def generate_all_charts():
   logging.info("开始生成所有图表")
   generate_hsn_trend_chart()
   generate_room_usage_chart()
   generate_user_playtime_bar_chart()
   generate_user_playtime_pie_chart()
   logging.info("所有图表生成完成")

# 解析时间字符串
def parse_time_string(time_str):
   try:
       # 尝试解析各种时间格式
       formats = [
           '%Y-%m-%d %H:%M:%S',
           '%Y-%m-%d %H:%M',
           '%Y-%m-%d',
           '%Y/%m/%d %H:%M:%S',
           '%Y/%m/%d %H:%M',
           '%Y/%m/%d'
       ]

       for fmt in formats:
           try:
               return datetime.strptime(time_str, fmt)
           except ValueError:
               continue

       # 如果所有格式都失败，返回当前时间
       logging.warning(f"无法解析时间字符串: {time_str}, 使用当前时间")
       return datetime.now()
   except Exception as e:
       logging.error(f"解析时间字符串时出错: {e}")
       return datetime.now()

# API端点：获取HSN在线人数历史数据（分钟级别）
@app.route('/api/hsn_history/minutely', methods=['GET'])
def get_hsn_history_minutely_api():
   try:
       # 获取查询参数
       start_time_str = request.args.get('start_time')
       end_time_str = request.args.get('end_time')

       start_time = parse_time_string(start_time_str) if start_time_str else None
       end_time = parse_time_string(end_time_str) if end_time_str else None

       df = get_hsn_history_minutely(start_time, end_time)
       if df.empty:
           return jsonify({"error": "没有可用数据"})

       # 转换为列表格式返回
       data = []
       for _, row in df.iterrows():
           data.append({
               "timestamp": row['minute'].strftime('%Y-%m-%d %H:%M:%S'),
               "online_users": int(row['online_count'])
           })

       return jsonify({
           "success": True,
           "data": data,
           "count": len(data),
           "start_time": start_time.strftime('%Y-%m-%d %H:%M:%S') if start_time else "未指定",
           "end_time": end_time.strftime('%Y-%m-%d %H:%M:%S') if end_time else "未指定"
       })
   except Exception as e:
       logging.error(f"获取HSN分钟级别历史数据API时出错: {e}")
       return jsonify({"error": "内部服务器错误"}), 500

# API端点：生成指定时段的HSN在线人数图表
@app.route('/api/generate_hsn_chart', methods=['GET'])
def generate_hsn_chart_api():
   try:
       # 获取查询参数
       start_time_str = request.args.get('start_time')
       end_time_str = request.args.get('end_time')

       if not start_time_str or not end_time_str:
           return jsonify({"error": "必须提供start_time和end_time参数"}), 400

       start_time = parse_time_string(start_time_str)
       end_time = parse_time_string(end_time_str)

       # 验证时间范围
       if start_time >= end_time:
           return jsonify({"error": "开始时间必须早于结束时间"}), 400

       # 生成文件名后缀（使用时间范围）
       filename_suffix = f"{start_time.strftime('%Y%m%d_%H%M')}_{end_time.strftime('%Y%m%d_%H%M')}"

       # 生成图表
       filename = generate_hsn_trend_chart(start_time, end_time, filename_suffix)

       if filename:
           return jsonify({
               "success": True,
               "message": "图表生成完成",
               "filename": filename,
               "start_time": start_time.strftime('%Y-%m-%d %H:%M:%S'),
               "end_time": end_time.strftime('%Y-%m-%d %H:%M:%S')
           })
       else:
           return jsonify({"error": "图表生成失败"}), 500

   except Exception as e:
       logging.error(f"生成HSN图表API时出错: {e}")
       return jsonify({"error": "内部服务器错误"}), 500

# API端点：获取房间使用次数排行榜
@app.route('/api/room_usage_ranking', methods=['GET'])
def get_room_usage_ranking_api():
   try:
       df = get_room_usage_stats()
       if df.empty:
           return jsonify({"error": "没有可用数据"})

       # 转换为列表格式返回
       data = []
       for _, row in df.iterrows():
           data.append({
               "room_name": row['room_name'],
               "usage_count": int(row['usage_count'])
           })

       return jsonify({
           "success": True,
           "data": data,
           "count": len(data)
       })
   except Exception as e:
       logging.error(f"获取房间使用排行榜API时出错: {e}")
       return jsonify({"error": "内部服务器错误"}), 500

# API端点：获取用户游玩时间排行榜
@app.route('/api/user_playtime_ranking', methods=['GET'])
def get_user_playtime_ranking_api():
   try:
       df = get_user_playtime_stats()
       if df.empty:
           return jsonify({"error": "没有可用数据"})

       # 转换为列表格式返回
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

# API端点：手动触发图表生成
@app.route('/api/generate_charts', methods=['POST'])
def generate_charts_api():
   try:
       generate_all_charts()
       return jsonify({"success": True, "message": "图表生成完成"})
   except Exception as e:
       logging.error(f"手动生成图表API时出错: {e}")
       return jsonify({"error": "内部服务器错误"}), 500

# API端点：获取所有生成的HSN图表列表
@app.route('/api/hsn_charts_list', methods=['GET'])
def get_hsn_charts_list():
   try:
       # 获取charts文件夹中的所有HSN图表文件
       chart_files = [f for f in os.listdir(CHART_FOLDER) if f.startswith('hsn_trend_') and f.endswith('.png')]

       # 从文件名中提取时间信息
       charts_info = []
       for filename in chart_files:
           # 尝试从文件名中提取时间范围
           match = re.search(r'hsn_trend_(\d{8}_\d{4})_(\d{8}_\d{4})\.png', filename)
           if match:
               start_str = match.group(1)
               end_str = match.group(2)

               # 解析时间
               try:
                   start_time = datetime.strptime(start_str, '%Y%m%d_%H%M')
                   end_time = datetime.strptime(end_str, '%Y%m%d_%H%M')

                   charts_info.append({
                       "filename": filename,
                       "start_time": start_time.strftime('%Y-%m-%d %H:%M'),
                       "end_time": end_time.strftime('%Y-%m-%d %H:%M')
                   })
               except:
                   charts_info.append({
                       "filename": filename,
                       "start_time": "未知",
                       "end_time": "未知"
                   })
           else:
               charts_info.append({
                   "filename": filename,
                   "start_time": "未知",
                   "end_time": "未知"
               })

       return jsonify({
           "success": True,
           "charts": charts_info,
           "count": len(charts_info)
       })
   except Exception as e:
       logging.error(f"获取HSN图表列表API时出错: {e}")
       return jsonify({"error": "内部服务器错误"}), 500

# API端点：获取特定HSN图表
@app.route('/api/hsn_chart/<filename>', methods=['GET'])
def get_hsn_chart(filename):
   try:
       # 安全检查：确保文件名只包含允许的字符
       if not re.match(r'^hsn_trend_[a-zA-Z0-9_\-\.]+\.png$', filename):
           return jsonify({"error": "无效的文件名"}), 400

       chart_path = os.path.join(CHART_FOLDER, filename)

       if not os.path.exists(chart_path):
           return jsonify({"error": "图表不存在"}), 404

       # 返回图表文件
       return app.send_static_file(os.path.join(CHART_FOLDER, filename))
   except Exception as e:
       logging.error(f"获取HSN图表API时出错: {e}")
       return jsonify({"error": "内部服务器错误"}), 500

# 排行榜API：获取完整游玩时间排行榜
@app.route('/api/playtime_leaderboard', methods=['GET'])
def get_playtime_leaderboard_api():
   try:
       df = get_playtime_leaderboard()
       if df.empty:
           return jsonify({"error": "没有可用数据"})

       # 转换为列表格式返回
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

# 排行榜API：获取前N名用户排行榜
@app.route('/api/playtime_leaderboard/top/<int:limit>', methods=['GET'])
def get_playtime_leaderboard_top_api(limit):
   try:
       if limit <= 0:
           return jsonify({"error": "limit参数必须为正整数"}), 400

       df = get_playtime_leaderboard(limit)
       if df.empty:
           return jsonify({"error": "没有可用数据"})

       # 转换为列表格式返回
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

# 健康检查API
@app.route('/health', methods=['GET'])
def health_check():
   try:
       # 测试数据库连接
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

# 定时任务
def scheduled_task():
   logging.info("执行定时图表生成任务")
   generate_all_charts()

if __name__ == '__main__':
   # 创建调度器
   scheduler = BackgroundScheduler()
   scheduler.add_job(scheduled_task, 'interval', seconds=CHECK_INTERVAL)
   scheduler.start()

   # 立即执行一次图表生成
   scheduled_task()

   try:
       # 启动Flask应用
       app.run(host='0.0.0.0', port=7001, debug=False)
   except (KeyboardInterrupt, SystemExit):
       scheduler.shutdown()