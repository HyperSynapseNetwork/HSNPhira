HSN 统计图表系统 API 文档

概述

HSN 统计图表系统是一个基于 Flask 的 Web 服务，用于从 SQLite 数据库读取 HSN 服务器统计数据，生成可视化图表，并通过 RESTful API 提供数据访问。

API 端点

健康检查

GET /health

说明：检查服务运行状态

响应数据格式：

{
  "status": "服务状态字符串，值为 'healthy' 或 'unhealthy'",
  "timestamp": "时间戳，ISO 8601 格式"
}

HSN 在线人数历史数据

GET /api/hsn_history/minutely

说明：获取分钟级别的 HSN 在线人数历史数据

查询参数：

- start_time: 开始时间（可选，格式：YYYY-MM-DD HH:MM:SS）
- end_time: 结束时间（可选，格式：YYYY-MM-DD HH:MM:SS）

响应数据格式：

{
  "success": "请求是否成功的布尔值",
  "data": [
    {
      "timestamp": "时间戳，格式为 YYYY-MM-DD HH:MM:SS",
      "online_users": "在线用户数量，整数"
    }
  ],
  "count": "返回的数据项数量，整数",
  "start_time": "查询的开始时间，字符串格式",
  "end_time": "查询的结束时间，字符串格式"
}

生成 HSN 在线人数图表

GET /api/generate_hsn_chart

说明：生成指定时间段的 HSN 在线人数趋势图表

查询参数：

- start_time: 开始时间（必需，支持多种时间格式）
- end_time: 结束时间（必需，支持多种时间格式）

响应数据格式：

{
  "success": "请求是否成功的布尔值",
  "message": "操作结果消息，字符串",
  "filename": "生成的图表文件名，字符串",
  "start_time": "图表的开始时间，字符串格式",
  "end_time": "图表的结束时间，字符串格式"
}

获取房间使用次数排行榜

GET /api/room_usage_ranking

说明：获取使用次数最多的房间排行榜

响应数据格式：

{
  "success": "请求是否成功的布尔值",
  "data": [
    {
      "room_name": "房间名称，字符串",
      "usage_count": "房间使用次数，整数"
    }
  ],
  "count": "返回的数据项数量，整数"
}

获取用户游玩时间排行榜

GET /api/user_playtime_ranking

说明：获取用户游玩时间排行榜（前10名）

响应数据格式：

{
  "success": "请求是否成功的布尔值",
  "data": [
    {
      "user_id": "用户ID，整数",
      "playtime_seconds": "游玩时间（秒），整数",
      "playtime_hours": "游玩时间（小时），浮点数，保留两位小数"
    }
  ],
  "count": "返回的数据项数量，整数"
}

手动生成所有图表

POST /api/generate_charts

说明：手动触发所有图表的生成

响应数据格式：

{
  "success": "请求是否成功的布尔值",
  "message": "操作结果消息，字符串"
}

获取 HSN 图表列表

GET /api/hsn_charts_list

说明：获取已生成的所有 HSN 趋势图表列表

响应数据格式：

{
  "success": "请求是否成功的布尔值",
  "charts": [
    {
      "filename": "图表文件名，字符串",
      "start_time": "图表开始时间，字符串格式，可能为'未知'",
      "end_time": "图表结束时间，字符串格式，可能为'未知'"
    }
  ],
  "count": "图表文件数量，整数"
}

获取特定 HSN 图表

GET /api/hsn_chart/<filename>

说明：下载指定的 HSN 趋势图表文件

路径参数：

- filename: 图表文件名，必须匹配正则表达式 ^hsn_trend[a-zA-Z0-9-.]+.png$

响应：PNG 图片文件的二进制数据

获取完整游玩时间排行榜

GET /api/playtime_leaderboard

说明：获取所有用户的游玩时间排行榜

响应数据格式：

{
  "success": "请求是否成功的布尔值",
  "data": [
    {
      "user_id": "用户ID，整数",
      "total_playtime": "总游玩时间（秒），整数"
    }
  ],
  "timestamp": "请求时间戳，ISO 8601 格式",
  "total_users": "用户总数，整数"
}

获取前N名游玩时间排行榜

GET /api/playtime_leaderboard/top/<limit>

说明：获取指定数量的排行榜前N名用户

路径参数：

- limit: 返回的用户数量，正整数

响应数据格式：

{
  "success": "请求是否成功的布尔值",
  "data": [
    {
      "user_id": "用户ID，整数",
      "total_playtime": "总游玩时间（秒），整数"
    }
  ],
  "timestamp": "请求时间戳，ISO 8601 格式",
  "total_users": "返回的用户数量，整数"
}

错误响应格式

当请求发生错误时，返回格式如下：

{
  "error": "错误描述信息，字符串"
}

基础信息

- 服务地址："http://localhost:7001" (http://localhost:7001)
- 数据库路径：/root/usersfuck/phira_stats.db
- 图表生成间隔：60秒
- 图表保存路径：charts/文件夹
- 默认图表颜色：天蓝色 (#87CEEB)
- 启动命令：python app.py