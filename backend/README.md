# HSH-Phira 后端重制版

## 运行方式

### 开发环境

本项目使用 uv 进行管理。假设您已经克隆（完整）仓库至目录 HSNPhira，并且安装了 uv，接下来以此执行下面的命令：

```bash
# 进入后端目录
cd HSNPhira/backend
# 安装依赖
uv sync
# 初始化数据库（仅在第一次运行服务器之前运行）
uv run flask seed_db
# 运行
uv run flask run --debug --host=0.0.0.0 --port=5000
```

### 生产环境

咕。

## API 文档

### 用户管理 api

#### 用户权限

本项目通过用户组的方式实现权限管理。每个组具有属性 permissions，这是一个位掩码，其中一些值如下：

| 标识               | 值           | 解释               |
| ------------------ | ------------ | ------------------ |
| `NONE`             | `0`          | 没有任何权限       |
| `ALL`              | `0xffffffff` | 拥有所有权限       |
| `IMPORT`           | `0x00000001` | 表示用户为重要用户 |
| `USER_MANAGEMENT`  | `0x00000002` | 拥有用户管理权限   |
| `GROUP_MANAGEMENT` | `0x00000004` | 拥有用户组管理权限 |

初始时会创建一个用户和三个用户组：

| 用户名 | 用户 ID | 用户所属组  |
| ------ | ------- | ----------- |
| root   | 1       | super_admin |

| 组名  | 组 ID | 拥有权限                       |
| ----- | ----- | ------------------------------ |
| root  | 1     | `ALL`                          |
| admin | 2     | `IMPORTANT`、`USER_MANAGEMENT` |
| user  | 3     | `NONE`                         |

---

#### `POST /api/auth/login`

**说明**：登录用户

**请求数据格式**：

```json
{
  "username": /*字符串，用户名*/,
  "password": /*字符串，密码*/,
  "remember": /*布尔值，是否记住用户*/
}
```

---

#### `POST /api/auth/logout`

**说明**：登出用户

---

#### `GET /api/auth/me`

**说明**：获取当前用户信息

**响应数据格式**：

```json
{
  "id": /*整数，用户 ID*/,
  "group_id": /*整数，用户所在组 ID*/,
  "username": /*字符串，用户名*/,
  "phira_id": /*整数，用户的绑定的 Phira 账号 ID*/,
  "phira_username": /*字符串，用户的 Phira 用户名*/,
  "phira_rks": /*浮点数，用户的 Phira rks*/,
  "phira_avatar": /*字符串，用户的 Phira 头像链接*/,
  "register_time": /*时间字符串，用户注册时间*/,
  "last_login_time": /*时间字符串，用户上次登录时间*/,
  "last_sync_time": /*时间字符串，用户上次同步 Phira 账号数据时间*/ 
}
```

---

#### `POST /api/auth/users`

**说明**：创建用户

**请求数据格式**：

```json
{
  "group_id": /*整数，可选，用户所在组 ID，默认值为 3（user 组）*/,
  "username": /*字符串，用户名*/,
  "phira_id": /*整数，用户的绑定的 Phira 账号 ID*/,
  "password": /*字符串，用户密码*/
}
```

**特殊说明**：若指定了 `group_id` 字段，则要求请求者拥有 `GROUP_MANAGEMENT` 权限。

---

#### `GET /api/auth/users`

**说明**：获取用户列表

**响应数据格式**：

```json
[
  { /*每项为一个符合 /api/auth/me 响应格式的 object*/ }
]
```

---

#### `GET /api/auth/users/<int:id>`

**说明**：获取用户 ID 为 `id` 的用户信息

**响应数据格式**：一个符合 `/api/auth/me` 响应格式的 object

---

#### `PATCH /api/auth/users/<int:id>`

**说明**：修改用户 ID 为 `id` 的用户信息

**请求数据格式**：

```json
{
  "group_id": /*整数，可选，用户所在组 ID，默认值为 3（user 组）*/,
  "username": /*字符串，可选，用户名*/,
  "phira_id": /*整数，可选，用户的绑定的 Phira 账号 ID*/,
  "password": /*字符串，可选，用户密码*/
}
```

---

#### `DELETE /api/auth/users/<int:id>`

**说明**：删除用户 ID 为 `id` 的用户

**响应数据格式**：

```json
{
  "message": "success"
}
```

---

#### `GET /api/auth/groups`

**说明**：获取用户组列表

**响应数据格式**：

```json
[
  {
    "id": /*整数，用户组 ID*/,
    "name": /*字符串，用户组名称*/,
    "permissions": /*整数，用户组的位掩码值*/
  },
  /*每项为一个符合以上格式的 object*/
]
```

---

#### `POST /api/auth/groups`

**说明**：创建用户组

**请求数据格式**：

```json
{
  "name": /*字符串，用户组名称*/,
  "permissions": /*整数，用户组权限*/
}
```

**特殊说明**：需要 `GROUP_MANAGEMENT` 权限

---

#### `GET /api/auth/groups/<int:id>`

**说明**：获取用户组 ID 为 `id` 的用户组信息

**响应数据格式**：一个符合 `/api/auth/groups` 每一项格式的 object

---

#### `PATCH /api/auth/groups/<int:id>`

**说明**：修改用户组 ID 为 `id` 的用户组信息

**请求数据格式**：

```json
{
  "name": /*字符串，用户组名称*/,
  "permissions": /*整数，用户组权限*/
}
```

---

#### `DELETE /api/auth/groups/<int:id>`

**说明**：删除用户组 ID 为 `id` 的用户组

**响应数据格式**：

```json
{
  "message": "success"
}
```

### 房间管理 api

#### `GET /api/rooms/info`

**说明**：获取房间列表

**响应数据格式**：

```json
[
  {
    "name": /*字符串，房间名称*/,
    "data": { // 房间数据
      "host": /*整数，房间 host 的 Phira ID*/,
      "users": /*列表，包含房间内所有用户 Phira ID*/,
      "lock": /*布尔值，房间是否为 lock*/,
      "cycle": /*布尔值，房间是否为 cycle*/,
      "chart": /*整数或 null，房间当前选择的铺面 ID*/,
      "state": /*字符串，SELECTING_CHART 或 WAITING_FOR_READY 或 PLAYING*/,
      "playing_users": /*列表，包含还在进行游戏的用户 ID*/,
      "rounds": [ // 房间已经进行过的所有轮游戏的信息
        {
          "chart": /*整数，该轮铺面 ID*/，
          "records": [ // 该轮玩家成绩信息
            {
              "id": /*整数，记录 ID*/,
              "player": /*整数，玩家 ID*/,
              "score": /*整数，分数*/,
              "perfect": /*整数，perfect 数量*/,
              "good": /*整数，good 数量*/,
              "bad": /*整数，bad 数量*/,
              "miss": /*整数，miss 数量*/,
              "max_combo": /*整数，max combo 数*/,
              "accuracy": /*浮点数，精准度*/,
              "full_combo": /*布尔值，是否 full combo*/,
              "std": /*浮点数，无暇度*/,
              "std_score": /*浮点数，无暇度分数*/
            },
            /*每项为一个符合以上格式的 object*/
          ]
        },
        /*每项为一个符合以上格式的 object*/
      ],
    }
  },
  /*每项为一个符合以上格式的 object*/
]
```

---

#### `GET /api/rooms/info/<string:name>`

**说明**：获取房间名称为 `name` 的房间信息

**响应数据格式**：一个符合 `/api/rooms/info` 每一项格式的 object

---

#### `GET /api/rooms/user/<int:user_id>`

**说明**：获取用户 ID 为 `user_id` 的用户所在房间信息

**响应数据格式**：一个符合 `/api/rooms/info/<string:name>` 响应格式的 object

---

#### `GET /api/rooms/listen`

**说明**：监听房间信息更新

**响应数据格式**：一个事件流（Event Stream），每个事件的格式如下：

```json
event: /*字符串，事件类型*/
data: /*字符串，可解析为一个 json object*/
```

**特殊说明**：此接口使用 Server-Sent Events（SSE）协议，客户端需要支持 SSE。不同事件类型如下：

| 事件类型       | 数据格式                                                     | 说明         |
| -------------- | ------------------------------------------------------------ | ------------ |
| `create_room`  | `{"room": /*字符串，房间名*/, "data": /*房间数据，格式见上文*/}` | 新房间       |
| `update_room`  | `{"room": /*字符串，房间名*/, "data": /*部分房间数据*/}`     | 房间数据更新 |
| `join_room`    | `{"room": /*字符串，房间名*/, "user": /*整数，用户 Phira ID*/}` | 用户加入房间 |
| `leave_room`   | `{"room": /*字符串，房间名*/, "user": /*整数，用户 Phira ID*/}` | 用户离开房间 |
| `player_score` | `{"room": /*字符串，房间名*/, "record": /*记录数据，格式见上文*/}` | 玩家完成游戏 |
|                |                                                              |              |

