# Agent Note: Authentication status code redirects

Status: implemented

[English](2026-08-25-auth-status-code-redirects.md) | 中文

## Problem

浏览器认证插件曾把非公开 API 的所有 401 和 403 都视为登录过期。公网部署对 `credentials.describe` 等特权 API 合法地返回 403，因为这些操作只允许回环请求，即使浏览器会话仍然有效。插件启动期间把这类响应重定向到 `/login`，导致已登录页面无限刷新。

## Decision

浏览器认证插件只把非公开 API 的 401 视为登录过期，并将 403 留给 API 调用方处理。403 表示权限或浏览器信任策略拒绝，不能证明会话 cookie 无效。事件流 socket 在建立连接前关闭仍然独立作为登录过期信号。

## Alternatives considered

**继续对两种状态码都重定向：** 放弃，因为客户端无法在不破坏连接层状态码语义的情况下区分会话过期和连接层有意返回的仅限回环 403。

**允许公网主机访问特权 API：** 放弃，因为这会削弱凭据读写的浏览器信任保护；UI 应在特权操作不可用时处理拒绝，而不是使整个会话失效。

## Consequences

过期的 API 会话仍会在收到 401 时立即跳转。有效会话访问受限特权 API 时留在应用页面，由所属 UI 展示或处理拒绝。浏览器插件测试覆盖这两种结果。
