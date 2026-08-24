# User Auth Gate Design

> 状态：已与用户确认需求与架构。本文档是实现的权威依据。
> 目标部署：`dsh.visitworld.me`（visitworld.me 服务器，Ubuntu，nginx 反代 + Certbot TLS）。

## 背景与目标

DeepSeek Harness（`dsh`）目前部署在公网服务器 `dsh.visitworld.me` 上，由 nginx `auth_basic` 保护。用户认为 basic auth 不正规（浏览器弹窗、无应用内登录体验、无法做账号管理），要求：

1. **去掉 nginx basic auth**。
2. **改为应用内登录门禁**：登录后才能使用整个 web 应用。
3. **预置账号列表**：用户名 + 密码（bcrypt/scrypt 哈希，存本地 `$DSH_HOME/users.json`）。
4. **保持协作现状**：不做多用户隔离、不做在线列表、不做消息归属标注、不做并发控制。会话共享/接力/互相可见是 DSH 现有行为，不动。
5. **TLS 由 nginx 反向代理管理**（Certbot 证书已就绪），dsh 只负责应用层认证。

## 需求范围（明确不做）

- 不实现多用户数据隔离（所有会话全局共享，保持现状）。
- 不实现用户在线列表。
- 不实现消息发送者标注。
- 不实现并发控制（约定同一时间一人操作一个会话）。
- 不实现注册/自助账号管理（账号由部署者预置）。
- 不实现 TLS（交给 nginx）。

## 架构总览

新增一个宿主插件包 `packages/user-auth/`（认证门禁）和一个客户端插件包 `packages/client/ui-auth/`（登录页 UI）。核心复用 DSH 现有 WebServer 扩展点，不改动 webserver / session / agent 核心。

```
浏览器 ──HTTPS──> nginx（TLS + 反代，去掉 auth_basic）──> dsh web :3080
                                                            │
                                          ┌─────────────────┴───────────────┐
                                          │ user-auth 插件（宿主侧）          │
                                          │  · users.json 账号校验            │
                                          │  · session cookie 签发/校验        │
                                          │  · HTTP 路由注册（登录/登出）       │
                                          │  · 全局认证拦截（含 WS upgrade）    │
                                          └─────────────────┬───────────────┘
                                                            │
                                          ui-auth 插件（浏览器侧）：登录页 UI
```

## 第一节：认证架构

### 账号存储 `$DSH_HOME/users.json`

与 `~/.dsh/.anonymous-user-id` 同级。格式：

```json
{
  "version": 1,
  "users": [
    { "username": "alice", "passwordHash": "$scrypt$...", "displayName": "Alice" }
  ]
}
```

- 密码哈希：**Node 内置 `crypto.scrypt`**（`N=16384, r=8, p=1`，随机 16 字节 salt，输出 64 字节），格式 `$scrypt$<salt-hex>$<hash-hex>`。不引入 bcrypt 外部依赖，保持轻量。
- 文件权限：启动时若存在则校验为普通文件（拒绝 symlink/hardlink，复用 `scripts/init.py` 的安全模式），Unix 下 chmod 600。
- 缺失或损坏：启动告警；**无有效账号时 web 认证门禁不启用**（保持可访问），并提示先运行账号管理命令。

### 账号管理 CLI

在 `apps/cli` 增加子命令：

- `dsh user add <username> [--display-name NAME]`：交互式输入密码（`readline` 关闭回显），写入 users.json。
- `dsh user set-password <username>`：重置密码。
- `dsh user list`：列出用户名与显示名（不显示哈希）。
- `dsh user remove <username>`：删除账号。

所有命令在写入前做 `users.json` 读-改-写，写入临时文件后原子 `rename`，失败回滚。

### 登录会话

- 登录接口：`POST /api/auth/login`，JSON body `{ "username": "...", "password": "..." }`。
- 校验成功 → 生成随机 32 字节 session token（`crypto.randomBytes`），服务端记录 `token → { username, displayName, expiresAt }`，签发 cookie：
  - 名：`dsh_session`
  - `HttpOnly`、`SameSite=Strict`、`Path=/`
  - `Secure`（公网 HTTPS；本地开发通过配置关闭）
  - `Max-Age`：默认 24h（可配置 `--session-ttl`）
- 会话存储：`$DSH_HOME/auth-sessions.json`（带 TTL，启动时清理过期项）。重启不丢失（文件持久化）。
- 登出接口：`POST /api/auth/logout`，删除服务端记录并清 cookie。
- 登录校验失败：统一返回 401 + `{ "error": "invalid credentials" }`，不区分"用户不存在"与"密码错误"。

### 认证拦截（全局门禁）

利用 `WebServer` 三个扩展点（`packages/host/webserver/src/index.ts`）：

1. **HTTP 请求拦截**：`user-auth` 插件在 `registerFallback` 之前注册一个 `prefix: '/'` 路由不可行（route 冲突由 webserver 拒绝）。改为：插件监听 `webserver/index-inject` 之外的机制不可行。**方案**：在 `WebServer` 服务上新增一个可选的 `authenticate` 钩子（Service 字段），`handle()` 在路由匹配前调用；`user-auth` 插件在 init 时注入该钩子。这是对 webserver 的最小侵入改动（一个可选字段 + 一个调用点）。
   - 未认证且路径为公开路径（`/api/auth/login`、`/api/auth/logout`、静态登录页资源）→ 放行
   - 未认证且是页面请求（Accept: text/html）→ 302 到 `/login`
   - 未认证且是 API/其他 → 401 JSON
   - 已认证 → 放行（`req` 上附加 `req.user = { username, displayName }`）
2. **WebSocket upgrade 拦截**：同样通过 `authenticate` 钩子在 upgrade 分派前校验 cookie；未认证 → socket 拒绝（`socket.write` HTTP 401 后 `socket.destroy()`）。
3. **登录/登出路由**：`user-auth` 插件注册 `exact` 路由 `/api/auth/login`、`/api/auth/logout`。

## 第二节：登录页 UI

新增 `packages/client/ui-auth/`：

- 登录页路由 `/login`：用户名 + 密码 + 提交 + 错误提示（表单组件，复用 `ui-primitives` 样式体系）。
- 未登录访问任意页面 → 302 `/login`；登录成功 → 跳回原路径（`?next=` 参数）。
- 登出入口：在 `ui-settings` 或头部加入"登出"按钮（调用 `/api/auth/logout` 后刷新）。
- 无账号时（门禁未启用）：登录页提示"未配置账号，运行 `dsh user add`"，不显示表单或表单禁用。

UI 包结构遵循现有 client 插件约定：宿主半 `index.ts`（空 apply 注册 + `dsh.client` 声明），浏览器半 `src/client/`（登录页 + 登出入口 + 路由注册到现有路由表）。

## 第三节：WebSocket 认证细节

- `connection` 插件的 `WebSocketDownlinks` 使用 `WebServer.registerUpgrade` 注册 upgrade 路由（路径 `/api/ws` 或类似）。
- `user-auth` 的 `authenticate` 钩子在 upgrade 分派前执行（见第一节拦截方案），cookie 校验失败即拒绝握手。
- 不改变 WS 协议本身；已认证连接的行为与现在完全一致。

## 第四节：安全与错误处理

- 密码哈希：scrypt（见上），users.json 权限 600，拒绝 symlink。
- 登录限流：内存滑动窗口，每 IP（取 `X-Forwarded-For` 首项，nginx 已设置）每 60s 最多 5 次失败；超限返回 429。
- Cookie：HttpOnly / SameSite=Strict / Secure / 24h TTL。
- users.json 缺失/无账号：门禁禁用 + 启动告警 + 登录页提示。
- 登录失败：统一 401 消息，不泄露用户存在性。
- 会话文件损坏：视为无会话（要求重新登录），不崩溃。
- 登录/登出/静态资源路径始终公开；其余全部拦截。

## 第五节：测试

### 单元测试（`packages/user-auth/tests/`）

- 密码哈希：scrypt 生成/校验、错误密码拒绝、格式解析。
- users.json：读取/解析/损坏处理/权限校验/symlink 拒绝/原子写。
- 会话：签发/校验/过期/登出/文件持久化。
- 限流：窗口内计数、超限拒绝、窗口重置。

### 集成测试

- 认证钩子：未认证请求 401/302、已认证放行、公开路径放行、`req.user` 附加。
- WS upgrade：未认证拒绝、已认证放行。
- CLI：`dsh user add/set-password/list/remove` 全流程（临时 `$DSH_HOME`）。

### UI 测试

- 登录页渲染、错误提示、`?next=` 重定向、登出入口。
- 无账号提示态。

## 部署（目标环境 dsh.visitworld.me）

1. 在本地仓库实现并 `pnpm run build` 通过，全量测试通过。
2. 服务器侧（root@visitworld.me）：
   - 停止当前 dsh 服务（systemd 或当前进程 354031），备份 `$DSH_HOME`。
   - 部署新构建产物（`dsh` 可执行 + 相关 packages）到服务器，用 `dsh user add` 创建初始账号。
   - 启动新 dsh。
3. nginx：从 `dsh.visitworld.me` server 块移除 `auth_basic` / `auth_basic_user_file`，`nginx -t && systemctl reload nginx`。
4. 验证：
   - `curl -I https://dsh.visitworld.me/` 返回 302 → `/login`（不再是 401 basic auth）。
   - 浏览器登录后可用；登出后访问被拒。
   - WebSocket 连接在未登录时被拒、登录后正常（agent 会话可用）。
5. 回滚预案：保留旧 dsh 产物与 nginx 配置备份，任一步失败即恢复。

## 非目标（明确排除）

- 不实现多租户/数据隔离。
- 不实现注册、找回密码、邮箱验证、2FA、OAuth。
- 不实现 TLS（nginx 管理）。
- 不实现审计日志、角色权限分级。
- 不改动 agent loop、session 模型、事件流、持久化格式。
