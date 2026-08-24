# @deepseek-ai/dsh-client-ui-auth

English | [中文](README.zh.md)

The web login surface, browser half: renders the account sign-in form of the host `user-auth` gate. The repository SPA has no URL router or route table, so the surface is mounted by pathname rather than by a route: the browser plugin reads `window.location.pathname` at apply time (and follows `popstate`), and while the address bar names `/login` it registers `LoginPage` into the additive `shell.overlay` slot, which `ui-layout`'s AppFrame renders as a frame-wide floating layer above every column. The host gate redirects unauthenticated HTML navigation to `/login?next=<url>`, so this overlay contribution is the form that page loads. Registering into `root` would shadow AppFrame and every seat it declares, which is why the overlay slot is the deliberate home.

The form reads `GET /api/auth/status` for `{ configured }`; a deployment without accounts shows a setup hint and disables the form. Submission `POST`s `{ username, password }` to `/api/auth/login` with cookies (`credentials: 'include'`); success navigates the whole page to the `next` query target (or `/`) so the host gate re-authenticates the request. A rejected login shows a localized invalid-credentials message, an unreachable server a connection error, and a `next` that is not a same-origin path falls back to the root.

## Login surface

The `LoginPage` overlay entry owns the username and password fields, the submit button, the error line, and the no-account hint. The `login` locale namespace carries the copy (en/zh pairs in `src/client/locales.ts`).

## Known Limitations and Deferred Work

- **Not a routing system** — `/login` is the login form's carrier, not a route; the SPA keeps no router, and the overlay mounts by pathname alone.
- **Fail-open deployments never see it** — when the gate runs without trusted hosts (loopback development), unauthenticated requests are allowed and the SPA loads directly, so the login page never renders.
