# User Auth Gate Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 DeepSeek Harness 增加应用内登录门禁（预置账号 + 密码 + session cookie），替换公网部署 dsh.visitworld.me 上现有的 nginx basic auth。

**Architecture:** 新增宿主插件 `packages/host/user-auth/`（账号存储、会话签发、认证钩子）与客户端插件 `packages/client/ui-auth/`（登录页 UI）。对 `packages/host/webserver` 做最小侵入改动：新增可选单席位 `authenticate` 钩子字段与两个调用点（HTTP 分派前、WS upgrade 分派前）。`user-auth` 通过 CLI launcher 子命令（`dsh user ...`）管理账号。公网部署保留 `--trusted-host dsh.visitworld.me`，nginx 去掉 basic auth。

**Tech Stack:** TypeScript、Node 内置 `crypto`（scrypt/randomBytes/timingSafeEqual）、Cordis 插件体系、Vite/tsdown client 构建、vitest。

**权威规格:** `docs/superpowers/specs/2026-08-24-user-auth-gate-design.md`

---

## Chunk 1: WebServer `authenticate` 钩子

### Task 1.1: 给 WebServer 增加 `authenticate` 钩子字段与 setter/disposer

**Files:**
- Modify: `packages/host/webserver/src/index.ts`
- Test: `packages/host/webserver/tests/webserver.spec.ts`

**背景:** `WebServer`（`packages/host/webserver/src/index.ts`）目前提供 `register()`（HTTP 路由）、`registerUpgrade()`（WS 路由）、`registerFallback()`（SPA 回退）。认证门禁需要在**任何路由分派之前**拦截请求，因此新增一个可选单席位 `authenticate` 钩子，先例同 `registerFallback`。

- [ ] **Step 1: 写失败测试（单席位语义 + 调用时机）**
  在 `packages/host/webserver/tests/webserver.spec.ts` 追加：

  ```ts
  it('authenticate hook runs before route dispatch and is single-seat', async () => {
    // 通过 loadComposition() 启动真实 server（参考现有测试模式）
    // 1) setAuthenticate(fn) 后，请求命中钩子；fn 返回 'allow' 时正常放行，
    //    返回 { status: 401, json: { error: 'unauthorized' } } 时响应 401。
    // 2) 第二次 setAuthenticate(fn2) 必须抛错（单席位）。
  })
  ```

- [ ] **Step 2: 运行测试确认失败**
  Run: `pnpm exec vitest run packages/host/webserver`
  Expected: FAIL（`setAuthenticate` 不存在）

- [ ] **Step 3: 实现 `authenticate` 钩子**
  在 `packages/host/webserver/src/index.ts` 中：

  ```ts
  /** 认证决策：'allow' 放行；否则带 HTTP 状态与可选 JSON body（302 带 location）。 */
  export type AuthDecision =
    | 'allow'
    | { status: 401; json?: unknown }
    | { status: 302; location: string }

  // WebServer 类内新增字段：
  private authenticateHook: ((req: IncomingMessage) => Promise<AuthDecision>) | undefined

  /** 注册单席位认证钩子（重复设置抛错，先例同 registerFallback）。 */
  setAuthenticate(fn: (req: IncomingMessage) => Promise<AuthDecision>): () => void {
    if (this.authenticateHook !== undefined) {
      throw new Error('webserver: authenticate hook already registered')
    }
    this.authenticateHook = fn
    return () => { this.authenticateHook = undefined }
  }
  ```

- [ ] **Step 4: 在 `handle()` 路由匹配前调用钩子**
  修改 `handle`（`[Service.init]` 内）：

  ```ts
  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const rawPath = new URL(req.url ?? '/', 'http://x').pathname
    const hook = this.authenticateHook
    if (hook !== undefined) {
      const decision = await hook(req)
      if (decision !== 'allow') {
        if (decision.status === 401) {
          res.writeHead(401, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(decision.json ?? { error: 'unauthorized' }))
        } else if (decision.status === 302) {
          res.writeHead(302, { Location: decision.location })
          res.end()
        }
        return
      }
    }
    const route = this.match(rawPath)
    // ...原有逻辑不变
  }
  ```

- [ ] **Step 5: 在 upgrade 事件处理器中调用钩子（deny → socket 拒绝）**
  修改 `this.server.on('upgrade', ...)` 处理器，在 `this.upgrades.get(...)` 之前：

  ```ts
  const hook = this.authenticateHook
  if (hook !== undefined) {
    try {
      const decision = await hook(req)
      if (decision !== 'allow') {
        // WS deny 统一写 403 后 close（与 connection 的 rejectWebSocketUpgrade 一致）
        socket.end([
          'HTTP/1.1 403 Forbidden',
          'Connection: close',
          'Content-Type: text/plain; charset=utf-8',
          'Content-Length: 9',
          '',
          'forbidden',
        ].join('\r\n'))
        return
      }
    } catch (error) {
      this.ctx.logger.warn(error instanceof Error ? error : new Error(String(error)))
      socket.destroy()
      return
    }
  }
  ```

  **注意:** upgrade 处理器当前是同步函数；`await` 需要把该回调改为 `async`（或内部立即执行 async 函数），并保持 socket error 处理不变。

- [ ] **Step 6: 运行测试确认通过**
  Run: `pnpm exec vitest run packages/host/webserver`
  Expected: PASS（原有 + 新增测试）

- [ ] **Step 7: 检查 mock 涟漪**
  `packages/client/connection/tests/node-half.host.spec.ts` 等测试中对 `WebServer` 的 `Pick<WebServer, ...>` mock 若因新方法受影响，补充 `setAuthenticate` stub。

- [ ] **Step 8: 提交**
  ```bash
  git add packages/host/webserver/src/index.ts packages/host/webserver/tests/webserver.spec.ts packages/client/connection/tests/node-half.host.spec.ts
  git commit -m "feat(webserver): add single-seat authenticate hook before route and upgrade dispatch"
  ```

---

## Chunk 2: `user-auth` 宿主插件（核心认证）

**新包注册（本 Chunk 所有 Task 的前置，Task 2.1 Step 0 完成）：**

- Create: `packages/host/user-auth/package.json` — name `@deepseek-ai/dsh-user-auth`，`type: module`、`main: lib/index.js`、`types: lib/types/index.d.ts`、`exports` 含 `"."` 与 `"./invariant"`、`files` 含 `lib/index.js lib/invariant.js lib/types/**/*.d.ts`；`peerDependencies` + `devDependencies` 含 `@deepseek-ai/cordis`、`@deepseek-ai/dsh-invariants`、`@deepseek-ai/dsh-home-paths`、`@deepseek-ai/dsh-atomic-write`、`@deepseek-ai/dsh-host-webserver`（均 `workspace:^`）。
- Create: `packages/host/user-auth/tsconfig.json` — `extends` 仓库 base 并 `references` 依赖：`../../runtime-diagnostics/invariants`、`../../util/atomic-write`、`../../util/home-paths`、`../webserver`（host 组内）。
- Create: `packages/host/user-auth/src/invariant.ts` — 仓库 invariant 配套：注册包名 `dsh-user-auth`、named-export `name/inject/apply`、本地 `install` fn（被 `scripts/package-invariants.ts` 门禁强制）。
- Modify: `tsconfig.host.json` — `references` 追加 `{ "path": "./packages/host/user-auth" }`（否则 `tsc -b` 不会构建它）。
- Modify: `packages/bundle/web-app/package.json` — `dependencies` 追加 `"@deepseek-ai/dsh-user-auth": "workspace:^"`（每个组合插件都必须显式声明，否则 roster 无法解析）。
- Modify: `apps/cli/package.json` — `dependencies` 追加 `"@deepseek-ai/dsh-user-auth": "workspace:^"`（供 `apps/cli/src/user.ts` import）。
- Create: `packages/host/user-auth/README.md`、`README.i18n.yaml`、`README.zh.md`（doc-sync 门禁要求三件套）。

**测试命令约定（本仓库无 per-package `test` script，一律用根级 vitest 路径过滤）：**

```bash
pnpm exec vitest run packages/host/user-auth
pnpm exec vitest run packages/host/user-auth/tests/hash.spec.ts
```

**复用既有工具（不要重复实现）：**

- `resolveDshHome` / `dshHomePath`：从 `@deepseek-ai/dsh-home-paths` import（`packages/util/home-paths/src/index.ts`），不要自己解析 `$DSH_HOME`。
- `writeFileAtomic`：从 `@deepseek-ai/dsh-atomic-write` import（`packages/util/atomic-write/src/index.ts`，临时文件 + 原子 rename + 权限），不要手写 temp+rename+chmod。

### Task 2.1: 包脚手架与 scrypt 密码哈希

**Files:**
- Create: `packages/host/user-auth/src/hash.ts`
- Test: `packages/host/user-auth/tests/hash.spec.ts`

- [ ] **Step 1: 写失败测试（hash.ts）**
  `packages/host/user-auth/tests/hash.spec.ts`：

  ```ts
  import { describe, expect, it } from 'vitest'
  import { hashPassword, verifyPassword } from '../src/hash.ts'

  describe('scrypt password hashing', () => {
    it('hashes and verifies a correct password', async () => {
      const hash = await hashPassword('correct horse battery staple')
      expect(hash.startsWith('$scrypt$')).toBe(true)
      await expect(verifyPassword('correct horse battery staple', hash)).resolves.toBe(true)
    })

    it('rejects a wrong password', async () => {
      const hash = await hashPassword('correct')
      await expect(verifyPassword('wrong', hash)).resolves.toBe(false)
    })

    it('rejects malformed hash strings', async () => {
      await expect(verifyPassword('x', 'not-a-hash')).resolves.toBe(false)
      await expect(verifyPassword('x', '')).resolves.toBe(false)
    })
  })
  ```

- [ ] **Step 2: 运行测试确认失败**
  Run: `pnpm exec vitest run packages/host/user-auth`
  Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 `hash.ts`**
  ```ts
  import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
  import { promisify } from 'node:util'

  const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number, options: { N: number; r: number; p: number }) => Promise<Buffer>

  const N = 16384, r = 8, p = 1, KEYLEN = 64, SALT_LEN = 16
  const PREFIX = '$scrypt$'

  export async function hashPassword(password: string): Promise<string> {
    const salt = randomBytes(SALT_LEN)
    const key = await scrypt(password, salt, KEYLEN, { N, r, p })
    return `${PREFIX}${salt.toString('hex')}$${key.toString('hex')}`
  }

  export async function verifyPassword(password: string, stored: string): Promise<boolean> {
    if (typeof stored !== 'string' || !stored.startsWith(PREFIX)) return false
    const parts = stored.slice(PREFIX.length).split('$')
    if (parts.length !== 2) return false
    const [saltHex, hashHex] = parts
    if (!/^[0-9a-f]{32}$/.test(saltHex) || !/^[0-9a-f]{128}$/.test(hashHex)) return false
    const salt = Buffer.from(saltHex, 'hex')
    const expected = Buffer.from(hashHex, 'hex')
    const actual = await scrypt(password, salt, KEYLEN, { N, r, p })
    return timingSafeEqual(actual, expected)
  }
  ```

- [ ] **Step 4: 运行测试确认通过**
  Run: `pnpm exec vitest run packages/host/user-auth`
  Expected: PASS

- [ ] **Step 5: 提交**
  ```bash
  git add packages/host/user-auth
  git commit -m "feat(user-auth): scrypt password hashing"
  ```

### Task 2.2: `users-store.ts`（读取/校验/原子写/再读）

**Files:**
- Create: `packages/host/user-auth/src/users-store.ts`
- Test: `packages/host/user-auth/tests/users-store.spec.ts`

**说明:** 不新建 `paths.ts`——`$DSH_HOME` 解析直接 import `resolveDshHome` / `dshHomePath` from `@deepseek-ai/dsh-home-paths`；原子写直接 import `writeFileAtomic` from `@deepseek-ai/dsh-atomic-write`。

- [ ] **Step 1: 写失败测试**
  - 读取合法 users.json → 返回用户列表。
  - 缺失文件 → 空列表 + `exists=false`。
  - 损坏 JSON → 抛错（由调用方决定 fail-closed）。
  - symlink 路径 → 拒绝（`lstat` 校验非符号链接）。
  - `write(file)`：用 `writeFileAtomic` 写入（临时文件 + 原子 rename + 权限 600）。
  - **再读语义**：写后重新 `load()` 返回新内容（供 CLI 运行中生效）。

- [ ] **Step 2: 运行确认失败**

- [ ] **Step 3: 实现 `users-store.ts`**
  ```ts
  import { lstatSync, readFileSync } from 'node:fs'
  import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'

  export interface StoredUser {
    username: string
    passwordHash: string
    displayName: string
  }

  export interface UsersFile {
    version: 1
    users: StoredUser[]
  }

  export interface UsersStore {
    /** users.json 是否存在（决定 fail-closed 判断）。 */
    readonly exists: boolean
    /** 读取当前用户列表（每次调用重新读盘）。 */
    load(): StoredUser[]
    /** 原子写入整个文件（writeFileAtomic，权限 600）。 */
    write(file: UsersFile): Promise<void>
  }

  export function openUsersStore(usersPath: string): UsersStore {
    // lstat：若路径存在且为符号链接 → throw
    // 读取：缺失 → exists=false；JSON 解析失败/结构非法 → throw
    // write：writeFileAtomic(usersPath, JSON.stringify(file), { mode: 0o600 })
  }
  ```

- [ ] **Step 4: 运行确认通过**

- [ ] **Step 5: 提交**
  ```bash
  git commit -m "feat(user-auth): users store with atomic write and re-read"
  ```

### Task 2.3: 会话管理（签发/校验/过期/持久化）

**Files:**
- Create: `packages/host/user-auth/src/sessions.ts`
- Test: `packages/host/user-auth/tests/sessions.spec.ts`

**说明:** 会话文件路径用 `dshHomePath('auth-sessions.json')`；原子写复用 `writeFileAtomic`（mode 600）。

- [ ] **Step 1: 写失败测试**
  - `createSession(username, displayName, ttlMs)` → 返回 token（32 字节 hex）。
  - `validateSession(token)` → 有效返回 `{ username, displayName }`；未知/过期 token → null。
  - 持久化：会话写入文件后重新加载仍有效（重启不丢）。
  - **惰性清理**：校验/签发时顺带删除过期条目。
  - 损坏会话文件 → 视为无会话（不崩溃，返回空）。

- [ ] **Step 2: 运行确认失败**

- [ ] **Step 3: 实现 `sessions.ts`**
  - token 用 `randomBytes(32).toString('hex')`。
  - 记录 `{ token, username, displayName, expiresAt }`，存 `auth-sessions.json`（`writeFileAtomic` + 600）。
  - `validateSession`：读文件 → 按 token 查找 → 过期删除并写回 → 返回记录或 null。
  - 文件损坏/缺失 → 返回 null（fail-closed）。

- [ ] **Step 4: 运行确认通过**

- [ ] **Step 5: 提交**
  ```bash
  git commit -m "feat(user-auth): session store with TTL, persistence, lazy cleanup"
  ```

### Task 2.4: 登录限流（XFF 信任链）

**Files:**
- Create: `packages/host/user-auth/src/rate-limit.ts`
- Test: `packages/host/user-auth/tests/rate-limit.spec.ts`

- [ ] **Step 1: 写失败测试**
  - 每来源 60s 内第 6 次失败 → 拒绝（limit=5）。
  - 窗口过期后重置。
  - `clientIp(req, socketRemote)`：对端为 loopback 时取 XFF **最右项**；否则忽略 XFF 用 socket 地址；无 XFF 用 socket 地址。
  - 过期 IP 条目被清理（防内存增长）。

- [ ] **Step 2: 运行确认失败**

- [ ] **Step 3: 实现 `rate-limit.ts`**
  ```ts
  import type { IncomingMessage } from 'node:http'

  export interface RateLimiter {
    /** 记录一次失败；返回 true=放行，false=超限。 */
    recordFailure(key: string, now: number): boolean
    /** 从请求解析来源 IP（信任链见规格第四节）。 */
    clientIp(req: IncomingMessage, socketRemote: string | undefined): string
  }

  export function createRateLimiter(opts: { limit: number; windowMs: number }): RateLimiter
  ```

- [ ] **Step 4: 运行确认通过**

- [ ] **Step 5: 提交**
  ```bash
  git commit -m "feat(user-auth): login rate limiter with XFF trust chain"
  ```

### Task 2.5: 插件主体（认证钩子 + 登录/登出路由 + fail-closed 启动）

**Files:**
- Create: `packages/host/user-auth/src/index.ts`（apply 主体）
- Create: `packages/host/user-auth/src/cookie.ts`（cookie 属性与 Secure 开关）
- Test: `packages/host/user-auth/tests/plugin.spec.ts`（组合级）
- Test: `packages/host/user-auth/tests/cookie.spec.ts`

**启动顺序（关键，评审强制）:** Cordis Loader 对所有配置行**并发**激活（`Promise.allSettled(config.map(create))`），`[Service.init]`（含 webserver `listen`）在激活时执行，因此**不能依赖 cordis.patch.yml 行序**保证 `setAuthenticate` 先于 `listen`。方案：

1. `user-auth` 的 apply 通过 `ctx.inject(['webServer'], ...)` **同步**调用 `setAuthenticate`（在 webserver 服务存在即注入，即使 listen 尚未完成也先于首个请求）。
2. 更稳妥：`user-auth` 通过 `ctx.inject(['webServer'])` 注入，在注入回调内**立即**设置钩子——Cordis 保证依赖服务先于消费者初始化完成，且 `listen` 只在 `[Service.init]` 完成后才 accept 连接，注入回调必然先于任何 socket 请求。
3. 用真实组合测试验证：启动后**第一个**请求即被钩子处理（见 Step 1 测试）。

**fail-closed 数据流:** `user-auth` 的配置行必须在 `cordis.patch.yml` 中 `inject: [webStartup]`（参照 webserver 行 `packages/bundle/web-app/cordis.patch.yml:121-126`），并通过 `config` 表达式拿到 `trustedHosts`。Task 4.3 的注册行必须包含：

```yaml
- id: user-auth
  name: '@deepseek-ai/dsh-user-auth'
  inject: [webStartup]
  config:
    trustedHosts: !!js 'ctx.webStartup.trustedHosts'
    sessionTtlHours: !!js 'ctx.webStartup.sessionTtlHours'
    secureCookie: !!js 'ctx.webStartup.secureCookie'
```

其中 `trustedHosts/sessionTtlHours/secureCookie` 来自 `packages/bundle/web-app/src/startup.ts` 新增的 flag（见 Task 4.3b）。本地开发（无 `--trusted-host`）→ `trustedHosts=[]` → fail-open 路径。

**HTTP vs upgrade 判别:** 共享钩子用 `req.headers.upgrade` 区分：存在 `upgrade` 头 → WS 请求，任何 deny 决策统一 `rejectWebSocketUpgrade`（403）；否则按 HTTP 决策表（401/302/allow）。

- [ ] **Step 1: 写失败测试（组合级）**
  - 用 test-only cordis.yml 挂载 `user-auth` + `webserver`（参考 `packages/host/webserver/tests/webserver.spec.ts` 的 `loadComposition` 模式），`user-auth` 行带 `inject: [webStartup]` + config 模拟。
  - 配置一个预置用户；`POST /api/auth/login` 正确凭据 → 200 + `Set-Cookie: __Host-dsh_session=...`（secure 模式）/ `dsh_session=...`（insecure 模式）；错误凭据 → 401。
  - **端点加固**：body > 10KB → 400；畸形 JSON → 400；`GET /api/auth/login` → 405。
  - 未认证 `GET /api/anything` → 302 `/login`（Accept: text/html）或 401 JSON（其他）。
  - 带有效 cookie → 放行。
  - `/plugins/x.js` 未认证 → 放行（决策表）。
  - 登录限流：连续 6 次失败 → 429。
  - **启动顺序**：组合启动后第一个请求即被钩子处理（未认证 → 401/302），证明钩子在 listen 前生效。
  - **fail-closed**：`trustedHosts=['dsh.visitworld.me']` 且无账号 → apply 抛错（web 拒绝启动）；`trustedHosts=[]` 且无账号 → fail-open（可访问 + 告警）。

- [ ] **Step 2: 运行确认失败**

- [ ] **Step 3: 实现 `src/cookie.ts`**
  ```ts
  export interface SessionCookieOptions {
    /** 是否带 Secure 属性（公网 true；本地 HTTP 开发 false）。 */
    secure: boolean
    /** 过期秒数。 */
    maxAgeSeconds: number
  }

  /** 生成 Set-Cookie 头值：secure 时 `__Host-dsh_session=<token>`（RFC 6265bis 要求 __Host- 前缀必须带 Secure），insecure 时 `dsh_session=<token>`（去掉前缀）；其余属性 HttpOnly; SameSite=Strict; Path=/[; Secure]; Max-Age=N */
  export function sessionCookieValue(token: string, opts: SessionCookieOptions): string
  ```

- [ ] **Step 4: 实现 `src/index.ts`**
  ```ts
  import { Context } from '@deepseek-ai/cordis'
  // 依赖: ctx.webServer（dsh-host-webserver）、resolveDshHome、dshHomePath、writeFileAtomic

  export interface UserAuthConfig {
    trustedHosts: string[]
    sessionTtlHours?: number   // 默认 24
    secureCookie?: boolean     // 默认 true
  }

  export function apply(ctx: Context, config: UserAuthConfig): void {
    // 1) 路径: dshHomePath('users.json'), dshHomePath('auth-sessions.json')
    // 2) openUsersStore + SessionStore(ttl) + RateLimiter({limit:5, windowMs:60000})
    // 3) fail-closed: config.trustedHosts.length > 0 且 users.load().length === 0 → throw
    //    （无 trustedHosts → fail-open + logger.warn）
    // 4) 模块扩展：在 src/index.ts（或 src/req-user.d.ts）用 declare module 'node:http' 扩展 IncomingMessage.user
    // 4) ctx.inject(['webServer'], ({ webServer }) => {
    //      webServer.setAuthenticate(async (req) => { ...决策表... })
    //      // 公开: /api/auth/login /api/auth/logout /login /plugins/* /assets/*
    //      // WS (req.headers.upgrade): 有效 cookie → 'allow'；否则由 webserver 拒绝（403）
    //      // Accept: text/html → { status: 302, location: `/login?next=${encodeURIComponent(path)}` }
    //      // 其他 → { status: 401, json: { error: 'unauthorized' } }
    //      // 有效 cookie → req.user = { username, displayName }; return 'allow'
    //      webServer.register({ kind: 'exact', path: '/api/auth/login', handler: loginHandler })
    //      webServer.register({ kind: 'exact', path: '/api/auth/logout', handler: logoutHandler })
    //    })
    // 5) loginHandler: 10KB body 上限；畸形 JSON → 400；GET → 405；校验 → cookie / 401；限流
    // 6) ctx.effect(() => disposer) 清理钩子与会话
  }
  ```

- [ ] **Step 5: 实现并注册 `GET /api/auth/status`（公开路径）**
  - 返回 `{ configured: boolean }`（users.json 是否有有效账号），供登录页判断 fail-open 无账号态。
  - 在 Task 2.5 决策表的公开路径中加入 `/api/auth/status`（与 `/api/auth/login`、`/api/auth/logout` 并列）。

- [ ] **Step 6: 运行确认通过**
  - 测试追加：未认证 `GET /api/auth/status` → 200 `{ configured: true|false }`（公开路径，不要求登录）。

- [ ] **Step 7: 提交**
  ```bash
  git commit -m "feat(user-auth): auth gate plugin with login/logout/status routes, fail-closed startup, endpoint hardening"
  ```

---

## Chunk 3: CLI 账号管理（launcher 级）

### Task 3.1: `dsh user` 子命令（add/set-password/list/remove）

**Files:**
- Modify: `apps/cli/src/args.ts`（新增 `user` mode）
- Modify: `apps/cli/src/bin.ts`（switch 分支）
- Create: `apps/cli/src/user.ts`
- Test: `apps/cli/tests/user.spec.ts`

- [ ] **Step 1: 写失败测试（临时 $DSH_HOME）**
  - `dsh user add alice --display-name Alice`（stdin 喂密码）→ users.json 生成，含 scrypt 哈希。
  - `dsh user list` → 显示 alice / Alice，不显示哈希。
  - `dsh user set-password alice` → 哈希更新。
  - `dsh user remove alice` → 用户消失；移除最后一个账号后再次 add 正常。

- [ ] **Step 2: 运行确认失败**

- [ ] **Step 3: 实现 `args.ts` + `bin.ts` + `user.ts`**
  - `args.ts`：`program.command('user <action> [username]')`，action ∈ {add, set-password, list, remove}，option `--display-name`。
  - `bin.ts`：`case 'user': { const { runUser } = await import('./user.ts'); process.exit(runUser(invocation.args)) }`。
  - `user.ts`：import `resolveDshHome` from `@deepseek-ai/dsh-home-paths`（不要自己解析 `$DSH_HOME`），交互式密码（`readline` + `output.write` 关闭回显——参照 Node docs 的 `mute` 技巧；非 TTY 时提示并退出），调用 `hashPassword` + `openUsersStore().write()`。`apps/cli/package.json` 需声明 `@deepseek-ai/dsh-user-auth` 与 `@deepseek-ai/dsh-home-paths` 为 dependencies。

- [ ] **Step 4: 运行确认通过**

- [ ] **Step 5: 提交**
  ```bash
  git commit -m "feat(cli): dsh user account management commands"
  ```

---

## Chunk 4: `ui-auth` 客户端插件（登录页）

**新包注册（Task 4.1 Step 0 完成）：**

- Modify: `tsconfig.client.json` — `references` 追加 `{ "path": "./packages/client/ui-auth" }`。
- Modify: `packages/bundle/web-app/package.json` — `dependencies` 追加 `"@deepseek-ai/dsh-client-ui-auth": "workspace:^"`。
- Create: `packages/client/ui-auth/README.md`、`README.i18n.yaml`、`README.zh.md`（doc-sync 门禁）。
- Modify: `knip.json` — ui-auth 的 `.tsx` 文件超出 catch-all 项目 glob（仅 `.ts`），按仓库 per-package 显式 glob 模式补条目：`["src/**/*.ts", "src/**/*.tsx", "tests/**/*.tsx"]`。

**关键架构事实（评审确认）：仓库 SPA 没有 URL router / route table / history 导航。** AppFrame 直接挂载进 `root` slot，页面是单页无路由。因此 `/login` 的渲染机制必须显式设计：

- `ui-auth` 浏览器半在启动时读 `window.location.pathname`（并监听 `popstate`）：
  - 路径为 `/login` → 全屏渲染 `LoginPage`，注册进 **`shell.overlay`** slot（list slot，additive，由 AppFrame 的 overlay 层渲染——`packages/client/ui-layout/src/client/AppFrame.tsx:194`）。
  - **绝不能注册进 `root` slot**：`root` 是 single slot、已被 AppFrame 占用（`packages/client/runtime/src/client/slots.ts:41` 注明 "register into `shell.overlay` instead"）；占用它会遮蔽 AppFrame 及其声明的全部 seat（sidebar/conversation/details/shell.overlay），包括 Task 4.2 自己的 `settings.general.item` 登出入口。
  - 否则 → 正常 UI 不受影响（认证门禁在宿主侧，未登录时 SPA 根本不会加载到这一步——未认证的页面请求已被 302 到 `/login`）。
- 登录成功 → `window.location.href = next || '/'`（整页跳转，重新走宿主认证）。
- `/login` 只作为"登录表单的载体"，不是路由系统的一部分。

### Task 4.1: 包脚手架与登录页

**Files:**
- Create: `packages/client/ui-auth/package.json`（参照 `packages/client/ui-skill/package.json`，name `@deepseek-ai/dsh-client-ui-auth`；`exports` 含 `"."`、`"./invariant"`、`"./client"`；`files` 含 `lib/index.js lib/invariant.js lib/client.js lib/types/**/*.d.ts`；`dsh.client` 含 `inject: ["@deepseek-ai/dsh-client-runtime", "@deepseek-ai/dsh-client-ui-slots", "@deepseek-ai/dsh-client-ui-settings", "@deepseek-ai/dsh-client-locale", "@deepseek-ai/dsh-api-remotes"]` 与 `platform: web`；peer/dev 依赖含 `@deepseek-ai/cordis`、`@deepseek-ai/dsh-invariants`、`@deepseek-ai/dsh-client-runtime`、`@deepseek-ai/dsh-client-ui-slots`、`@deepseek-ai/dsh-client-ui-primitives`、`@deepseek-ai/dsh-client-ui-settings`、`@deepseek-ai/dsh-client-locale`、`@deepseek-ai/dsh-client-test-runtime`（dev）、`react`、`react-dom`）
- Create: `packages/client/ui-auth/tsconfig.json`
- Create: `packages/client/ui-auth/src/index.ts`（宿主半：空 `apply()` + `dsh.client` 声明注释）
- Create: `packages/client/ui-auth/src/invariant.ts`
- Create: `packages/client/ui-auth/src/client/index.ts`（浏览器半入口：读 pathname、挂载 LoginPage）
- Create: `packages/client/ui-auth/src/client/LoginPage.tsx`
- Create: `packages/client/ui-auth/src/client/LoginPage.module.css`
- Create: `packages/client/ui-auth/src/client/locales.ts`
- Create: `packages/client/ui-auth/tests/browser-plugin.client.spec.ts`

- [ ] **Step 1: 写失败测试（登录页渲染与表单）**
  参照 `packages/client/ui-skill/tests/browser-plugin.client.spec.ts` 的测试 runtime 模式：
  - 渲染 `LoginPage`：有用户名/密码输入框与提交按钮。
  - 提交错误凭据 → 显示错误消息（mock fetch 返回 401）。
  - 提交成功 → 设置 `window.location.href = next || '/'`（mock location）。
  - **无账号态**：`GET /api/auth/status` 返回 `{ configured: false }` → 显示"未配置账号，运行 `dsh user add`"且表单禁用。
    - 说明：`user-auth` 宿主侧提供 `GET /api/auth/status`（公开路径，Task 2.5 Step 5 实现）返回 `{ configured: boolean }`——这是客户端获知 fail-open 无账号态的机制，已加入决策表公开路径。

- [ ] **Step 2: 运行确认失败**

- [ ] **Step 3: 实现浏览器半**
  - `LoginPage.tsx`：受控表单，`POST /api/auth/login`（fetch，`credentials: 'include'`），成功 → `location.href = next || '/'`，失败 → 显示 `invalid credentials` 本地化文案。
  - `client/index.ts`：浏览器插件 apply 中——若 `location.pathname === '/login'` 或 `location.pathname.startsWith('/login')`，把 `LoginPage` 注册进 `shell.overlay` slot（additive，AppFrame overlay 层渲染，覆盖正常 UI 视觉）；监听 `popstate` 处理前进/后退到 `/login`。
  - `locales.ts`：`en`/`zh` 文案（username/password/submit/invalid credentials/no-account hint）。
  - `index.ts`（宿主半）空 apply，浏览器半导出 LoginPage 与挂载逻辑。

- [ ] **Step 4: 运行确认通过**

- [ ] **Step 5: 提交**
  ```bash
  git commit -m "feat(ui-auth): login page client plugin with pathname-based mount"
  ```

### Task 4.2: 登出入口 + 会话过期跳转

**Files:**
- Modify: `packages/client/ui-auth/src/client/index.ts`
- Create: `packages/client/ui-auth/src/client/LogoutButton.tsx`
- Test: `packages/client/ui-auth/tests/browser-plugin.client.spec.ts`

- [ ] **Step 1: 写失败测试**
  - 登出入口点击 → `POST /api/auth/logout` → `window.location.reload()`。
  - 会话过期（API）：mock fetch 返回 401（非 auth 路径）→ 跳转 `/login?next=<当前路径>`。
  - 会话过期（WS）：mock WS error/close（未收到 open）→ 跳转 `/login?next=<当前路径>` 并显示"登录已过期，请重新登录"提示。
  - **负向**：open 之后发生的 close（网络中断/重启）→ **不**跳转（避免登录后误跳）。

- [ ] **Step 2: 运行确认失败**

- [ ] **Step 3: 实现**
  - `LogoutButton.tsx`：`POST /api/auth/logout`（credentials include）→ `location.reload()`。
  - 注册进 `ui-settings` 的 General 设置区：通过 `packages/client/ui-settings/src/client/contract/slots.ts:88` 的 **`settings.general.item`** slot 注册一行"登出"（该 slot 是 General 页的加法席位，`ui-settings-general` 的 General section 渲染它）。
  - **API 401 拦截（机制固定为 fetch 包装）**：`WebApiClient.doFetch` 在调用时经 `globalThis.fetch`（`packages/client/connection/src/client/web-api-client.ts:14-16`），`ui-auth` 浏览器半包装 `globalThis.fetch`：收到 401/403 且路径非 `/api/auth/login`、非 `/api/auth/logout` → `location.href = '/login?next=' + encodeURIComponent(location.pathname)`。
  - **WS 过期信号与提示（机制固定为 WebSocket 构造器包装）**：`packages/client/connection/src` 没有可订阅的 WS 事件面（`readWebSocket` 只把 close 映射为 stream end `{kind:'end'}`，现有可观测面 `hostDescription.subscribe` 无法区分会话过期 403 与网络/重启断开）。因此 `ui-auth` 浏览器半在 apply 时**包装页面全局 `WebSocket` 构造器**（与 fetch 包装并列），只拦截指向 `/api/events.mux` 与 `/api/events.host` 的连接：监听 error/close（未收到 open 即断开）→ 跳转 `/login?next=<当前路径>` 并提示"登录已过期，请重新登录"（规格第四节要求）。

- [ ] **Step 4: 运行确认通过**

- [ ] **Step 5: 提交**
  ```bash
  git commit -m "feat(ui-auth): logout entry via settings.general.item and session-expiry redirect"
  ```

### Task 4.3: 接入 web-app 组合（roster + startup flags）

**Files:**
- Modify: `packages/bundle/web-app/cordis.patch.yml`
- Modify: `packages/bundle/web-app/src/startup.ts`
- Modify: `packages/bundle/web-app/package.json`（dependencies 已在 Chunk 2/4 注册前置中完成）

- [ ] **Step 1: 在 `packages/bundle/web-app/cordis.patch.yml` 的 `- insert:` 块内追加两行：**
  ```yaml
  # UI roster 区（参照 ui-skill 行约 line 248）：
  - id: ui-auth
    name: '@deepseek-ai/dsh-client-ui-auth'

  # 宿主插件区（同一个 insert 块内；本仓库无独立"宿主区"，ui-settings 是 roster 行）：
  - id: user-auth
    name: '@deepseek-ai/dsh-user-auth'
    inject: [webStartup]
    config:
      trustedHosts: !!js 'ctx.webStartup.trustedHosts'
      sessionTtlHours: !!js 'ctx.webStartup.sessionTtlHours'
      secureCookie: !!js 'ctx.webStartup.secureCookie'
  ```
  **说明:** Cordis Loader 并发激活行，`user-auth` 行位置不保证顺序；钩子安装时机由 Task 2.5 的 `ctx.inject(['webServer'])` 机制保证（先于 listen 生效）。

- [ ] **Step 2: 在 `packages/bundle/web-app/src/startup.ts` 的 `webCommand()` 增加 flag：**
  ```ts
  .option('--session-ttl-hours <hours>', 'auth session TTL in hours', '24')
  .option('--insecure-cookie', 'allow non-Secure auth cookie (local HTTP dev only)')
  ```
  并在 `apply()` 的 `ctx.provide(WEB_STARTUP_SERVICE, {...})` 中增加 `sessionTtlHours`（number）与 `secureCookie`（boolean，默认 true，`--insecure-cookie` 时 false）。

- [ ] **Step 3: 运行 `pnpm run build` 确认组合通过**
  Expected: 构建成功，`ui-auth` 与 `user-auth` 进入 client roster；`tsc -b` 无缺失引用错误。

- [ ] **Step 4: 提交**
  ```bash
  git commit -m "feat(web-app): register user-auth/ui-auth, add session-ttl and insecure-cookie flags"
  ```

### Task 4.3b: 服务器启动参数与 fail-closed 联动（文档步骤，无代码）

- [ ] 部署启动命令（Task 5.2 使用）保持：
  ```bash
  dsh web --no-open --host 127.0.0.1 --port 3080 --trusted-host dsh.visitworld.me --session-ttl-hours 24
  ```
  `--trusted-host` 存在 → `trustedHosts` 非空 → fail-closed 生效（无账号拒绝启动）；`--insecure-cookie` 不传 → cookie 带 Secure（公网 HTTPS 正确）。

---

## Chunk 5: 全量验证与部署准备

### Task 5.1: 本地全量验证

- [ ] **Step 1:** `pnpm run typecheck` 通过
- [ ] **Step 2:** `pnpm run build` 通过
- [ ] **Step 3:** `pnpm exec vitest run packages/host/user-auth packages/client/ui-auth packages/host/webserver packages/client/connection` 通过
- [ ] **Step 4:** 本地起 `dsh web --insecure-cookie`（loopback，无 `--trusted-host`，无账号 → fail-open + 告警）：`dsh user add demo` 后登录页可登录（`--insecure-cookie` 使本地 HTTP 下 cookie 不带 Secure）。
- [ ] **Step 5:** 带 `--trusted-host localhost` 且删光账号 → web 拒绝启动（fail-closed）。
- [ ] **Step 6:** 带 `--trusted-host localhost` 且有账号 → 未认证请求 302 `/login`；登录后可用。
- [ ] **Step 7:** 提交（如有遗留改动）

### Task 5.2: 服务器部署（dsh.visitworld.me）

> ⚠️ 本任务需要 SSH 到 root@visitworld.me（`~/.ssh/default.pem`），修改线上服务。执行前与用户确认维护窗口。

- [ ] **Step 1:** 备份：服务器上备份 `$DSH_HOME` 与当前 dsh 可执行/构建产物；备份 `/etc/nginx/sites-enabled/dsh.visitworld.me`。
- [ ] **Step 2:** 部署新构建产物（`pnpm run build` 产物 + 相关 packages），保持启动参数 `dsh web --no-open --host 127.0.0.1 --port 3080 --trusted-host dsh.visitworld.me`。
- [ ] **Step 3:** 用 `dsh user add` 创建初始账号。
- [ ] **Step 4:** 启动新 dsh，验证 `curl -I http://127.0.0.1:3080/` → 302 `/login`。
- [ ] **Step 5:** nginx：移除 `auth_basic` / `auth_basic_user_file`，`nginx -t && systemctl reload nginx`。
- [ ] **Step 6:** 公网验证：
  - `curl -I https://dsh.visitworld.me/` → 302 `/login`（不再是 401 basic auth）。
  - 浏览器登录成功；登出后访问被拒。
  - WS：未登录被拒（403）、登录后正常。
- [ ] **Step 7:** 失败回滚：恢复备份的 dsh 产物与 nginx 配置。

---

## 提交信息风格

- `feat(webserver): ...`、`feat(user-auth): ...`、`feat(cli): ...`、`feat(ui-auth): ...`、`feat(web-app): ...`
- 每个 Task 一个 commit，测试先行。
