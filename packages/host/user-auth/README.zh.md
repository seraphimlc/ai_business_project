# @deepseek-ai/dsh-user-auth

[English](README.md) | 中文

Host 侧用户认证包：scrypt 密码哈希，以及（由 auth flow 后续任务补充的）webserver 单席位认证钩子接线。`hashPassword(password)` 返回自描述的 `$scrypt$` 哈希串——16 字节随机盐与 64 字节 scrypt 密钥（N=16384、r=8、p=1）——`verifyPassword(password, stored)` 重新派生密钥并以恒定时间比较，格式错误的存量哈希串按 `false` 处理而不会抛错。插件入口（`apply`）目前是空壳：auth flow 后续任务会填入 cordis 插件注册，并通过 `setAuthenticate` 占据 webserver 的单一认证席位。该包只通过哈希／校验契约与认证席位认识用户；它从不打印内容，除了 webserver 钩子之外不接触任何 harness 概念。

## 模型体验

无。该包只负责密码哈希与 webserver 认证席位；其中没有任何内容会进入模型请求。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

## 已知限制与暂缓事项

- **尚无用户存储或认证席位**：插件入口与 webserver 认证席位由 auth flow 后续任务补充；当前该包只交付哈希契约。
- **scrypt 参数固定不变**：N=16384／r=8／p=1 与 16 字节盐是 v1 常量；可配置的成本旋钮要等出现需要它的部署。
