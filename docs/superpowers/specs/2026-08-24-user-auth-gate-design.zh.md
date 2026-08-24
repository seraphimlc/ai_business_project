# User Auth Gate Design

[English](2026-08-24-user-auth-gate-design.md) | 中文

> 状态：已与用户确认需求与架构。本文档是实现的权威依据。目标部署：`dsh.visitworld.me`（visitworld.me 服务器，Ubuntu，nginx 反代 + Certbot TLS）。

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

新增一个宿主插件包 `packages/host/user-auth/`（认证门禁，深度 2 以满足 pnpm-workspace `packages/*/*` glob）和一个客户端插件包 `packages/client/ui-auth/`（登录页 UI）。对 `packages/host/webserver` 做**最小侵入改动**：仅新增一个可选单席位 `authenticate` 钩子字段与两个调用点（HTTP 分派前、WS upgrade 分派前），不改变任何路由语义、不回退、不涉及 session / agent 核心。

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

- 密码哈希：**Node 内置 `crypto.scrypt`**（`N=16384, r=8, p=1`——Node 默认参数，内存 16MB < 默认 maxmem 32MB；随机 16 字节 salt，输出 64 字节），格式 `$scrypt$<salt-hex>$<hash-hex>`。不引入 bcrypt 外部依赖，保持轻量。
- 文件安全：启动时用 Node `lstat` 校验为普通文件（拒绝 symlink/hardlink——参考 codex-agent-protocol 仓库 `scripts/init.py` 的安全模式，但此处用 Node 标准库实现），Unix 下 chmod 600。`$DSH_HOME/auth-sessions.json` 同样采用临时文件 + 原子 `rename` + chmod 600。
- **再读策略**：users.json 每次登录时重新读取（而非仅启动加载），保证运行中执行 `dsh user add` / `remove` 立即生效，避免运维困惑。
- **无有效账号时的门禁策略（fail-closed）**：`--host 0.0.0.0` 已被 web-app startup 明确拒绝（`packages/bundle/web-app/src/startup.ts:74-76`，"intentionally not supported yet for safety"），公网部署必然走 `127.0.0.1` + nginx 反代。因此 fail-closed 的触发条件不能依赖 `--host`，改为：**存在 `--trusted-host`**（部署者声明对外提供服务）且 users.json 缺失/损坏/无账号 → **拒绝启动 web profile**（`dsh web` 报错退出，提示运行 `dsh user add`），绝不 fail-open。仅当既无 `--trusted-host` 又无有效账号时（纯本地开发）允许 fail-open（保持可访问并告警）。

### 账号管理 CLI

在 `apps/cli` 增加 **launcher 级**子命令（`bin.ts` 的 switch + `args.ts` 新 mode，不启动 profile——先例同 `plugin` / `dump-config`，保证部署前即可创建首个账号，无需先启动 web）：

- `dsh user add <username> [--display-name NAME]`：交互式输入密码（`readline` 关闭回显），写入 users.json。
- `dsh user set-password <username>`：重置密码。
- `dsh user list`：列出用户名与显示名（不显示哈希）。
- `dsh user remove <username>`：删除账号。

所有命令在写入前做 `users.json` 读-改-写，写入临时文件后原子 `rename`（同目录，跨设备安全），失败回滚。非 TTY 环境（如 CI）下密码回显关闭受限，注明平台限制。

### 登录会话

- 登录接口：`POST /api/auth/login`，JSON body `{ "username": "...", "password": "..." }`。
  - body 大小限制 10KB；畸形 JSON → 400；`GET /api/auth/login` → 405。
  - 密码比较用 `crypto.timingSafeEqual`（长度固定为 64 字节哈希，可安全比较）。
- 校验成功 → 生成随机 32 字节 session token（`crypto.randomBytes`），服务端记录 `token → { username, displayName, expiresAt }`，签发 cookie：
  - 名：`__Host-dsh_session`（Secure + Path=/ + 无 Domain 均满足，公网零成本硬化）
  - `HttpOnly`、`SameSite=Strict`、`Path=/`
  - `Secure`（公网 HTTPS；本地开发通过配置关闭）
  - `Max-Age`：默认 24h（可配置 `--session-ttl-hours`）
- 会话存储：`$DSH_HOME/auth-sessions.json`（带 TTL，**签发/校验时惰性清理**过期项；临时文件 + 原子 rename + chmod 600）。重启不丢失（文件持久化）。
- 登出接口：`POST /api/auth/logout`，删除服务端记录并清 cookie。
- 登录校验失败：统一返回 401 + `{ "error": "invalid credentials" }`，不区分"用户不存在"与"密码错误"。
- **会话过期后的客户端行为**：SPA 已加载后若会话过期，API 返回 401 / WS 被拒时，浏览器侧统一跳转 `/login?next=<当前路径>`；WS 断开时提示"登录已过期，请重新登录"。

### 认证拦截（全局门禁）

利用 `WebServer` 扩展点（`packages/host/webserver/src/index.ts`）加一个**可选单席位 `authenticate` 钩子**。评估过的替代方案及其排除理由：

- `registerFallback` 只覆盖未匹配请求，而 `/api`（connection）、`/plugins`（modules）、WS upgrade 全部绕过 fallback，故 fallback 拦截不可行。
- `prefix: '/'` 路由经核对 `match()` 只命中 `pathname === '/'`（守卫是 `pathname !== prefix && !pathname.startsWith(prefix + '/')`，`'/' + '/' === '//'`），只能遮蔽 SPA 首页、拦不住任何其他路径，且与 fallback 分属不同席位、不会抛冲突——故也不可行。
- 事件式 gate（仿 `webserver/index-inject`）对策略判定语义含糊、多监听者有歧义。

因此采用单席位钩子（先例同 `registerFallback`）。契约：

1. **字段**：`authenticate?: (req: IncomingMessage) => Promise<AuthDecision>`，`AuthDecision = 'allow' | { status: 401, json?: unknown } | { status: 302, location: string }`。
2. **单席位**：setter + disposer；重复设置抛错（与 `registerFallback` 一致）。
3. **调用点**：`handle()` 在路由匹配**前**调用一次；upgrade 事件处理器在 upgrade 路由分派**前**调用一次。
4. **安装时机**：必须在监听（`[Service.init]` 的 `listen`）之前安装——激活顺序保证首个请求即被拦截，配套一条启动顺序集成测试。
5. **身份附加**：钩子返回 `'allow'` 前由 `user-auth` 插件自身负责把 `req.user = { username, displayName }` 附加到 `IncomingMessage`（WebServer 是通用组件、无法提供身份，此职责必须落在认证插件；TypeScript 通过模块扩展声明该字段）。
6. **WS 拒绝映射**：`AuthDecision` 的 `status` 只作用于 HTTP 响应；对 upgrade 请求，任何 deny 决策统一写 HTTP 403 后 close。**实现偏差**：为避免 host→client 反向依赖（connection 依赖 webserver），webserver 内联与 `packages/client/connection/src/websocket-downlink.ts:144` 逐字节相同的 403 响应（行为等价，不 import 该 client 函数）。

钩子由 `user-auth` 插件在 init 时注入。`user-auth` 同时注册 `exact` 路由 `/api/auth/login`、`/api/auth/logout`。

### 公开路径决策表（未认证请求）

门禁对未认证请求的判定必须精确，避免登录页自身资源死锁（登录页 JS 由 modules 插件的 `prefix: '/plugins'` 路由分发，若一律 401 则登录页 bundle 无法加载）：

| 请求 | 未认证行为 |
|---|---|
| `GET/POST /api/auth/login`、`POST /api/auth/logout`、`GET /api/auth/status` | 放行 |
| `/plugins/*`（client 插件 bundle）、`/assets/*`、其他静态资源 | 放行（bundle 加载必需；优先于页面重定向行，避免带 `Accept: text/html` 的 bundle 请求被误重定向） |
| `/login`（页面） | 放行 |
| 任意路径、`Accept: text/html` 且非 `/login` | 302 → `/login?next=<原路径>` |
| 其他 API（`/api/*` 非 auth） | 401 JSON |
| WS upgrade（`/api/events.mux`、`/api/events.host`） | 拒绝（复用 `rejectWebSocketUpgrade`，写 403） |

决策表按上到下优先级执行；无匹配行且非页面 → 401（catch-all）。已认证请求全部放行，`req` 上附加 `req.user = { username, displayName }`（TypeScript 通过模块扩展声明 `IncomingMessage.user`）。

## 第二节：登录页 UI

新增 `packages/client/ui-auth/`：

- 登录页路由 `/login`：用户名 + 密码 + 提交 + 错误提示（表单组件，复用 `ui-primitives` 样式体系）。
- 未登录访问任意页面 → 302 `/login`；登录成功 → 跳回原路径（`?next=` 参数）。
- 登出入口：放入 `ui-settings` 的通用设置页（调用 `/api/auth/logout` 后刷新）。
- 无账号时：已配置 `--trusted-host` 时 web 不启动（见第一节 fail-closed）；未配置时（本地开发）登录页提示"未配置账号，运行 `dsh user add`"，不显示表单或表单禁用。

UI 包结构遵循现有 client 插件约定：宿主半 `index.ts`（空 apply 注册 + `dsh.client` 声明），浏览器半 `src/client/`（登录页 + 登出入口）。**仓库 SPA 无路由表**：`/login` 通过浏览器半读取 `location.pathname` 并注册进 `shell.overlay` slot 挂载（见实现计划 Chunk 4）。

## 第三节：WebSocket 认证细节

- `connection` 插件的 `WebSocketDownlinks` 使用 `WebServer.registerUpgrade` 注册 upgrade 路由：`/api/events.mux`（`MUX_EVENTS_PATH`）与 `/api/events.host`（`HOST_EVENTS_PATH`），见 `packages/client/connection/src/api-path.ts`。
- `user-auth` 的 `authenticate` 钩子在 upgrade 分派前执行（见第一节拦截方案），cookie 校验失败即拒绝握手。
- 不改变 WS 协议本身；已认证连接的行为与现在完全一致。

## 第四节：安全与错误处理

- 密码哈希：scrypt（见上），users.json / auth-sessions.json 权限 600，拒绝 symlink（Node `lstat` 校验）。
- 登录限流：内存滑动窗口，每来源 IP 每 60s 最多 5 次失败；超限返回 429。**X-Forwarded-For 信任链**：仅当 socket 对端为 loopback（受信代理，nginx）时才信任 XFF，且取**最右项**（nginx 追加的 `$remote_addr`）；无 XFF 时回退到 `req.socket.remoteAddress`；直连 :3080 的对端按自身地址计数，XFF 一律不信任。滑动窗口需定期清理过期 IP 条目防内存增长。文档化：共享 NAT 下 5 次/60s 可能误伤同网段多人（可配置放宽）。
- Cookie：`__Host-dsh_session`（公网）、HttpOnly / SameSite=Strict / Secure / 24h TTL（可配）。
- **无有效账号（fail-closed）**：存在 `--trusted-host` 且 users.json 缺失/损坏/无账号 → 拒绝启动 web profile（`dsh web` 报错退出，提示运行 `dsh user add`）；仅当既无 `--trusted-host` 又无有效账号时（纯本地开发）fail-open + 告警。触发条件与第一节一致（`--host 0.0.0.0` 已被 startup 拒绝，不能作为判据）。
- 登录失败：统一 401 消息，不泄露用户存在性；密码比较用 `timingSafeEqual`。
- 会话文件损坏：视为无会话（要求重新登录），不崩溃。
- 公开路径决策表（见第一节）：auth 端点、登录页、`/plugins/*` 静态资源公开；其余拦截。

## 第五节：测试

### 单元测试（`packages/host/user-auth/tests/`）

- 密码哈希：scrypt 生成/校验、错误密码拒绝、格式解析、`timingSafeEqual` 路径。
- users.json：读取/解析/损坏处理/权限校验/symlink 拒绝/原子写/**运行中修改立即生效（再读）**。
- 会话：签发/校验/过期/登出/文件持久化/损坏文件处理。
- 限流：窗口内计数、超限拒绝、窗口重置、**XFF 伪造（首项/最右项/直连对端）**、过期条目清理。

### 集成测试

- 认证钩子：未认证请求 401/302、已认证放行、公开路径放行（含 `/plugins/*` bundle）、`req.user` 附加。
- **启动顺序**：`authenticate` 钩子在监听前安装，首个请求即被拦截。
- WS upgrade：未认证拒绝（`rejectWebSocketUpgrade`）、已认证放行。
- CLI：`dsh user add/set-password/list/remove` 全流程（临时 `$DSH_HOME`）、**移除最后一个账号后公网启动被拒**。
- 会话过期：API 401 → 浏览器跳转 `/login`；WS 被拒（403）提示。

### UI 测试

- 登录页渲染、错误提示、`?next=` 重定向、登出入口、会话过期跳转。
- 无账号提示态（loopback fail-open 时）。

## 部署（目标环境 dsh.visitworld.me）

1. 在本地仓库实现并 `pnpm run build` 通过，全量测试通过。
2. **插件组合接入**：`user-auth` 加入 `packages/bundle/web-app/cordis.patch.yml`（宿主插件行），`ui-auth` 加入 web profile 的 client roster 与 UI 组合（参照 `ui-skill` / `ui-settings` 的注册方式）。
3. **保留 `--trusted-host dsh.visitworld.me`**：connection 插件的 Host 信任围栏（`packages/client/connection/src/api-request-trust.ts` 的 `isTrustedApiRequest`/`trustedHosts`）与认证门禁正交——公网下 Host 头非 loopback，去掉 basic auth 时若一并去掉 `--trusted-host`，登录成功后所有 `/api` 与 WS 仍会被围栏 403。启动命令保持 `dsh web --no-open --host 127.0.0.1 --port 3080 --trusted-host dsh.visitworld.me`。
4. 服务器侧（root@visitworld.me）：
   - 停止当前 dsh 服务，备份 `$DSH_HOME`（含 users.json 将新建）。
   - 部署新构建产物，用 `dsh user add` 创建初始账号。
   - 启动新 dsh（仍监听 127.0.0.1:3080）。
5. nginx：从 `dsh.visitworld.me` server 块移除 `auth_basic` / `auth_basic_user_file`，`nginx -t && systemctl reload nginx`。确认防火墙只让 nginx 触达 :3080（XFF 信任的前提）。
6. 验证：
   - `curl -I https://dsh.visitworld.me/` 返回 302 → `/login`（不再是 401 basic auth）。
   - 浏览器登录后可用；登出后访问被拒。
   - WebSocket 连接在未登录时被拒（403）、登录后正常（agent 会话可用）。
   - 未登录访问 `/api/...` 返回 401；`/plugins/...` 可加载。
7. 回滚预案：保留旧 dsh 产物与 nginx 配置备份，任一步失败即恢复。

## 非目标（明确排除）

- 不实现多租户/数据隔离。
- 不实现注册、找回密码、邮箱验证、2FA、OAuth。
- 不实现 TLS（nginx 管理）。
- 不实现审计日志、角色权限分级。
- 不改动 agent loop、session 模型、事件流、持久化格式；对 webserver 仅新增可选 `authenticate` 钩子字段与两个调用点，不改变路由语义。
