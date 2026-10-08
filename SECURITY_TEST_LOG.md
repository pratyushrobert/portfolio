# MimiOS — Penetration Testing & Security Assessment Command Log

**Target Application:** MimiOS (Desktop Portfolio System)  
**Host / Ports:** `http://127.0.0.1:3001` (Fastify REST API), `http://localhost:5173` (Vite / React Frontend)  
**Date of Testing:** 2026-10-07  
**Authorization:** Authorized assessment by system owner  
**Assessment Scope:** Local application source, database, client components, and running local services. (No external/third-party targets).

---

## 1. Environment & Reconnaissance Commands

### 1.1 Local Service Discovery
```powershell
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 3000, 3001, 5173, 8080 }
```
**Observed Result:**
- `127.0.0.1:3001` (Fastify Backend Server, PID 25016)
- `::1:5173` / `127.0.0.1:5173` (Vite Frontend Dev Server, PID 24660)

### 1.2 Health Endpoint Verification
```http
GET /health HTTP/1.1
Host: 127.0.0.1:3001
```
**Response:**
```http
HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
content-security-policy: default-src 'self';base-uri 'self';font-src 'self' https: data:;form-action 'self';frame-ancestors 'self';img-src 'self' data:;object-src 'none';script-src 'self';script-src-attr 'none';style-src 'self' https: 'unsafe-inline';upgrade-insecure-requests
x-content-type-options: nosniff
x-frame-options: SAMEORIGIN
strict-transport-security: max-age=31536000; includeSubDomains

{"status":"ok","timestamp":1791391310000}
```

---

## 2. Dependency Audit Commands

### 2.1 Root Project Audit
```bash
npm audit --json
```
**Observed Result:**
- Found 1 high-severity advisory in development dependencies (`source-map-js`, GHSA-68fv-2mgg-jv7q).
- Zero production dependency vulnerabilities.

### 2.2 Backend Server Audit
```bash
cd server && npm audit --json
```
**Observed Result:**
- Found 6 advisories in test/development dependencies (`vitest`, `tinypool`, `@vitest/mocker`, `vite`, `esbuild`).
- Zero production runtime dependency vulnerabilities.

### 2.3 Automated Test Suite Execution
```bash
cd server && npm test
```
**Observed Result:**
- 8 test files passed (56 of 56 tests passing).
- Includes unit and integration coverage for security foundations, password hashing, CORS origin filtering, auth sessions, and validation.

---

## 3. Dynamic HTTP Assessment Logs

### 3.1 CORS & Cross-Origin POST Defense Tests
```bash
node -e "
const origins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://evil.com', 'null'];
// Probe GET and POST across origins
"
```
**Request 1:**
```http
GET /api/portfolio HTTP/1.1
Host: 127.0.0.1:3001
Origin: http://evil.com
```
**Response:** `HTTP/1.1 200 OK`, `Access-Control-Allow-Origin: null` (Origin rejected)

**Request 2:**
```http
POST /api/auth/login HTTP/1.1
Host: 127.0.0.1:3001
Origin: http://evil.com
Content-Type: application/json

{"email":"admin@mimios.local","password":"[REDACTED]"}
```
**Response:**
```http
HTTP/1.1 403 Forbidden
content-type: application/json; charset=utf-8

{"success":false,"error":"Cross-origin request forbidden","code":"ORIGIN_FORBIDDEN"}
```

**Request 3 (Null Origin Probe):**
```http
POST /api/auth/login HTTP/1.1
Host: 127.0.0.1:3001
Origin: null
Content-Type: application/json

{"email":"admin@mimios.local","password":"[REDACTED]"}
```
**Response:** `HTTP/1.1 403 Forbidden`, `code: ORIGIN_FORBIDDEN`

---

### 3.2 Authentication & Rate-Limiting Tests

**Probed Payloads against `POST /api/auth/login`:**
1. Missing `email` field: `{"password":"..."}` -> `400 Bad Request` (`VALIDATION_ERROR: Required`)
2. Malformed `email`: `{"email":"notanemail","password":"..."}` -> `400 Bad Request` (`VALIDATION_ERROR: Invalid email`)
3. Empty `password`: `{"email":"admin@mimios.local","password":""}` -> `400 Bad Request` (`VALIDATION_ERROR: too_small`)
4. SQL Injection payload: `{"email":"admin' OR 1=1 --@mimios.local","password":"..."}` -> `429 Too Many Requests` (Rate limit triggered)
5. Extra field injection: `{"email":"admin@mimios.local","password":"...","admin":true}` -> `400 Bad Request` (Strict schema rejects unknown fields)
6. Non-existent user probe -> Evaluated in constant time via `DUMMY_HASH` bcrypt comparison.

**Rate Limiter Enforcement:**
- Route: `POST /api/auth/login`
- Limit: 5 requests / 1 minute
- Status after 5 requests: `HTTP/1.1 429 Too Many Requests`
```json
{"statusCode":429,"error":"Too Many Requests","message":"Rate limit exceeded, retry in 34 seconds"}
```

---

### 3.3 Authorization & IDOR Probe Matrix

Tested all 27 admin endpoints under unauthenticated state, invalid cookie state, and tampered signature state:

| Method | Path | Unauthenticated Status | Tampered Cookie Status |
| :--- | :--- | :---: | :---: |
| `GET` | `/api/admin/dashboard` | 401 UNAUTHENTICATED | 401 UNAUTHENTICATED |
| `GET` | `/api/admin/portfolio` | 401 UNAUTHENTICATED | 401 UNAUTHENTICATED |
| `PATCH` | `/api/admin/portfolio` | 401 UNAUTHENTICATED | 401 UNAUTHENTICATED |
| `PATCH` | `/api/admin/portfolio/:key` | 401 UNAUTHENTICATED | 401 UNAUTHENTICATED |
| `GET` | `/api/admin/projects` | 401 UNAUTHENTICATED | 401 UNAUTHENTICATED |
| `GET` | `/api/admin/projects/:id` | 401 UNAUTHENTICATED | 401 UNAUTHENTICATED |
| `POST` | `/api/admin/projects` | 401 UNAUTHENTICATED | 401 UNAUTHENTICATED |
| `PATCH` | `/api/admin/projects/:id` | 401 UNAUTHENTICATED | 401 UNAUTHENTICATED |
| `DELETE` | `/api/admin/projects/:id` | 401 UNAUTHENTICATED | 401 UNAUTHENTICATED |
| `POST` | `/api/admin/projects/:id/github-sync` | 401 UNAUTHENTICATED | 401 UNAUTHENTICATED |
| `GET` | `/api/admin/skills` | 401 UNAUTHENTICATED | 401 UNAUTHENTICATED |
| `POST` | `/api/admin/skills` | 401 UNAUTHENTICATED | 401 UNAUTHENTICATED |
| `PATCH` | `/api/admin/skills/:id` | 401 UNAUTHENTICATED | 401 UNAUTHENTICATED |
| `DELETE` | `/api/admin/skills/:id` | 401 UNAUTHENTICATED | 401 UNAUTHENTICATED |
| `GET` | `/api/admin/experience` | 401 UNAUTHENTICATED | 401 UNAUTHENTICATED |
| `POST` | `/api/admin/experience` | 401 UNAUTHENTICATED | 401 UNAUTHENTICATED |
| `PATCH` | `/api/admin/experience/:id` | 401 UNAUTHENTICATED | 401 UNAUTHENTICATED |
| `DELETE` | `/api/admin/experience/:id` | 401 UNAUTHENTICATED | 401 UNAUTHENTICATED |
| `GET` | `/api/admin/certificates` | 401 UNAUTHENTICATED | 401 UNAUTHENTICATED |
| `POST` | `/api/admin/certificates` | 401 UNAUTHENTICATED | 401 UNAUTHENTICATED |
| `PATCH` | `/api/admin/certificates/:id` | 401 UNAUTHENTICATED | 401 UNAUTHENTICATED |
| `DELETE` | `/api/admin/certificates/:id` | 401 UNAUTHENTICATED | 401 UNAUTHENTICATED |
| `GET` | `/api/admin/assets` | 401 UNAUTHENTICATED | 401 UNAUTHENTICATED |
| `DELETE` | `/api/admin/assets/:id` | 401 UNAUTHENTICATED | 401 UNAUTHENTICATED |
| `GET` | `/api/admin/config` | 401 UNAUTHENTICATED | 401 UNAUTHENTICATED |
| `PATCH` | `/api/admin/config` | 401 UNAUTHENTICATED | 401 UNAUTHENTICATED |
| `PATCH` | `/api/admin/config/:key` | 401 UNAUTHENTICATED | 401 UNAUTHENTICATED |

**Summary:** 27/27 endpoints enforced server-side authentication with zero bypasses observed.

---

### 3.4 Public API Injection & Path Traversal Tests

| Target Endpoint & Probe | Test Purpose | Result | Code |
| :--- | :--- | :---: | :--- |
| `GET /api/projects/00000000-0000-0000-0000-000000000000' OR '1'='1` | SQL Injection in `:id` | `400` | `VALIDATION_ERROR` (UUID constraint) |
| `GET /api/config/site_name' OR '1'='1` | SQL Injection in `:key` | `400` | `VALIDATION_ERROR` (Regex constraint) |
| `GET /api/assets?category=image' OR '1'='1` | SQL Injection in `category` | `400` | `VALIDATION_ERROR` (Enum constraint) |
| `GET /api/assets?limit=50;DROP TABLE assets--` | SQL Injection in `limit` | `400` | `VALIDATION_ERROR` (Integer coercion) |
| `GET /api/assets?offset=-1` | Negative offset boundary | `400` | `VALIDATION_ERROR` (min(0) constraint) |
| `GET /api/portfolio/about' OR '1'='1` | SQL Injection in `:key` | `400` | `VALIDATION_ERROR` (Regex constraint) |
| `GET /api/github/repos/..%2f..%2fetc/contents` | Path traversal in repository name | `400` | `VALIDATION_ERROR` |
| `GET /api/github/repos/test/contents?path=..%2f..%2fetc%2fpasswd` | Path traversal in GitHub contents path | `400` | `INVALID_PATH` |
| `GET /api/github/repos/test/file?path=%2e%2e%2f%2e%2e%2fwindows%2fsystem32%2fcalc.exe` | Double-encoded path traversal | `400` | `INVALID_PATH` |
| `GET /uploads/..%2f..%2fpackage.json` | Path traversal on static uploads route | `404` | `NOT_FOUND` |
| `GET /uploads/..\..\package.json` | Windows backslash traversal on static uploads | `404` | `NOT_FOUND` |

---

### 3.5 Session Lifecycle & State Replay Verification

```
Step 1: POST /api/auth/login [VALID CREDENTIALS]
Response: HTTP 200 OK
Set-Cookie: mimios_session=[UUID].[HMAC]; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax

Step 2: GET /api/auth/me [COOKIE: mimios_session]
Response: HTTP 200 OK, {"success":true,"data":{"user":{"email":"admin@mimios.local","role":"admin"}}}

Step 3: GET /api/admin/dashboard [COOKIE: mimios_session]
Response: HTTP 200 OK

Step 4: GET /api/admin/dashboard [TAMPERED SIGNATURE]
Response: HTTP 401 Unauthorized, {"success":false,"error":"Authentication required","code":"UNAUTHENTICATED"}

Step 5: GET /api/admin/dashboard [UNSIGNED RAW UUID]
Response: HTTP 401 Unauthorized, {"success":false,"error":"Authentication required","code":"UNAUTHENTICATED"}

Step 6: POST /api/auth/logout [COOKIE: mimios_session]
Response: HTTP 200 OK
Set-Cookie: mimios_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT

Step 7: GET /api/admin/dashboard [REPLAY EXPIRED/LOGGED-OUT COOKIE]
Response: HTTP 401 Unauthorized, {"success":false,"error":"Authentication required","code":"UNAUTHENTICATED"}
```

---

## 4. Verification Summary
All testing commands executed successfully against local instances without triggering unintended service degradation, data destruction, or external network requests.
