# Agent Note: Authentication status code redirects

Status: implemented

English | [中文](2026-08-25-auth-status-code-redirects.zh.md)

## Problem

The browser authentication plugin treated every 401 or 403 response from a non-public API as an expired session. Public deployments legitimately return 403 for privileged APIs such as `credentials.describe` because those operations are restricted to loopback requests, even when the browser session is valid. Redirecting those responses to `/login` caused an authenticated page to reload indefinitely during plugin boot.

## Decision

The browser authentication plugin treats only 401 responses from non-public API endpoints as session expiry. It leaves 403 responses to the API caller because 403 represents a permission or browser-trust decision rather than proof that the session cookie is invalid. Event-stream sockets that close before opening remain an independent session-expiry signal.

## Alternatives considered

**Keep redirecting on both statuses:** Rejected because the client cannot distinguish an expired session from the connection layer's intentional loopback-only 403 without discarding the connection policy's status semantics.

**Allow privileged APIs for the public host:** Rejected because it weakens the browser-trust protection for credential reads and writes; the UI must handle unavailable privileged operations without invalidating the whole session.

## Consequences

An expired API session still redirects immediately on 401. A valid session that lacks access to a privileged API remains on the application page, and the owning UI can display or handle the refusal. Browser-plugin tests cover both outcomes.
