# `@deepseek-ai/dsh-host-frontend-static`

English | [中文](README.zh.md)

SPA dist server for the Web shell: a function plugin (config `{distIndex, spaFallback}`) that claims the [webserver](../webserver/README.md)'s single fallback seat and serves the built frontend directory with explicit index entry points. While `distIndex` is readable, the dist root, the configured index path, and every exact `spaFallback` pathname with no backing file render `index.html` with HTTP 200; other existing files are served directly. An absent or non-file target inside the dist root — including a missing configured index or an unlisted pathname — returns an empty 404; traversal outside the dist root returns 403, unknown extensions ship as `application/octet-stream`, and non-GET/HEAD without a matching named route returns 405. Every successful index response is rendered through the webserver's `renderIndex` — structured injection rows first, then the raw index taps — which is how the boot manifest reaches the page. `distIndex` is an assembly fact of the composing application: [`dsh-web-app`](../../bundle/web-app/README.md) resolves it through the frontend package's exports and mounts this plugin; a deployment never hardcodes it.

The fallback seat is single-owner (a second claim throws) and effect-scoped: disposing the plugin's fiber releases the seat, after which the unclaimed webserver answers 404.

## Model Experience

None, as the package serves browser assets; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **The starter MIME table is minimal** — it covers the Vite-emitted asset set plus the shipped PWA manifest; other extensions fall back to `application/octet-stream` until an asset class actually ships.
- **SPA pathname routes are explicit** — the client's login surface enters through `/login`, served by the `spaFallback` entry the web composition configures; any future History-API route needs the same explicit server rule and real-composition coverage rather than a broad fallback for every miss.
