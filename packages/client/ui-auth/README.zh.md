# @deepseek-ai/dsh-client-ui-auth

[English](README.md) | 中文

Web 登录界面（浏览器端）：渲染宿主 `user-auth` 门禁的账号登录表单。仓库 SPA 没有 URL router 或路由表，因此该界面按 pathname 挂载而非按路由挂载：浏览器插件在 apply 时读取 `window.location.pathname`（并跟随 `popstate`），当地址栏指向 `/login` 时把 `LoginPage` 注册进可叠加的 `shell.overlay` slot——`ui-layout` 的 AppFrame 把它渲染成覆盖所有列的整窗浮动层。宿主门禁把未认证的 HTML 导航 302 到 `/login?next=<url>`，因此本 overlay 贡献就是该页面加载的表单。注册进 `root` 会遮蔽 AppFrame 及其声明的全部 seat，这正是 overlay slot 成为刻意归属的原因。

表单读取 `GET /api/auth/status` 得到 `{ configured }`；没有账号的部署显示设置提示并禁用表单。提交时以 cookie（`credentials: 'include'`）向 `/api/auth/login` `POST` `{ username, password }`；成功后整页跳转到 `next` 查询目标（或 `/`），让宿主门禁重新认证该请求。被拒绝的登录显示本地化的凭据无效文案，服务器不可达显示连接错误，`next` 不是同源路径时回退到根路径。

登出与会话过期是相反流程。General 设置区的行条目（`LogoutButton`）向 `/api/auth/logout` 发起 POST 并整页刷新，宿主门禁重新认证该刷新请求；会话已消失时，302 重定向回 `/login`。宿主随时可能吊销会话（空闲／单会话策略，或重启使所有 cookie 失效），因此插件还守护应用与宿主通信的两条传输通道：任何非公开 API 端点返回 401／403，或事件流 socket 在首次 open 之前关闭，都会让整页带着会话过期提示跳回 `/login?next=<当前路径>`。

## 登录界面

`LoginPage` overlay 条目拥有用户名与密码输入框、提交按钮、错误行和无账号提示。`login` locale 命名空间承载文案（en/zh 成对，位于 `src/client/locales.ts`）。

## 模型体验

无。该插件只渲染浏览器端登录界面；其中没有任何内容会进入模型请求。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

## 已知限制与暂缓事项

- **不是路由系统**：`/login` 只是登录表单的载体而非路由；SPA 没有 router，overlay 只按 pathname 挂载。
- **fail-open 部署永远看不到它**：当门禁在未配置 trusted hosts 的情况下运行（loopback 开发）时，未认证请求被放行、SPA 直接加载，登录页不会渲染。
