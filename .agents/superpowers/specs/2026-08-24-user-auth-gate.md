# User Auth Gate Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 DeepSeek Harness 增加应用内登录门禁（预置账号 + 密码 + session cookie），替换公网部署 dsh.visitworld.me 上现有的 nginx basic auth。

**Architecture:** 新增宿主插件 `packages/user-auth/`（账号存储、会话签发、认证钩子）与客户端插件 `packages/client/ui-auth/`（登录页 UI）。对 `packages/host/webserver` 做最小侵入改动：新增可选单席位 `authenticate` 钩子字段与两个调用点（HTTP 分派前、WS upgrade 分派前）。`user-auth` 通过 CLI launcher 子命令（`dsh user ...`）管理账号。公网部署保留 `--trusted-host dsh.visitworld.me`，nginx 去掉 basic auth。

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
  Run: `pnpm --filter @deepseek-ai/dsh-host-webserver test -- webserver`
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
  Run: `pnpm --filter @deepseek-ai/dsh-host-webserver test -- webserver`
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

### Task 2.1: 包脚手架与 scrypt 密码哈希

**Files:**
- Create: `packages/user-auth/package.json`
- Create: `packages/user-auth/tsconfig.json`
- Create: `packages/user-auth/src/index.ts`
- Create: `packages/user-auth/src/hash.ts`
- Create: `packages/user-auth/src/users-store.ts`
- Create: `packages/user-auth/tests/hash.spec.ts`

- [ ] **Step 1: 写失败测试（hash.ts）**
  `packages/user-auth/tests/hash.spec.ts`：

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
  Run: `pnpm --filter @deepseek-ai/dsh-user-auth test`
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
  Run: `pnpm --filter @deepseek-ai/dsh-user-auth test`
  Expected: PASS

- [ ] **Step 5: 提交**
  ```bash
  git add packages/user-auth
  git commit -m "feat(user-auth): scrypt password hashing"
  ```

### Task 2.2: `users-store.ts`（读取/校验/原子写/再读）

**Files:**
- Create: `packages/user-auth/src/users-store.ts`
- Create: `packages/user-auth/src/paths.ts`（解析 `$DSH_HOME`，参照 `packages/identity/anonymous-user-id` 的 `resolveDshHome`）
- Test: `packages/user-auth/tests/users-store.spec.ts`

- [ ] **Step 1: 写失败测试**
  - 读取合法 users.json → 返回用户列表。
  - 缺失文件 → 空列表 + `exists=false`。
  - 损坏 JSON → 抛错（由调用方决定 fail-closed）。
  - symlink 路径 → 拒绝（`lstat` 校验非符号链接）。
  - `writeUsers`：临时文件 + 原子 rename + chmod 600。
  - **再读语义**：写后重新 `loadUsers()` 返回新内容（供 CLI 运行中生效）。

- [ ] **Step 2: 运行确认失败**

- [ ] **Step 3: 实现 `users-store.ts`**
  ```ts
  import { lstatSync, mkdirSync, readFileSync, renameSync, writeFileSync, chmodSync } from 'node:fs'
  import { dirname, join } from 'node:path'

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
    /** 原子写入整个文件（临时文件 + rename + chmod 600）。 */
    write(file: UsersFile): void
  }

  export function openUsersStore(usersPath: string): UsersStore {
    // lstat：若路径存在且为符号链接 → throw
    // 读取：缺失 → exists=false；JSON 解析失败/结构非法 → throw
    // write：同目录临时文件写入 → rename 原子替换 → chmod 600
  }
  ```

- [ ] **Step 4: 运行确认通过**

- [ ] **Step 5: 提交**
  ```bash
  git commit -m "feat(user-auth): users store with atomic write and re-read"
  ```

### Task 2.3: 会话管理（签发/校验/过期/持久化）

**Files:**
- Create: `packages/user-auth/src/sessions.ts`
- Test: `packages/user-auth/tests/sessions.spec.ts`

- [ ] **Step 1: 写失败测试**
  - `createSession(username, displayName, ttlMs)` → 返回 token（32 字节 hex）。
  - `validateSession(token)` → 有效返回 `{ username, displayName }`；未知/过期 token → null。
  - 持久化：会话写入文件后重新加载仍有效（重启不丢）。
  - **惰性清理**：校验/签发时顺带删除过期条目。
  - 损坏会话文件 → 视为无会话（不崩溃，返回空）。

- [ ] **Step 2: 运行确认失败**

- [ ] **Step 3: 实现 `sessions.ts`**
  - token 用 `randomBytes(32).toString('hex')`。
  - 记录 `{ token, username, displayName, expiresAt }`，存 `$DSH_HOME/auth-sessions.json`（原子写 + chmod 600，复用 users-store 的原子写模式）。
  - `validateSession`：读文件 → 按 token 查找 → 过期删除并写回 → 返回记录或 null。
  - 文件损坏/缺失 → 返回 null（fail-closed）。

- [ ] **Step 4: 运行确认通过**

- [ ] **Step 5: 提交**
  ```bash
  git commit -m "feat(user-auth): session store with TTL, persistence, lazy cleanup"
  ```

### Task 2.4: 登录限流（XFF 信任链）

**Files:**
- Create: `packages/user-auth/src/rate-limit.ts`
- Test: `packages/user-auth/tests/rate-limit.spec.ts`

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
- Create: `packages/user-auth/src/index.ts`（apply 主体）
- Test: `packages/user-auth/tests/plugin.spec.ts`（组合级）

- [ ] **Step 1: 写失败测试（组合级）**
  - 用 test-only cordis.yml 挂载 `user-auth` + `webserver`（参考 `packages/host/webserver/tests/webserver.spec.ts` 的 `loadComposition` 模式）。
  - 配置一个预置用户；`POST /api/auth/login` 正确凭据 → 200 + `Set-Cookie`；错误凭据 → 401。
  - 未认证 `GET /api/anything` → 302 `/login`（Accept: text/html）或 401 JSON（其他）。
  - 带有效 cookie → 放行。
  - `/plugins/x.js` 未认证 → 放行（决策表）。
  - 登录限流：连续 6 次失败 → 429。

- [ ] **Step 2: 运行确认失败**

- [ ] **Step 3: 实现 `src/index.ts`**
  ```ts
  import { Context } from '@deepseek-ai/cordis'
  // 依赖: ctx.webServer（dsh-host-webserver）、resolveDshHome

  export function apply(ctx: Context): void {
    // 1) 解析 $DSH_HOME/users.json 与 auth-sessions.json 路径
    // 2) openUsersStore + SessionStore + RateLimiter
    // 3) fail-closed 检查: ctx 配置含 trustedHost（注入自 web-app startup）
    //    - 有 trustedHost 且无有效账号 → throw（web profile 拒绝启动）
    // 4) ctx.webServer.setAuthenticate(async (req) => { ...决策表... })
    //    - 公开路径: /api/auth/login、/api/auth/logout、/login、/plugins/*、/assets/*
    //    - Accept: text/html → 302 /login?next=...
    //    - 其他 → 401 JSON
    //    - 有效 cookie → 附加 req.user，返回 'allow'
    // 5) ctx.webServer.register(exact '/api/auth/login')  → 登录
    //    ctx.webServer.register(exact '/api/auth/logout') → 登出
    // 6) ctx.effect(() => disposer) 清理钩子与会话
  }
  ```

- [ ] **Step 4: 运行确认通过**

- [ ] **Step 5: 提交**
  ```bash
  git commit -m "feat(user-auth): auth gate plugin with login/logout routes and fail-closed startup"
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
  - `user.ts`：解析 `$DSH_HOME`（复用 `resolveDshHome`），交互式密码（`readline` + `output.write` 关闭回显——参照 Node docs 的 `mute` 技巧；非 TTY 时提示并退出），调用 `hashPassword` + `openUsersStore().write()`。

- [ ] **Step 4: 运行确认通过**

- [ ] **Step 5: 提交**
  ```bash
  git commit -m "feat(cli): dsh user account management commands"
  ```

---

## Chunk 4: `ui-auth` 客户端插件（登录页）

### Task 4.1: 包脚手架

**Files:**
- Create: `packages/client/ui-auth/package.json`（参照 `packages/client/ui-skill/package.json`，name `@deepseek-ai/dsh-client-ui-auth`，exports 含 `./client`，`dsh.client.platform: web`）
- Create: `packages/client/ui-auth/tsconfig.json`
- Create: `packages/client/ui-auth/src/index.ts`（宿主半：空 `apply()` + `dsh.client` 声明注释）
- Create: `packages/client/ui-auth/src/invariant.ts`
- Create: `packages/client/ui-auth/src/client/index.ts`（浏览器半入口）
- Create: `packages/client/ui-auth/src/client/LoginPage.tsx`
- Create: `packages/client/ui-auth/src/client/LoginPage.module.css`
- Create: `packages/client/ui-auth/src/client/locales.ts`
- Create: `packages/client/ui-auth/tests/browser-plugin.client.spec.ts`

- [ ] **Step 1: 写失败测试（登录页渲染与表单）**
  参照 `packages/client/ui-skill/tests/browser-plugin.client.spec.ts` 的测试 runtime 模式：
  - 渲染 `LoginPage`：有用户名/密码输入框与提交按钮。
  - 提交错误凭据 → 显示错误消息（mock fetch 返回 401）。
  - 提交成功 → 调用 `window.location` 跳转 `?next=` 指定的路径。

- [ ] **Step 2: 运行确认失败**

- [ ] **Step 3: 实现浏览器半**
  - `LoginPage.tsx`：受控表单，`POST /api/auth/login`，成功 → `location.href = next || '/'`，失败 → 显示 `invalid credentials` 本地化文案。
  - 路由：通过现有 UI 插件的路由表注册 `/login`（参照 `ui-conversation`/`ui-settings` 的路由注册方式；若仓库路由由 `ui-layout` 或 renderer 持有，则挂到对应 slot）。
  - `index.ts`（宿主半）空 apply，浏览器半导出 LoginPage 与路由注册。

- [ ] **Step 4: 运行确认通过**

- [ ] **Step 5: 提交**
  ```bash
  git commit -m "feat(ui-auth): login page client plugin"
  ```

### Task 4.2: 登出入口 + 会话过期跳转

**Files:**
- Modify: `packages/client/ui-auth/src/client/index.ts`
- Modify: `packages/client/ui-auth/src/client/LoginPage.tsx`（或新增 `LogoutButton.tsx`）
- Test: `packages/client/ui-auth/tests/browser-plugin.client.spec.ts`

- [ ] **Step 1: 写失败测试**
  - 登出入口点击 → `POST /api/auth/logout` → 刷新。
  - 会话过期：fetch 收到 401 / WS 断开 → 跳转 `/login?next=<当前路径>`（在 `ui-auth` 浏览器半注册一个全局 401 拦截或 hook，参照现有 connection 的错误处理）。

- [ ] **Step 2: 运行确认失败**

- [ ] **Step 3: 实现**
  - 登出入口组件，注册进 `ui-settings` 的设置页（通过 UI slot 机制）。
  - 401 全局跳转逻辑。

- [ ] **Step 4: 运行确认通过**

- [ ] **Step 5: 提交**
  ```bash
  git commit -m "feat(ui-auth): logout entry and session-expiry redirect"
  ```

### Task 4.3: 接入 web-app 组合（roster）

**Files:**
- Modify: `packages/bundle/web-app/cordis.patch.yml`（UI roster 区追加 `ui-auth` 行 + 宿主插件行）

- [ ] **Step 1: 在 `packages/bundle/web-app/cordis.patch.yml` 的 UI roster 区（参照 `ui-skill` 行，约 line 248）追加：**
  ```yaml
  - id: ui-auth
    name: '@deepseek-ai/dsh-client-ui-auth'
  ```
  并在宿主插件区（参照 `ui-settings` 所在块）追加 `user-auth` 行：
  ```yaml
  - id: user-auth
    name: '@deepseek-ai/dsh-user-auth'
  ```

- [ ] **Step 2: 运行 `pnpm run build` 确认组合通过**
  Expected: 构建成功，`ui-auth` 与 `user-auth` 进入 client roster。

- [ ] **Step 3: 提交**
  ```bash
  git commit -m "feat(web-app): register user-auth and ui-auth in web profile"
  ```

---

## Chunk 5: 全量验证与部署准备

### Task 5.1: 本地全量验证

- [ ] **Step 1:** `pnpm run typecheck` 通过
- [ ] **Step 2:** `pnpm run build` 通过
- [ ] **Step 3:** `pnpm run test`（或受影响包的 vitest）通过
- [ ] **Step 4:** 本地起 `dsh web`（loopback，无 `--trusted-host`，无账号 → fail-open + 告警）：`dsh user add demo` 后登录页可登录。
- [ ] **Step 5:** 带 `--trusted-host localhost` 且删光账号 → web 拒绝启动（fail-closed）。
- [ ] **Step 6:** 提交（如有遗留改动）

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
