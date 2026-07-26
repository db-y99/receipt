# Đăng nhập (Authentication)

Tài liệu mô tả cách LoanLook xác thực người dùng: **không dùng Supabase Auth**, mà dùng cookie `user_id` (httpOnly) sau khi đối chiếu user với Data API lõi.

## Mục lục nhanh

| Mục | Nội dung |
|-----|----------|
| [Luồng tổng quan](#1-luồng-tổng-quan) | Diagram đăng nhập / session |
| [UI Login](#2-ui-login) | Form `/login` |
| [API Auth](#3-api-auth) | `/api/auth/*` |
| [Cookie & session](#4-cookie--session) | `user_id` |
| [Profile Supabase](#5-profile-supabase) | Bảng `profiles` |
| [Bảo vệ route](#6-bảo-vệ-route) | Middleware + AuthGuard |
| [AuthContext](#7-authcontext) | State phía client |
| [Migrate legacy](#8-migrate-từ-localstorage) | localStorage → cookie |
| [File liên quan](#9-file-liên-quan) | Path code |
| [Lưu ý bảo mật](#10-lưu-ý-bảo-mật--hạn-chế-hiện-tại) | Limitation hiện tại |

Liên quan: [Data API](./data-api.md) (model `User`), [API routes](./api/README.md).

---

## 1. Luồng tổng quan

```text
Browser (/login)
  │  POST /api/auth/login { email, password }
  ▼
Next.js API
  │  GET {DATA_API_BASE}/data/User/?filter={ username }
  │  (username = email nhập trên form)
  ▼
Data API (User)
  │  Có user? blocked?
  ▼
Set cookie httpOnly: user_id = User.id
  │
  ▼
Client
  │  (tuỳ chọn) tạo profile Supabase nếu chưa có
  │  AuthContext.signIn(userId) → load profiles
  │  redirect /
  ▼
Dashboard
  │  Middleware / AuthGuard / GET /api/auth/me
  └─ kiểm tra cookie + profiles còn hiệu lực + không bị khóa
```

Hai lớp dữ liệu user:

| Lớp | Vai trò |
|-----|---------|
| **Data API `User`** | Tài khoản hệ thống lõi (username, blocked, display name…) |
| **Supabase `profiles`** | Profile app LoanLook (role, permissions, `deleted_at`) — `id` = `User.id` |

---

## 2. UI Login

| Thuộc tính | Giá trị |
|------------|---------|
| Route | `/login` |
| File | `src/app/login/page.tsx` |
| Form | `email` + `password` (zod: email hợp lệ, password không rỗng) |

### Hành vi

1. Mount → gọi `GET /api/auth/me`. Nếu OK → `router.replace("/")` (đã đăng nhập).
2. Submit → `POST /api/auth/login` với `{ email, password }`.
3. Thành công:
   - Cookie `user_id` đã được set bởi API (httpOnly — JS không đọc trực tiếp).
   - Client gọi thêm Data API `User` theo `username` để lấy `id`, `fullname`, …
   - Nếu chưa có `profiles` → `createProfileIfNotExists(id, username, fullName)`.
   - `signIn(userId)` → toast → điều hướng `/`.
4. Thất bại → lỗi form / toast “Invalid email or password”.

> Field form tên `email` nhưng backend lọc theo **`User.username`** (thường là email đăng nhập hệ thống lõi).

---

## 3. API Auth

Base path: `/api/auth/...` — chi tiết ngắn trong [api/README.md](./api/README.md).

### `POST /api/auth/login`

**File:** `src/app/api/auth/login/route.ts`

| Bước | Chi tiết |
|------|----------|
| Body | `{ email, password }` — thiếu → `400` |
| Tra user | `GET /data/User/` với `filter: { username: email }` |
| Values lấy | `id, username, avatar, fullname, display_name, type__*, blocked, block_reason*` |
| Không tìm thấy | `401` — “Invalid email or password” |
| `blocked` | `403` — kèm lý do khóa; **không** set cookie |
| Thành công | Set cookie `user_id`, trả `{ success: true, data: user }` |

**Mật khẩu:** hiện route có comment TODO — chưa verify password hash qua endpoint auth chuyên dụng của backend. Việc “đăng nhập thành công” phụ thuộc vào việc tìm được `User` theo username (và không bị khóa). Cần cải thiện khi backend cung cấp API xác thực mật khẩu chuẩn.

### `GET /api/auth/me`

**File:** `src/app/api/auth/me/route.ts`

1. Đọc cookie `user_id` — không có → `401`.
2. Kiểm tra `profiles` (Supabase): tồn tại và `deleted_at IS NULL`. Không đạt → xóa cookie, `401`.
3. (Nếu có cấu hình Data API) kiểm tra lại `User.blocked` theo `id`. Nếu bị khóa → xóa cookie, `403`.
4. OK → `{ success: true, data: { id } }`.

### `POST /api/auth/logout`

**File:** `src/app/api/auth/logout/route.ts`

- Xóa cookie `user_id` (cùng `httpOnly` / `path` / `secure` / `sameSite` như lúc set).
- Client gọi qua `AuthContext.signOut()`.

### `POST /api/auth/migrate`

**File:** `src/app/api/auth/migrate/route.ts`

- Body: `{ userId }`.
- Set cookie `user_id` giống login (dùng khi nâng cấp từ auth localStorage cũ).
- **Không** gọi lại Data API để xác thực — chỉ migrate session đã có trên máy client.

---

## 4. Cookie & session

| Thuộc tính | Giá trị |
|------------|---------|
| Tên | `user_id` |
| Nội dung | `User.id` (string) |
| `httpOnly` | `true` (chống XSS đọc cookie) |
| `secure` | `true` khi production |
| `sameSite` | `strict` (prod) / `lax` (dev) |
| `maxAge` | 30 ngày |
| `path` | `/` |

Server đọc session qua:

- Middleware / route handlers: `cookies().get("user_id")`
- Helper: `getApiUserId()` trong `src/lib/api-session.ts` (cookie + profile chưa xóa)

---

## 5. Profile Supabase

Sau login thành công, app đảm bảo có dòng `profiles`:

- `id` = id user Data API
- `username` = email/username đăng nhập
- `fullname` từ `User.fullname` (nếu có)
- Role mặc định DB (thường `user`) nếu tạo mới

Role / admin / permission lấy từ `profiles` (+ bảng `roles`, `permissions`) — **không** dựa vào cookie một mình để phân quyền UI.

Nếu profile bị soft-delete (`deleted_at` khác null), `/api/auth/me` coi như chưa đăng nhập.

---

## 6. Bảo vệ route

### Middleware — `src/middleware.ts`

- Public: `/login` (và `/` để client tự xử lý).
- Bỏ qua: `/api/*`, `_next`, static assets.
- Các path dashboard khác: **bắt buộc** có cookie `user_id`, không có → redirect `/login`.
- Middleware **chỉ** kiểm tra cookie tồn tại — không gọi Data API / Supabase ở đây.

### AuthGuard — `src/components/auth-guard.tsx`

- Client: `GET /api/auth/me`.
- OK → render children; không OK → `router.replace("/login")`.
- Dùng bọc layout dashboard để kiểm tra sâu hơn middleware (profile còn sống, không bị khóa).

---

## 7. AuthContext

**File:** `src/context/AuthContext.tsx`

| State / API | Ý nghĩa |
|-------------|---------|
| `loginId` | `user_id` hiện tại |
| `currentProfile` | Row `profiles` (+ role) |
| `isAdmin` | `roles.code` hoặc `role` === admin |
| `signIn(userId)` | Set state + `loadUserProfile` (cookie đã có từ API) |
| `signOut()` | `POST /api/auth/logout` + clear state |
| `loadUserProfile` | `getProfileById` từ service |

Khởi động: gọi `/api/auth/me` → nếu fail, thử migrate localStorage (mục 8).

---

## 8. Migrate từ localStorage

Auth cũ lưu `user_id` / `userId` trên `localStorage`. Flow hiện tại:

1. Không có cookie hợp lệ.
2. Tìm `localStorage.user_id` hoặc `userId`.
3. `POST /api/auth/migrate` với `{ userId }`.
4. Xóa các key cũ: `user_id`, `userId`, `userInfo`, `token`, `isAuthenticated`.
5. Retry `/api/auth/me`.

Sau khi mọi client đã chuyển cookie, route migrate có thể deprecate.

---

## 9. File liên quan

| File | Vai trò |
|------|---------|
| `src/app/login/page.tsx` | UI đăng nhập |
| `src/app/api/auth/login/route.ts` | Login + set cookie |
| `src/app/api/auth/me/route.ts` | Kiểm tra session |
| `src/app/api/auth/logout/route.ts` | Đăng xuất |
| `src/app/api/auth/migrate/route.ts` | Migrate localStorage |
| `src/middleware.ts` | Gate cookie cho dashboard |
| `src/components/auth-guard.tsx` | Gate client + `/me` |
| `src/context/AuthContext.tsx` | State profile / admin |
| `src/lib/api-session.ts` | `getApiUserId()` cho server |
| `src/services` (profile) | `getProfileByUsername`, `createProfileIfNotExists`, `getProfileById` |

---

## 10. Lưu ý bảo mật / hạn chế hiện tại

1. **Password:** login API chưa verify mật khẩu với endpoint auth chuyên dụng của backend (có TODO trong code). Không coi đây là xác thực mật khẩu đầy đủ cho đến khi bổ sung.
2. **Cookie = identity:** ai giữ được cookie `user_id` hợp lệ và còn profile → được coi là đã đăng nhập. Cần HTTPS production (`secure` cookie).
3. **Migrate** không re-auth — chỉ dùng cho chuyển đổi legacy.
4. **Phân quyền** sau login: PermissionContext / bảng permissions — tách khỏi tài liệu này; xem docs permissions nếu có.
5. Trong docs **không** ghi base URL Data API hay giá trị env — cấu hình trên server/local, path model là `/data/User/`.

---

## Checklist khi sửa auth

- [ ] Cookie set/clear cùng `httpOnly`, `path`, `maxAge`, `secure`, `sameSite`
- [ ] `/me` vẫn kiểm tra `profiles.deleted_at` và (nếu có) `User.blocked`
- [ ] Login vẫn tạo profile nếu thiếu (không chặn login khi insert lỗi nhẹ)
- [ ] Middleware matcher không vô tình bảo vệ nhầm `/api` hoặc static
- [ ] Không log password / không commit secret env vào docs
