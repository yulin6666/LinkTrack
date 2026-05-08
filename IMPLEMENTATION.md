# LinkTrack 项目实现文档

## 项目概述

LinkTrack 是一个短链接服务，核心功能是把长 URL 转换成短链接，并统计每条链接的点击次数。

整体架构分三层：
- **前端**：Next.js 16 + React 19 + Tailwind CSS，运行在 3000 端口
- **后端**：Node.js + Express 5 + TypeScript，运行在 3001 端口
- **数据层**：PostgreSQL（持久化存储）+ Redis（缓存）+ BullMQ（异步任务队列）

---

## 目录结构

```
LinkTrack/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.sql      # 数据库建表 SQL
│   │   │   ├── database.ts       # PostgreSQL 连接池
│   │   │   └── redis.ts          # Redis 客户端
│   │   ├── routes/
│   │   │   ├── links.ts          # 链接 CRUD 接口
│   │   │   └── redirect.ts       # 短链接跳转接口
│   │   ├── services/
│   │   │   ├── cacheService.ts   # 两级缓存
│   │   │   ├── linkService.ts    # 核心业务逻辑
│   │   │   └── queueService.ts   # BullMQ 队列封装
│   │   ├── workers/
│   │   │   └── clickLogger.ts    # 异步点击日志处理器
│   │   └── server.ts             # Express 应用入口
│   ├── .env                      # 环境变量
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── app/
│   │   ├── links/[code]/
│   │   │   └── page.tsx          # 链接统计详情页
│   │   ├── layout.tsx            # 根布局
│   │   └── page.tsx              # 首页
│   ├── components/
│   │   ├── LinkForm.tsx          # 创建短链接表单
│   │   └── LinkList.tsx          # 链接列表
│   ├── lib/
│   │   └── api.ts                # Axios 请求封装
│   ├── next.config.js            # Next.js 配置（含代理）
│   └── package.json
```

---

## 数据库设计

数据库名：`linktrack`，包含三张表。

### short_links（短链接主表）

```sql
CREATE TABLE short_links (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(10) UNIQUE NOT NULL,  -- 8位短码，如 "aB3xK9mZ"
  original_url TEXT NOT NULL,               -- 原始长链接
  created_at  TIMESTAMP DEFAULT NOW(),
  expires_at  TIMESTAMP,                    -- 过期时间（暂未启用）
  is_active   BOOLEAN DEFAULT true          -- 是否有效
);
```

### click_logs（原始点击记录）

```sql
CREATE TABLE click_logs (
  id         SERIAL PRIMARY KEY,
  link_id    INTEGER REFERENCES short_links(id),
  clicked_at TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent TEXT,
  referer    TEXT
);
```

### click_stats（聚合统计）

```sql
CREATE TABLE click_stats (
  id             SERIAL PRIMARY KEY,
  link_id        INTEGER UNIQUE REFERENCES short_links(id),
  total_clicks   INTEGER DEFAULT 0,
  last_clicked_at TIMESTAMP,
  updated_at     TIMESTAMP
);
```

`click_logs` 存每次点击的原始数据，`click_stats` 存聚合后的总点击数，查询统计时直接读 `click_stats`，不用每次 COUNT。

---

## 后端实现

### 1. 入口：server.ts

Express 应用的启动文件。关键点：**`dotenv.config()` 必须在所有其他 import 之前调用**，否则 `database.ts` 在模块加载时读不到环境变量，会用系统用户名作为数据库名导致连接失败。

```typescript
import dotenv from 'dotenv';
dotenv.config();  // 必须第一行

import express from 'express';
// ... 其他 import
```

挂载的路由：
- `/api/links` → links 路由
- `/r` → redirect 路由
- `/health` → 健康检查

### 2. 数据库连接：config/database.ts

使用 `pg` 库的连接池，最大 20 个连接：

```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### 3. Redis 连接：config/redis.ts

使用 `ioredis`，**`maxRetriesPerRequest` 必须设为 `null`**，BullMQ 要求这个配置，否则 Worker 无法启动：

```typescript
const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,  // BullMQ 强制要求
  retryStrategy: (times) => Math.min(times * 50, 2000),
});
```

### 4. 核心业务：services/linkService.ts

**创建短链接流程：**
1. 用 `new URL(url)` 验证 URL 格式，只允许 http/https
2. 用 `nanoid(8)` 生成 8 位短码（约 218 万亿种组合，碰撞概率极低）
3. 写入 `short_links` 表
4. 同时写入两级缓存（LRU + Redis）

**获取原始链接流程（重定向时调用）：**
1. 先查 L1 内存缓存（最快）
2. 未命中则查 L2 Redis 缓存
3. 再未命中才查 PostgreSQL，并回填缓存
4. 检查 `is_active` 和 `expires_at`，无效则返回 null

### 5. 两级缓存：services/cacheService.ts

```
请求 → L1 内存 LRU（1000条，微秒级）
         ↓ miss
       L2 Redis（1小时 TTL，毫秒级）
         ↓ miss
       PostgreSQL（回填缓存）
```

L1 用 JavaScript 的 `Map` 实现 LRU：Map 的迭代顺序是插入顺序，每次访问时先删除再重新插入（移到末尾），容量满时删除第一个（最久未使用）。

### 6. 异步点击日志：routes/redirect.ts + workers/clickLogger.ts

短链接跳转的核心设计：**先跳转，再记录**，不让日志写入阻塞用户的重定向速度。

```typescript
// 立即返回 302 跳转
res.redirect(302, originalUrl);

// 跳转后异步把点击事件放入队列，不等待
queueService.addClickEvent({ linkId, code, ipAddress, ... })
  .catch(err => console.error(err));
```

Worker（`clickLogger.ts`）独立进程运行，从队列消费事件：
1. 插入一条原始记录到 `click_logs`
2. 用 `INSERT ... ON CONFLICT DO UPDATE` 更新 `click_stats` 的总点击数
3. 失败自动重试 3 次（指数退避：1s、2s、4s）
4. Worker 并发数为 5

### 7. API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/links` | 创建短链接，body: `{ originalUrl }` |
| GET | `/api/links` | 获取所有链接（最多100条，按创建时间倒序） |
| GET | `/api/links/:code/stats` | 获取单条链接统计 |
| GET | `/r/:code` | 短链接跳转（302） |
| GET | `/health` | 健康检查 |

---

## 前端实现

### 1. 请求代理：next.config.js

前端运行在 3000 端口，后端在 3001 端口，直接跨域请求会被浏览器拦截。通过 Next.js 的 `rewrites` 配置代理，让所有 `/api/*` 请求在服务端转发给后端：

```javascript
async rewrites() {
  return [
    { source: '/api/:path*', destination: 'http://localhost:3001/api/:path*' },
    { source: '/r/:path*',   destination: 'http://localhost:3001/r/:path*' },
  ];
}
```

浏览器只看到同源请求，不存在跨域问题。

### 2. API 封装：lib/api.ts

用 Axios 封装三个接口，`baseURL` 设为空字符串（走 Next.js 代理）：

```typescript
const api = axios.create({ baseURL: '' });

export const createLink = (originalUrl: string) => api.post('/api/links', { originalUrl });
export const getAllLinks = () => api.get('/api/links');
export const getLinkStats = (code: string) => api.get(`/api/links/${code}/stats`);
```

### 3. 页面与组件

**首页（app/page.tsx）**：
- 渲染 `LinkForm` 和 `LinkList`
- 用 `refreshKey` 状态控制列表刷新：创建成功后递增 key，触发 `LinkList` 重新拉取数据

**LinkForm 组件**：
- 输入框 + 提交按钮
- 成功后显示短链接并提供一键复制按钮
- 错误时显示提示信息

**LinkList 组件**：
- 展示所有短链接的卡片列表
- 每张卡片显示：短码、短链接、原始链接、点击次数、创建时间
- 点击"查看统计"跳转到详情页

**统计详情页（app/links/[code]/page.tsx）**：
- 展示单条链接的完整统计信息
- 包括总点击数、最后点击时间

---

## 数据流全链路

### 创建短链接

```
用户输入 URL
  → LinkForm 调用 POST /api/links
  → Next.js 代理转发到后端
  → linkService 验证 URL
  → nanoid 生成短码
  → 写入 PostgreSQL
  → 写入 Redis 缓存 + 内存 LRU
  → 返回短链接信息
  → 前端显示短链接，刷新列表
```

### 点击短链接

```
用户点击短链接（如 http://localhost:3000/r/aB3xK9mZ）
  → Next.js 代理转发到后端 /r/aB3xK9mZ
  → 查 L1 内存缓存（命中率 >95%）
  → 立即返回 302 跳转到原始 URL
  → 异步：点击事件入 BullMQ 队列
  → Worker 消费队列：写 click_logs，更新 click_stats
```

---

## 本地启动步骤

### 前置条件

- Node.js 20+
- PostgreSQL（`brew install postgresql && brew services start postgresql`）
- Redis（`brew install redis && brew services start redis`）

### 初始化数据库

```bash
createdb linktrack
psql linktrack < backend/src/config/database.sql
```

### 启动服务（需要三个终端）

```bash
# 终端 1：后端 API
cd backend && npm run dev

# 终端 2：点击日志 Worker
cd backend && npm run worker

# 终端 3：前端
cd frontend && npm run dev
```

访问 http://localhost:3000 即可使用。

### 环境变量说明

`backend/.env`：

```
PORT=3001
DATABASE_URL=postgresql://你的用户名@localhost:5432/linktrack
REDIS_URL=redis://localhost:6379
BASE_URL=http://localhost:3001
FRONTEND_URL=http://localhost:3000
LRU_CACHE_SIZE=1000
```

---

## 关键设计决策

### 为什么用两级缓存？

单纯用 Redis 已经很快，但加一层内存 LRU 是为了应对热点链接（比如某条链接被大量转发）。内存访问是微秒级，Redis 是毫秒级，对于 QPS 极高的场景差距明显。1000 条 LRU 覆盖了绝大多数热点。

### 为什么点击日志要异步？

用户点击短链接最在意的是跳转速度，写数据库是慢操作（几毫秒到几十毫秒）。把日志写入放到队列里异步处理，跳转响应时间只取决于缓存查询速度，可以做到 P99 < 50ms。

### 为什么用 BullMQ 而不是直接写数据库？

BullMQ 提供了重试机制（失败自动重试3次）、并发控制（5个 Worker 并行）、持久化（任务存在 Redis 里，进程重启不丢失）。直接写数据库如果失败就丢了，用队列更可靠。

### 为什么 dotenv 要最先加载？

Node.js 的 ES module import 是静态的，所有 import 语句在代码执行前就已经解析完毕。`database.ts` 在被 import 时就立即创建了 `Pool` 对象，此时如果 `dotenv.config()` 还没执行，`process.env.DATABASE_URL` 就是 `undefined`，pg 会用系统用户名作为数据库名，导致连接失败。

---

## 技术栈版本

| 技术 | 版本 | 用途 |
|------|------|------|
| Node.js | 20+ | 运行时 |
| TypeScript | 6.x | 类型安全 |
| Express | 5.x | Web 框架 |
| pg | 8.x | PostgreSQL 客户端 |
| ioredis | 5.x | Redis 客户端 |
| BullMQ | 5.x | 任务队列 |
| nanoid | 5.x | 短码生成 |
| Next.js | 16.x | 前端框架 |
| React | 19.x | UI 库 |
| Tailwind CSS | 4.x | 样式 |
| Axios | 1.x | HTTP 请求 |
