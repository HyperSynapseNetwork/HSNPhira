Phira谱面热度追踪系统 API 文档

概述

本系统用于追踪Phira游戏谱面的游玩热度变化，通过定时采集谱面游玩记录数据，计算不同时间范围内的游玩增量，并提供排行榜查询接口。

基础信息

- 基础URL: "http://localhost:5000" (http://localhost:5000) (默认)
- 数据格式: JSON
- 编码: UTF-8
- 时区: 服务器本地时区

错误处理

所有接口在发生错误时返回统一格式的错误响应：

{
  "error": "错误描述信息"
}

HTTP状态码说明：

- 200: 请求成功
- 400: 请求参数错误
- 404: 资源不存在
- 500: 服务器内部错误

接口列表

1. 服务状态查询

获取系统运行状态和配置信息

端点: GET /status

请求参数: 无

响应字段说明:

- last_chart_list_update: 最后一次谱面列表更新时间，ISO 8601格式字符串
- last_record_update: 最后一次游玩记录更新时间，ISO 8601格式字符串
- cached_charts_count: 当前缓存的谱面总数，整数
- queue_size: 待更新谱面队列长度，整数
- update_interval: 单个谱面更新间隔，单位为秒，整数
- interval: 全局游玩记录获取间隔，单位为秒，整数
- chart_list_interval: 谱面列表更新间隔，单位为秒，整数
- per_page: 每次获取谱面数量，整数
- all_mode: 是否全量模式，布尔值

2. 热门排行榜

查询指定时间范围内的谱面热度排行榜

端点: GET /hot_rank/<time_range>

路径参数:

- time_range: 统计时间范围，必填，可选值: hour, day, week, month

查询参数:

- page: 页码，从1开始，可选，默认值: 1
- per_page: 每页数量，可选，默认值: 20

响应字段说明:

- last_chart_list_update: 谱面列表最后更新时间，ISO 8601格式字符串
- last_record_update: 游玩记录最后更新时间，ISO 8601格式字符串
- page: 当前页码，整数
- per_page: 每页显示的结果数量，整数
- results: 排行榜数据数组
   - chart_id: 谱面唯一标识ID，整数
   - increase: 在指定时间范围内该谱面的游玩次数增量，整数
- time_range: 请求的时间范围，字符串
- total_results: 当前页实际返回的结果数量，整数

错误响应:

当time_range参数不合法时返回：

{
  "error": "Invalid time range"
}

3. 谱面排名详情

查询指定谱面在各个时间段的排名和增量信息

端点: GET /chart_rank/<int:chart_id>

路径参数:

- chart_id: 谱面ID，整数，必填

响应字段说明:

- chart_id: 查询的谱面ID，整数
- ranks: 各时间段排名信息对象
   - hour: 最近1小时的排名信息
      - increase: 最近1小时的游玩增量，整数
      - rank: 在最近1小时热度排行榜中的名次，整数
      - last_updated: 该排名数据的更新时间，ISO 8601格式字符串
   - day: 最近1天的排名信息
      - increase: 最近1天的游玩增量，整数
      - rank: 在最近1天热度排行榜中的名次，整数
      - last_updated: 该排名数据的更新时间，ISO 8601格式字符串
   - week: 最近1周的排名信息
      - increase: 最近1周的游玩增量，整数
      - rank: 在最近1周热度排行榜中的名次，整数
      - last_updated: 该排名数据的更新时间，ISO 8601格式字符串
   - month: 最近1月的排名信息
      - increase: 最近1月的游玩增量，整数
      - rank: 在最近1月热度排行榜中的名次，整数
      - last_updated: 该排名数据的更新时间，ISO 8601格式字符串

数据统计说明

1. 数据采集流程

定时触发（每小时1次）
    ↓
获取谱面列表（多线程并发）
    ↓
遍历所有谱面ID
    ↓
查询每个谱面的游玩记录总数
    ↓
存储当前时间点的计数
    ↓
计算各时间范围的增量
    ↓
更新排名数据

2. 增量计算方法

- 小时增量: 当前计数 - 1小时前的计数
- 日增量: 当前计数 - 1天前的计数
- 周增量: 当前计数 - 1周前的计数
- 月增量: 当前计数 - 30天前的计数

3. 排名规则

1. 按增量从高到低排序
2. 增量相同的谱面排名并列
3. 排名数字表示位置（如第1名、第2名）

数据库结构

chart_counts 表（谱面计数表）

字段说明:

- id: 主键，自增，整数
- chart_id: 谱面ID，整数
- count: 游玩记录总数，整数
- timestamp: 记录时间，ISO格式字符串

increment_ranks 表（增量排名表）

字段说明:

- id: 主键，自增，整数
- chart_id: 谱面ID，整数
- time_range: 时间范围，字符串
- increase: 增量值，整数
- rank: 排名，整数
- period_start: 统计周期开始时间，ISO格式字符串
- period_end: 统计周期结束时间，ISO格式字符串

chart_info 表（谱面信息表）

字段说明:

- chart_id: 谱面ID，主键，整数
- name: 谱面曲名，字符串
- level: 难度标签，字符串
- difficulty: 难度值，浮点数
- charter: 谱师名，字符串
- composer: 曲作者，字符串
- updated_time: 更新时间，ISO格式字符串
- last_checked: 最后检查时间，ISO格式字符串

部署说明

环境要求

- Python 3.7+
- 依赖包: flask, requests, schedule

启动命令

python app.py

默认配置

- 服务端口: 5000
- 访问地址: "http://localhost:5000" (http://localhost:5000)
- 更新间隔: 3600秒（1小时）
- API分页大小: 20
- 线程池大小: 20

注意事项

1. 数据延迟: 排行榜数据有约1小时的延迟
2. 网络依赖: 系统依赖外部API，网络异常可能影响数据采集
3. 内存使用: 大量谱面数据可能占用较多内存
4. 并发限制: 默认使用20个线程并发请求
5. 错误处理: 单个谱面采集失败不影响整体流程