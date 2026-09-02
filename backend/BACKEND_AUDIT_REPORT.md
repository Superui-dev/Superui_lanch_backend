# SuperUI Backend — Full Deep Audit Report

- **Target:** `C:\Users\akhil_tmkrc42\Desktop\SuperUI\Superui_lanch_backend\backend`
- **Audit date:** 2026-09-01
- **Mode:** Read-only initial inspection (no code modified)
- **Auditor scope:** Backend only. Frontend touched only to confirm API contracts.

---

## Executive Summary

The SuperUI backend is a Node.js + Express + MongoDB (4 databases) + Supabase + Razorpay + Socket.IO service that powers a digital-goods storefront with a hardened admin panel. The architecture is broadly sound: helmet, CORS allow-list, rate limiting, webhook HMAC verification, idempotency on Razorpay events, separate role-based admin chain (`authenticate → authorizeAdmin → requireMfa → auditLog`), audit log infrastructure, JWT rotation support.

However, the audit uncovered **7 CRITICAL, 9 HIGH, 12 MEDIUM, 8 LOW** issues. The most damaging are:

1. Multiple **hardcoded secrets/fallbacks in source** (TOTP seed, admin password, socket bypass token, JWT fallback secret, Telegram bot).
2. **`.env` with live credentials is committed** (no `.gitignore`), exposing the Supabase **service-role key** (full DB bypass), Razorpay keys, Telegram bot, SMTP app passwords.
3. **Auth fail-open paths** that allow admin takeover with a known public seed.
4. **No payment ownership check** on the client-driven verify endpoint.

| Severity | Count |
| --- | --- |
| CRITICAL | 7 |
| HIGH | 11 |
| MEDIUM | 12 |
| LOW | 8 |

---

## Backend Architecture

- **Runtime:** Node.js >= 18 (`package.json:7`), Express 4.19, Mongoose 8.4, Supabase JS 2.43, Razorpay 2.9, Socket.IO 4.7, Zod 3.23, helmet 7.1, morgan 1.10, winston 3.13, jwks-rsa 3.1.
- **Entry point:** `backend/src/server.js` (loads env, calls `connectDB()`, attaches `initSockets()`, optional `freePort(PORT)` on Windows dev).
- **App:** `backend/src/app.js` mounts `/api/public`, `/api/auth`, `/api/cart`, `/api/orders`, `/api/payments`, `/api/download`, `/api/contact`, `/api/reviews`, `/api/wishlist`, `/api/analytics`, `/api/public/analytics`, and `/api/admin` (full chain).
- **4 MongoDB databases** (`MONGO_DB_1_URI` … `MONGO_DB_4_URI`): Catalog, Users, Promotions, Security.
- **Auth stack:** Supabase Auth (JWKS-verified JWT) + custom `MFA_JWT_SECRET`-signed admin JWT + MongoDB-backed roles + admin-only MFA-via-TOTP.
- **Webhooks:** Razorpay payment captured/paid/failed events; signature-verified HMAC-SHA256.
- **Digital delivery:** Tokenized download links (`DownloadToken`), one-time tokens with TTL (`DOWNLOAD_TOKEN_TTL_MINUTES=15`), Drive URL passthrough.

---

## Complete API Inventory

### Public (no auth)
- `GET /healthz`
- `GET /api/public/{categories,products,products/:slug,products/:productId/reviews,settings,hero-images,booked-slots,instagram-avatar/:username}`
- `GET /api/public/invoice/:token`, `/invoice/:token/download`
- `POST /api/public/{feedback,issues,book-call,inspect-alert,login-attempt}`

### Auth
- `GET /api/auth/session` (auth)
- `PUT /api/auth/profile` (auth + profileSchema)
- `POST /api/auth/mfa/verify` (auth + auditLog + strictLimiter + mfaSchema)
- `POST /api/auth/change-password` (auth + auditLog + strictLimiter + changePasswordSchema)
- `POST /api/auth/admin-login` (strictLimiter + adminLoginSchema)
- `POST /api/auth/login-sync` (optional auth + loginSyncSchema)

### Cart / Orders / Wishlist / Reviews
- `GET/POST/PUT/DELETE /api/cart[/:productId]` (optional auth)
- `GET /api/orders`, `GET /api/orders/:id` (auth)
- `GET /api/wishlist`, `POST /api/wishlist/add/:productId`, `DELETE /api/wishlist/remove/:productId`, `DELETE /api/wishlist/clear`
- `POST /api/reviews` (auth + submitReviewSchema)

### Payments / Downloads / Contact
- `POST /api/payments/webhook` (Razorpay, signature-verified)
- `POST /api/payments/create-order` (optional auth + strictLimiter + checkoutSchema)
- `POST /api/payments/verify` (optional auth + moderateLimiter + verifySchema)
- `GET /api/download/:token` (strictLimiter, token-only)
- `POST /api/contact` (strictLimiter + contactSchema)

### Analytics
- `POST /api/analytics/pageview` (**duplicate mount** — also at `/api/public/analytics/pageview`)
- `POST /api/public/analytics/pageview`

### Admin (`/api/admin/*` — chain `authenticate → authorizeAdmin → requireMfa → auditLog`)
45 endpoints: `/products`, `/categories`, `/customers`, `/orders`, `/payments`, `/bookings`, `/downloads`, `/contacts`, `/email`, `/telegram`, `/analytics`, `/reviews`, `/feedback`, `/issues`, `/settings`, `/security`, `/health`, `/hero-images`.

---

## API Security Audit

Top systemic concerns:

- `/api/payments/verify` does **not** check order ownership against `req.user` (CRITICAL).
- `/api/auth/admin-login` accepts a **default fallback admin password** in source (CRITICAL).
- `/api/admin/email/send` accepts arbitrary recipient + raw HTML (HIGH).
- Many `/api/admin/*` endpoints have **no request-body validation** (mass-assignment).

---

## Route Audit

- **Duplicate mount:** `analytics.routes.js` mounted at both `/api/analytics` and `/api/public/analytics` (`src/app.js:88-89`).
- **No legacy/debug routes** found.
- **No unprotected admin routes** — all 45 admin endpoints pass through the 4-layer chain.
- **Webhook order:** Razorpay webhook registered **before** `express.json` (good — raw body required for HMAC).

---

## Authentication Audit

### Login
- `POST /api/auth/admin-login` checks env-configured credentials first, then Supabase Auth fallback.
- No email-verification enforcement (`email_confirmed_at`) in either branch.
- Falls back to **hardcoded password `SuperUI@2026`** if `ADMIN_PASSWORD` env missing — CRITICAL.

### MFA
- TOTP verification branches: Supabase MFA API → custom RFC 6238 with `req.user.totpSecret || ADMIN_TOTP_SECRET || 'JBSWY3DPEHPK3PXP'` → fail.
- The hardcoded fallback `JBSWY3DPEHPK3PXP` decodes to `Hello!` — public seed. CRITICAL backdoor.
- TOTP window = 2 (±60s), no replay cache, no `jti` on `mfaToken` (24h stateless JWT).
- `mfaEnabled` flipped true on first successful verify regardless of which secret verified — fallback bypass becomes permanent enrollment.

### Sessions / Logout
- No logout endpoint. No server-side session table. No JWT revocation. Admin JWT + `mfaToken` both stateless, 24h TTL.

### Password handling
- `POST /api/auth/change-password` requires `currentPassword` in schema but **never validates it** in controller — anyone with valid session can rotate password.

### Socket auth
- Socket `/admin` accepts:
  - JWT signed with `MFA_JWT_SECRET` (or `'mfa-fallback-secret'` if env missing — HIGH).
  - Tokens matching `demo-admin-token`, `admin-token-*`, `admin-local-*` **without signature verification** — CRITICAL bypass.
  - Supabase JWKS verification, then `supabaseAdmin.auth.getUser()` fallback.

### Brute-force protection
- `strictLimiter` on `/admin-login` (10/15min prod). Sufficient for IP-level.
- **No account-level lockout** — repeated failures don't block the email.
- **No CAPTCHA**.

---

## Authorization Audit

| Endpoint | Who is allowed | Server check | Verdict |
| --- | --- | --- | --- |
| `POST /api/auth/admin-login` | Anyone with admin creds | None | OK |
| `GET /api/auth/session` | Self | `authenticate` loads own record | OK |
| `PUT /api/auth/profile` | Self | Updates `req.user._id` only | OK |
| `POST /api/auth/change-password` | Self | `authenticate` only | **No current-password check (HIGH)** |
| `GET /api/orders/:id` | Owner | `authenticate` only — no `order.userId === req.user._id` | **IDOR (HIGH)** |
| `POST /api/payments/verify` | Owner | No `order.userId === req.user._id` | **CRITICAL** |
| `GET /api/admin/customers` | Admin | `authorizeAdmin` | OK |
| `PUT /api/admin/customers/:id/status` | Admin | No `customer.role !== 'admin'` guard | **HIGH — admin can disable other admins** |
| All `/api/admin/*` | Admin + MFA | 4-layer chain | OK |
| `GET /api/download/:token` | Token holder | Token hash + TTL + maxDownloads + `paymentStatus === 'SUCCESS'` | OK (no IP binding) |
| `POST /api/admin/email/send` | Admin | `authorizeAdmin` only | **No recipient allowlist, raw HTML (HIGH)** |

---

## Database Audit

### Connections
- 4 Mongo connections via `mongoose.createConnection` (`src/config/db.js:22,26,30`). Started at module-load without `await`. DB2/3/4 lack `process.exit(1)` guard.
- `connectDB()` correctly exits if DB1 URI missing.

### Models — findings

- **User:** PII plaintext (`PAN`, `GST`, `DOB`, full `addresses[]`). No `lastPasswordChangeAt`, no lockout counter, no `mfaSecret` field.
- **Order:** `paymentStatus` enum mixes cases. Missing `(userId, createdAt)` index. No `shippingAddress` snapshot.
- **Payment:** `rawResponse: Mixed` may retain buyer PII. `gatewaySignature` is `select: false` — good.
- **Product:** OK.
- **Cart:** No unique `(userId, status='active')` — multiple active carts per user.
- **CartItem:** No unique `(cartId, productId)` — duplicate rows.
- **Review:** No unique `(productId, userId)` — duplicate reviews possible.
- **DownloadToken:** `tokenHash` unique — good. `downloadToken` plaintext column **also exists** alongside hash.
- **DownloadLog:** `ipAddress` plaintext.
- **EmailLog:** `toAddress` retained indefinitely.
- **AdminLog:** `metadata: Mixed` accepts arbitrary payload.
- **Booking:** `callVerificationCode` stored plaintext.
- **Contact / Issue:** IP plaintext; no retention.
- **Invoice:** `pdfBase64` (line 118) stored in MongoDB.
- **Counter:** No TTL.
- **PaymentEvent:** Unique on `eventId` — idempotency OK.

### Indexes
Missing compound indexes: `Order.(userId, createdAt)`, `Cart.(userId, status)`, `CartItem.(cartId, productId)`, `Review.(productId, userId)`, `Notification.(targetUserId, read)`.

---

## Supabase Audit

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `SUPABASE_JWKS_URL`, `SUPABASE_JWT_ISSUER` are present.
- **Service-role key committed to repo** — CRITICAL (full DB bypass via service role).
- JWKS verification present (`src/utils/supabaseJwt.js`) with `algorithms: ['RS256']`, issuer + audience checks.
- `SUPABASE_JWT_ISSUER=uktbrdmkraojcorvzqnj` is the **project ref**, not the URL. Issuer mismatch silently degrades security — HIGH.
- `supabaseAdmin.auth.admin.mfa.listFactors` / `challengeAndVerify` used correctly.

---

## Payment Audit

- `POST /api/payments/webhook` — signature verified with `crypto.timingSafeEqual` (good).
- Webhook idempotency on `payload.id` — good.
- `create-order` calls `razorpayService.createOrder(totalAmount, 'INR', order._id.toString())` and creates `Payment` row — race window if DB commit fails after gateway success.
- **Client-driven `verify` is dangerous:**
  - `verifyPayment` accepts `{orderId, paymentId, signature}` from any caller.
  - **No ownership check** — any caller can verify any order.
  - In **placeholder-key mode**, controller falls back to client HMAC it already verified in step 1 → CRITICAL bypass when misconfigured.
  - Amount validation only in non-placeholder mode.
- `cancelOrder` (admin) sets `paymentStatus: 'CANCELLED'` and audits as `REFUND_ORDER` but **does not call Razorpay refund API**.

---

## Webhook Audit

- **Signature verification:** HMAC-SHA256, constant-time compare. ✅
- **Secret validation:** required env var. ✅
- **Idempotency:** on `eventId`. ✅
- **Replay protection:** idempotency key. ✅
- **Duplicate events:** safely ignored. ✅
- **Unauthorized requests:** rejected with 401. ✅
- **Error handling:** 200 on duplicate (Razorpay retries stop). ✅

---

## Email Audit

- `POST /api/admin/email/send`:
  - Arbitrary `{ toAddress, subject, body, transportType }`.
  - **No recipient validation/allowlist.**
  - **Body wrapped in `<div>` only** — raw HTML preserved.
  - **No rate limit.**
  - **No audit log.**
  - Quota check (`sendProductEmail`) is bypassed for `sendManualEmail`.
- SMTP credentials hardcoded in `.env`.

---

## Digital Product / Download Audit

- Token: `crypto.randomBytes(32).toString('hex')` — 256-bit entropy ✅
- SHA-256 stored as `tokenHash`; raw token never persisted. ✅
- Expiration: `DOWNLOAD_TOKEN_TTL_MINUTES` (default 15). ✅
- Revocation: `revokedAt` enforced. ✅
- Max downloads: 5 — enforced, but **non-atomic increment** allows 6+ under concurrency.
- Payment gate: `order.paymentStatus === 'SUCCESS'`. ✅
- No email/IP binding.
- No path traversal (Drive URL passthrough).

---

## Environment & Secrets Audit

`.env` is **committed** (`backend/.env`):

| Secret | Source | Severity |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY=eyJ...` | `.env` | CRITICAL |
| `SUPABASE_JWT_SECRET=sb_secret_...` | `.env` | CRITICAL |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | `.env` | CRITICAL |
| `RAZORPAY_WEBHOOK_SECRET` | `.env` | HIGH |
| `EMAIL_DELIVERY1_PASS`, `EMAIL_DELIVERY2_PASS`, `EMAIL_ADMIN_PASS` | `.env` | CRITICAL |
| `TELEGRAM_BOT_TOKEN` | `.env` + source fallback | CRITICAL |
| `ADMIN_PASSWORD=Thirupathi@2026` | `.env` + `'SuperUI@2026'` source fallback | CRITICAL |
| `MFA_JWT_SECRET` | `.env` + `'mfa-fallback-secret'` source fallback | HIGH |
| `ADMIN_TOTP_SECRET` (missing) | `'JBSWY3DPEHPK3PXP'` source fallback | CRITICAL |

**.gitignore is missing.**

Hardcoded fallbacks in source:

- `src/controllers/auth.controller.js:138` — TOTP seed `'JBSWY3DPEHPK3PXP'`
- `src/controllers/auth.controller.js:183` — admin password `'SuperUI@2026'`
- `src/sockets/index.js:49,104` — JWT secret `'mfa-fallback-secret'`
- `src/sockets/index.js:58` — string-match bypass `'demo-admin-token'` / `'admin-token-'` / `'admin-local-'`
- `src/services/telegram.service.js:233` — Telegram bot fallback
- `src/config/supabase.js:11`, `src/config/razorpay.js:12-13` — placeholder client credentials

---

## CORS & HTTP Security

- `app.js:53-59`: CORS allow-list via env + localhost regex. ✅ strict in prod.
- `app.js:23-31`: helmet with `crossOriginResourcePolicy: cross-origin`. ✅
- HSTS default 180 days.
- No CSP header.
- `app.set('trust proxy', 1)` — works for one proxy; behind multiple, X-Forwarded-For becomes attacker-controllable.

---

## Rate Limiting & Abuse

| Limiter | Window | Max (prod) | Storage |
| --- | --- | --- | --- |
| `globalLimiter` | 15 min | 300 | in-memory |
| `strictLimiter` | 15 min | 10 | in-memory |
| `moderateLimiter` | 5 min | 30 | in-memory |
| `publicLimiter` | 1 min | 60 | in-memory |

**All limiters use `MemoryStore`** — bypassed under multi-process. HIGH.

Bypass risks:
- No CAPTCHA on `/api/auth/admin-login`.
- `/api/payments/verify` limited to 30/5min — too lenient.
- `/api/admin/email/send` not rate-limited.

---

## Error Handling & Logging

- `errorHandler.js:14` logs full stack in all environments.
- `utils/logger.js` — single console transport, **no formatter-level redaction** for `password`, `token`, `authorization`, `cookie`, `razorpay_signature`, `mfa_token`.
- `utils/responses.js:13` uses `Math.random()` for `errorId` — recommend `crypto.randomUUID()`.
- `auditLog.js:22` — `metadata` Mixed stored verbatim from controllers.

---

## Dependency Audit

- `package.json:19` — `express ^4.19.2` has **CVE-2024-29041**. Upgrade to `^4.20+`.
- `package.json:24` — `mongoose ^8.4.1` prototype-pollution risk. Upgrade to `^8.8+`.
- `package.json:10` — `lint` script references `eslint` not in devDependencies — script fails.

---

## Performance & Reliability

- N+1 likely in `admin.controller.js:179-183` (bulk insert on GET).
- No caching layer (Redis).
- Mongo connection pool `maxPoolSize: 10` (`db.js:16`).
- Webhook + verify race — safe due to eventId dedup.
- freePort() on Windows (`server.js:22-39`) — safe.
- No background queue — emails/Telegram/audit written inline.

---

## Build & Runtime Results

- No tests present. No `test` script.
- `npm run lint` will fail.
- Manual review confirms graceful shutdown handlers present.

---

## Critical Issues

### [CRITICAL] Hardcoded TOTP seed as admin MFA fallback
**Category:** Auth / Security
**File:** `backend/src/controllers/auth.controller.js:138`
```js
const secret = req.user.totpSecret || process.env.ADMIN_TOTP_SECRET || 'JBSWY3DPEHPK3PXP';
```
**Problem:** Public TOTP seed (`JBSWY3DPEHPK3PXP` decodes to `Hello!`) is the universal fallback.
**Impact:** Full admin takeover with one curl + one TOTP code.
**Fix:** Remove the hardcoded literal. Throw if neither `req.user.totpSecret` nor `ADMIN_TOTP_SECRET` is configured.
**Status:** OPEN

### [CRITICAL] Hardcoded admin password in source
**File:** `backend/src/controllers/auth.controller.js:183`
```js
const adminPassword = process.env.ADMIN_PASSWORD || 'SuperUI@2026';
```
**Problem:** If `ADMIN_PASSWORD` is unset, server uses `SuperUI@2026`.
**Impact:** Admin takeover.
**Fix:** Refuse to boot (or hard-fail login) if `ADMIN_PASSWORD` missing.
**Status:** OPEN

### [CRITICAL] Socket auth bypass via string-match prefixes
**File:** `backend/src/sockets/index.js:58`
```js
if (!authUserId && (token === 'demo-admin-token' || token.startsWith('admin-token-') || token.startsWith('admin-local-'))) {
```
**Problem:** Any client with `auth.token=demo-admin-token` gains admin namespace access without signature verification.
**Impact:** Real-time admin channel hijack.
**Fix:** Remove string-match bypass entirely. Always require verified JWT.
**Status:** OPEN

### [CRITICAL] `.env` committed with live credentials
**File:** `backend/.env`
**Problem:** No `.gitignore`. Includes Supabase service-role key, Razorpay keys, SMTP app passwords, Telegram bot token, admin password.
**Impact:** Anyone with repo access gains Supabase full DB access, can send emails from trusted domain, can issue Razorpay payments/refunds, can hijack the Telegram bot.
**Fix:**
1. Rotate every credential immediately.
2. Add `.gitignore` with `.env` excluded.
3. Move secrets to a secret manager.
4. Purge `.env` from git history (`git filter-repo`).
**Status:** OPEN

### [CRITICAL] Email-verified flag not enforced on admin login
**File:** `backend/src/controllers/auth.controller.js:188-241`
**Problem:** Neither branch checks `email_confirmed_at`.
**Impact:** Account-takeover via unverified email.
**Fix:** Require `email_confirmed_at` for any role-granting branch.
**Status:** OPEN

### [CRITICAL] Client-trusted verify path bypass when Razorpay keys are placeholder
**File:** `backend/src/controllers/payment.controller.js:158-179`
```js
const isPlaceholderKey = !process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET.includes('your_razorpay');
if (isPlaceholderKey) {
  isValidSecond = razorpayService.verifySignature(payment.gatewayOrderId, paymentId, signature);
}
```
**Problem:** If `RAZORPAY_KEY_SECRET` is missing/placeholder, controller accepts client HMAC as proof.
**Impact:** Free downloads on any misconfigured deployment.
**Fix:** Refuse to start (or hard-fail verify) if `RAZORPAY_KEY_SECRET` unset.
**Status:** OPEN

### [CRITICAL] No ownership check on `/api/payments/verify`
**File:** `backend/src/controllers/payment.controller.js:131-148`
**Problem:** `req.user` is never compared to `order.userId`/`order.customerEmail`.
**Impact:** Privilege escalation, free downloads, fraud.
**Fix:** Reject verify if `req.user` is present and order is not theirs.
**Status:** OPEN

---

## High Issues

### [HIGH] JWT fallback secret in socket auth
**File:** `backend/src/sockets/index.js:49,104`
**Fix:** Refuse socket handshake if `MFA_JWT_SECRET` unset.

### [HIGH] `change-password` does not validate `currentPassword`
**File:** `backend/src/controllers/auth.controller.js:407-443`
**Fix:** Call `supabaseAdmin.auth.signInWithPassword(...)` before issuing update.

### [HIGH] IDOR on `/api/orders/:id`
**File:** `backend/src/controllers/order.controller.js`
**Fix:** Add ownership check at top of handler.

### [HIGH] `/api/admin/customers/:id/status` can disable other admins
**File:** `backend/src/controllers/admin.controller.js:205-224`
**Fix:** Reject when `customer.role === 'admin'`.

### [HIGH] `/api/admin/email/send` — no allowlist, raw HTML, no audit
**File:** `backend/src/controllers/admin.controller.js:510-518`
**Fix:** Sanitize HTML, log every send, add `rateLimiter`.

### [HIGH] Supabase JWT issuer mismatch
**File:** `backend/.env:19`, `backend/src/utils/supabaseJwt.js:38`
**Fix:** Set `SUPABASE_JWT_ISSUER=https://uktbrdmkraojcorvzqnj.supabase.co/auth/v1`.

### [HIGH] TOTP window too wide + no replay cache + `mfaEnabled` flipped on fallback
**File:** `backend/src/controllers/auth.controller.js:26,138-163`
**Fix:** Window=1, store `lastUsedCounter`, only flip `mfaEnabled` if `req.user.totpSecret` matched.

### [HIGH] `Invoice.pdfBase64` stored in MongoDB
**File:** `backend/src/models/Invoice.js:118`
**Fix:** Move to S3; store only `pdfKey`.

### [HIGH] In-memory rate limit store
**File:** `backend/src/middleware/rateLimiter.js:10-47`
**Fix:** Use `rate-limit-redis`.

### [HIGH] No `.gitignore` in backend
**File:** `backend/`
**Fix:** Add `.gitignore` excluding `.env`, `node_modules/`, `coverage/`, `*.log`.

### [HIGH] `metadata: Mixed` in `AdminLog` allows accidental secret capture
**File:** `backend/src/models/AdminLog.js:17`, `backend/src/middleware/auditLog.js:22`
**Fix:** Replace `Mixed` with structured schema; redact common secret keys.

### [HIGH] Hardcoded Telegram bot fallback
**File:** `backend/src/services/telegram.service.js:233`
**Fix:** Remove fallback. Throw if env missing.

---

## Medium Issues

### [MEDIUM] PII plaintext in `User` model
**File:** `backend/src/models/User.js:31-41`
**Fix:** Field-level encryption for `PAN`, `GST`, `DOB`.

### [MEDIUM] `Payment.rawResponse` may contain buyer PII
**File:** `backend/src/models/Payment.js:57`
**Fix:** Strip known PII keys before persist.

### [MEDIUM] `DownloadToken.downloadToken` plaintext column
**File:** `backend/src/models/DownloadToken.js:31`
**Fix:** Drop the column.

### [MEDIUM] `DownloadLog.ipAddress` plaintext
**File:** `backend/src/models/DownloadLog.js:30`
**Fix:** Store `ipHash`.

### [MEDIUM] `EmailLog.toAddress` — no retention/TTL
**File:** `backend/src/models/EmailLog.js:29`
**Fix:** Add `expiresAt` index; honor right-to-erasure.

### [MEDIUM] `Booking.callVerificationCode` plaintext
**File:** `backend/src/models/Booking.js:18`
**Fix:** Hash and compare.

### [MEDIUM] Missing unique `(productId, userId)` on `Review`
**File:** `backend/src/models/Review.js`
**Fix:** Add compound unique index.

### [MEDIUM] Missing unique `(userId, status='active')` on `Cart`
**File:** `backend/src/models/Cart.js`
**Fix:** Add partial unique index.

### [MEDIUM] Missing unique `(cartId, productId)` on `CartItem`
**File:** `backend/src/models/CartItem.js`
**Fix:** Add compound unique; increment quantity on duplicate add.

### [MEDIUM] `Contact`/`Issue` store IP plaintext; no retention
**File:** `backend/src/models/Contact.js:22`, `backend/src/models/Issue.js`
**Fix:** Hash IP; add retention.

### [MEDIUM] `Order.paymentStatus` mixes cases
**File:** `backend/src/models/Order.js:58-65`
**Fix:** Standardize enum to uppercase only.

### [MEDIUM] `User` model missing `mfaSecret` field
**File:** `backend/src/models/User.js:57`
**Fix:** Add `mfaSecret: { type: String, select: false }` and store per-user encrypted secret.

### [MEDIUM] Race condition in download counter increment
**File:** `backend/src/services/download.service.js:105-107`
**Fix:** Use atomic `findOneAndUpdate` with `$lt: maxDownloads` filter.

### [MEDIUM] TOCTOU on SMTP quota check
**File:** `backend/src/services/email.service.js:86-101`
**Fix:** Move quota to atomic counter.

### [MEDIUM] Express CVE-2024-29041 (open-redirect / path-confusion)
**File:** `backend/package.json:19`
**Fix:** Upgrade to `^4.20+`.

### [MEDIUM] Mongoose ^8.4.1 prototype-pollution risk
**File:** `backend/package.json:24`
**Fix:** Upgrade to `^8.8+`.

### [MEDIUM] `trust proxy = 1` may be wrong behind multiple proxies
**File:** `backend/src/app.js:36`
**Fix:** Set `app.set('trust proxy', process.env.TRUST_PROXY_COUNT || 'loopback')`.

### [MEDIUM] Stack traces logged in production
**File:** `backend/src/middleware/errorHandler.js:14`
**Fix:** Strip stack from logs in production.

### [MEDIUM] Logger has no formatter-level redaction
**File:** `backend/src/utils/logger.js`
**Fix:** Add winston formatter that replaces secret keys with `[REDACTED]`.

### [MEDIUM] `loginSync` returns internal error messages
**File:** `backend/src/controllers/auth.controller.js:399-403`
**Fix:** Generic message in response; full error only in logs.

### [MEDIUM] No `lastPasswordChangeAt` / lockout counter on `User`
**File:** `backend/src/models/User.js`
**Fix:** Add `failedLoginCount`, `lockoutUntil`.

### [MEDIUM] `auditLog.metadata` Mixed — no allow-list
**File:** `backend/src/middleware/auditLog.js:22`
**Fix:** Replace `Mixed` with structured schema; strip sensitive keys.

### [MEDIUM] `errorId` uses `Math.random()`
**File:** `backend/src/utils/responses.js:13`
**Fix:** Use `crypto.randomUUID()`.

### [MEDIUM] Placeholder clients construct silently when env missing
**File:** `backend/src/config/supabase.js:11`, `backend/src/config/razorpay.js:12-13`
**Fix:** Throw at boot if required env missing.

---

## Low Issues

### [LOW] `lint` script references missing `eslint`
**File:** `backend/package.json:10`
**Fix:** Add `eslint` or remove the script.

### [LOW] `Booking.date` stored as String
**File:** `backend/src/models/Booking.js:8`
**Fix:** Change to Date with index.

### [LOW] `HeroImage` has no `createdBy` audit field
**File:** `backend/src/models/HeroImage.js`
**Fix:** Add `createdBy: ObjectId ref User`.

### [LOW] `Category` has no `parentId` / `description`
**File:** `backend/src/models/Category.js`
**Fix:** Add for sub-category hierarchy.

### [LOW] `Notification` missing compound `(targetUserId, read)` index
**File:** `backend/src/models/Notification.js`
**Fix:** Add for unread badge queries.

### [LOW] `test_picuki.js` at repo root — dev scrape script
**File:** `backend/test_picuki.js`
**Fix:** Move to `tools/` or delete; add to `.gitignore`.

### [LOW] `seedStore.js`/`seedIssues.js`/`seedFeedback.js` log full MongoDB URI
**File:** `backend/src/utils/seedStore.js:9` etc.
**Fix:** Print only the host, not the URI with password.

### [LOW] No `sitemap.xml`/`robots.txt` exposure concerns — out of scope.

---

## Recommended Fix Order

1. **Immediate (today):**
   - Rotate every secret in `.env` (Supabase, Razorpay, SMTP, Telegram, admin password, JWT secret).
   - Add `.gitignore`, remove `.env` from git history.
   - Remove `'JBSWY3DPEHPK3PXP'`, `'SuperUI@2026'`, `'mfa-fallback-secret'`, `'demo-admin-token'`/`'admin-token-'`/`'admin-local-'` bypass, hardcoded Telegram bot fallback — replace with boot-time validation.
   - Set `SUPABASE_JWT_ISSUER` to the full URL.
   - Add email-verified enforcement.
   - Add ownership check on `/api/payments/verify` and `/api/orders/:id`.
   - Remove placeholder-key fallback in payment verify.

2. **Within a week:**
   - Add per-user `mfaSecret` field, migrate TOTP off fallback.
   - Tighten TOTP window to 1, store `lastUsedCounter`.
   - Validate `currentPassword` on `change-password`.
   - Move `pdfBase64` out of MongoDB into S3.
   - Add Redis-backed rate limiter.
   - Add `lastPasswordChangeAt` + session invalidation.
   - Sanitize/audit `email/send`.
   - Block admins from disabling other admins.

3. **Within a sprint:**
   - Add request-body validation on all admin POST/PUT endpoints.
   - Add field-level encryption for PII (`PAN`, `GST`, `DOB`).
   - Switch `rawResponse` and audit `metadata` to structured schemas with redaction.
   - Upgrade `express` to `^4.20`, `mongoose` to `^8.8`.
   - Move logs to a secure sink with redaction formatter.
   - Add CAPTCHA on admin login.
   - Add tests and a real `lint`/`test` script.

4. **Continuous:**
   - Rotate JWT secrets periodically.
   - Audit `AdminLog` for accidental secret writes.
   - Penetration-test before each release.

---

## Final Backend Security Verdict

**The backend is functional but NOT production-ready.** A motivated attacker with public access to the repository can:

- Log in as admin using the hardcoded fallback password (`SuperUI@2026`) or bypass MFA using the public TOTP seed (`JBSWY3DPEHPK3PXP`).
- Forge any admin JWT using the fallback socket secret (`mfa-fallback-secret`).
- Connect to the admin socket namespace using only the string `demo-admin-token`.
- Read/write the entire Supabase database using the service-role key in `.env`.
- Issue Razorpay refunds or trigger webhooks using the leaked Razorpay credentials.
- Send emails from `superui.in` using leaked SMTP app passwords.
- Hijack the Telegram bot.

The fix order in this report, if executed in full, will bring the backend to a defensible production posture. Until the **Immediate** items are complete, the system should not be exposed to untrusted networks.