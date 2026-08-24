# @deepseek-ai/dsh-user-auth

[English](README.md) | 中文

Host 侧用户认证插件，占据 webserver 的单一认证席位。`hashPassword(password)` 返回自描述的 `$scrypt$` 哈希串——16 字节随机盐与 64 字节 scrypt 密钥（N=16384、r=8、p=1）——`verifyPassword(password, stored)` 重新派生密钥并以恒定时间比较，格式错误的存量哈希串按 `false` 处理而不会抛错。账号与会话状态分别落在用户存储（`users.json`，fail-closed 结构校验、原子 0600 写入且父目录 0700、拒绝符号链接）与会话存储（`auth-sessions.json`，带 TTL 过期的 cookie 会话、跨进程写锁、原子 0600 写入）中；登录限流器在门禁应答前按来源节流失败尝试。

插件入口 `apply(ctx, config)` 接线整个门禁：fail-closed 启动检查（声明了 `trustedHosts`——即对外提供 loopback 之外的服务——的部署必须在 `users.json` 中至少有一个账号，否则插件拒绝启动；没有 `trustedHosts` 时门禁以 fail-open 运行并告警）、请求决策表（公开的认证路径与 plugin／asset 前缀放行、有效的会话 cookie 放行、其余 HTML 导航 302 到 `/login?next=<url>`、否则返回 401 JSON），以及 `/api/auth/login`、`/api/auth/logout` 与 `/api/auth/status` 三条路由。提交的用户名不存在时，登录会用一个固定的 dummy 哈希做校验，使未知用户名的尝试与既有账号的错误密码消耗相同的 scrypt 工作量——不会通过响应时间枚举用户。该包从不打印内容，除了 webserver 钩子之外不接触任何 harness 概念。

## 模型体验

无。该包只负责密码哈希、会话持久化与 webserver 认证席位；其中没有任何内容会进入模型请求。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

## 已知限制与暂缓事项

- **scrypt 参数固定不变**：N=16384／r=8／p=1 与 16 字节盐是 v1 常量；可配置的成本旋钮要等出现需要它的部署。
- **按设计为单租户**：用户存储、会话存储与门禁只面向单个部署的账号；不同用户群体之间没有多租户隔离，需要租户级隔离的部署必须分别运行各自的 host。
