/**
 * Standalone login page for the auth gate.
 *
 * The DSH web shell is a single-page app whose startup performs authenticated
 * API calls and a WebSocket handshake before rendering anything. Behind the
 * gate those calls answer 401, so the SPA can never initialize to show a
 * login surface. This module therefore serves `/login` as an independent
 * static page — no DSH client bundles, no module loader, no WebSocket — that
 * talks only to the gate's public endpoints (`/api/auth/status`,
 * `/api/auth/login`). A successful login sets the session cookie and the page
 * navigates to the real SPA, which then initializes authenticated.
 * @module @deepseek-ai/dsh-user-auth/login-page
 */

/** Encode a redirect target for the `next` hidden input and JS string. */
function escapeJsString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
}

/**
 * Render the standalone login page.
 * @param next - same-origin path to return to after login; validated by the
 * caller to start with a single `/` (never `//` or a scheme).
 * @returns the full HTML document.
 */
export function renderLoginPage(next: string): string {
  const jsNext = escapeJsString(next)
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>登录 · DeepSeek Harness</title>
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
          "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
        background: #14161a;
        color: #e6e8eb;
      }
      .card {
        width: 340px;
        padding: 40px 32px;
        border-radius: 12px;
        background: #1c1f24;
        border: 1px solid #2a2e35;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
      }
      h1 {
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 6px;
        letter-spacing: 0.3px;
      }
      .subtitle {
        font-size: 13px;
        color: #9aa1ab;
        margin-bottom: 24px;
      }
      label {
        display: block;
        font-size: 13px;
        color: #b7bdc6;
        margin-bottom: 6px;
      }
      input {
        width: 100%;
        padding: 9px 12px;
        margin-bottom: 16px;
        font-size: 14px;
        color: #e6e8eb;
        background: #14161a;
        border: 1px solid #33383f;
        border-radius: 6px;
        outline: none;
      }
      input:focus { border-color: #4a90d9; }
      button {
        width: 100%;
        padding: 10px 12px;
        font-size: 14px;
        font-weight: 500;
        color: #fff;
        background: #2f6fd6;
        border: none;
        border-radius: 6px;
        cursor: pointer;
      }
      button:hover { background: #3a7ce6; }
      button:disabled { opacity: 0.6; cursor: default; }
      .error {
        margin-top: 14px;
        font-size: 13px;
        color: #e05d5d;
        min-height: 18px;
      }
      .hint {
        margin-top: 14px;
        font-size: 12px;
        color: #8a919c;
        line-height: 1.6;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>DeepSeek Harness</h1>
      <div class="subtitle">请登录以继续</div>
      <form id="login-form" autocomplete="on">
        <label for="username">用户名</label>
        <input id="username" name="username" type="text" autocomplete="username"
               required autofocus spellcheck="false" />
        <label for="password">密码</label>
        <input id="password" name="password" type="password" autocomplete="current-password"
               required />
        <button id="submit" type="submit">登录</button>
        <div id="error" class="error" role="alert"></div>
        <div id="hint" class="hint"></div>
      </form>
    </div>
    <script>
      (() => {
        const form = document.getElementById('login-form')
        const username = document.getElementById('username')
        const password = document.getElementById('password')
        const submit = document.getElementById('submit')
        const errorEl = document.getElementById('error')
        const hintEl = document.getElementById('hint')
        const next = '${jsNext}' || '/'

        // A same-origin path is required; the server already validated it, but
        // defense-in-depth keeps a hand-crafted page from open-redirecting.
        function safeNext(value) {
          if (typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')) return value
          return '/'
        }

        async function checkStatus() {
          try {
            const res = await fetch('/api/auth/status', { credentials: 'same-origin' })
            if (res.ok) {
              const data = await res.json()
              if (data && data.configured === false) {
                form.style.display = 'none'
                hintEl.textContent = '未配置账号：请在服务器上运行 dsh user add 创建账号。'
              }
            }
          } catch {
            // Status unreachable: leave the form enabled; the login attempt
            // itself will surface any real problem.
          }
        }

        form.addEventListener('submit', async (event) => {
          event.preventDefault()
          if (submit.disabled) return
          submit.disabled = true
          errorEl.textContent = ''
          try {
            const res = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify({ username: username.value, password: password.value }),
            })
            if (res.ok) {
              location.href = safeNext(next)
              return
            }
            if (res.status === 429) {
              errorEl.textContent = '尝试过于频繁，请稍后再试。'
            } else if (res.status === 400) {
              errorEl.textContent = '请求无效，请检查输入。'
            } else {
              errorEl.textContent = '用户名或密码错误。'
            }
          } catch {
            errorEl.textContent = '无法连接服务器，请稍后重试。'
          } finally {
            submit.disabled = false
          }
        })

        void checkStatus()
      })()
    </script>
  </body>
</html>
`
}

/**
 * Validate a `next` query value as a same-origin path: a leading `/` that is
 * not `//` (which would be scheme-relative and an open-redirect vector).
 * @param candidate - raw `next` query value, or null/undefined.
 * @returns the safe path, or `/` when the candidate is absent or unsafe.
 */
export function safeNextPath(candidate: string | null | undefined): string {
  if (typeof candidate === 'string' && candidate.startsWith('/') && !candidate.startsWith('//')) {
    return candidate
  }
  return '/'
}
