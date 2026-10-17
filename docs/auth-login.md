# Đăng nhập (Authentication)

Người dùng đăng nhập bằng tài khoản Data API, giống bước xác thực mật khẩu của LoanLook. Session là cookie httpOnly `user_id`. Quyền vào app nằm trên Supabase: hồ sơ `profiles` cùng `id`, `deleted_at` null, và role `admin` hoặc quyền `receipt:view`. Gán quyền đó trên LoanLook `/permissions`, mục Phiếu thu. Không tự tạo hồ sơ mới.

## Luồng

```text
Browser (/login)
  │  POST /api/auth/login { email, password }
  ▼
Receipt API
  │  GET {API_BASE_URL}/login/?filter={ username, password }
  │  Body rỗng HTTP 200 = sai mật khẩu
  │  /login/ trả non-JSON hoặc HTTP lỗi thì fallback /data/User/ theo username
  ▼
Không bị khóa?
  │
  ▼
Supabase profiles: có dòng và deleted_at null?
  │  Không → 403, không gắn cookie
  ▼
Role admin hoặc role_permissions có receipt:view?
  │  Không → 403, không gắn cookie
  ▼
Set-Cookie user_id (httpOnly, 30 ngày)
  │
  ▼
Client vào /
  │  GET /api/auth/me kiểm tra cookie và User.blocked
```

Field form tên email, backend lọc theo `User.username`.

## API

| Route | Việc |
|-------|------|
| `POST /api/auth/login` | Thiếu email/password → 400. Sai mật khẩu → 401. `blocked`, hồ sơ thiếu/đã xóa, hoặc không có `receipt:view` → 403, không gắn cookie. Thành công → cookie + `{ success, data }` (không trả `password`). |
| `GET /api/auth/me` | Không cookie → 401. Hồ sơ thiếu, đã xóa, hoặc không có `receipt:view` → xóa cookie, 401. Bị khóa → xóa cookie, 403. OK → `{ id, username, fullname }`. |
| `POST /api/auth/logout` | Xóa cookie. |

Cookie: `HttpOnly`, `Path=/`, `Max-Age` 30 ngày, `SameSite=Strict` khi production và `Lax` khi dev, `Secure` khi production.

Dev (`vite`) phục vụ `/api/auth/*` bằng [plugins/authProxy.ts](../plugins/authProxy.ts). Production là hàm Vercel `api/auth/login.ts`, `me.ts`, `logout.ts`. Cả hai gọi [api/lib/auth.js](../api/lib/auth.js). File này là JavaScript vì Vercel biên dịch handler thành `.js` rồi không tải được import `.ts`.

## Trang

| Path | Ai vào được |
|------|-------------|
| `/login` | Chưa đăng nhập. Đã có session thì về `/`. |
| `/`, `/due-soon` | Phải có session và quyền `receipt:view` (role admin luôn được). Không có session thì về `/login`. |

Header phiếu thu và trang đến hạn hiện tên user và nút Đăng xuất.

## API dữ liệu

`GET /api/applications/search` và `GET /api/loans/due-soon` đọc cookie `user_id` rồi kiểm tra `receipt:view`. Không có cookie → 401. Không có quyền → 403. Có quyền thì query Data API với `login` bằng id đó.

`POST /api/slips/generate` giữ `x-api-key` (`SLIP_API_KEY`) và `API_LOGIN`. Không đòi cookie.

## Hạn chế

1. Khi `/login/` của host API hỏng (non-JSON hoặc HTTP lỗi), server fallback tra username và không kiểm được mật khẩu. Body rỗng HTTP 200 vẫn là sai mật khẩu, không fallback.
2. Ai giữ cookie `user_id` còn hiệu lực và user không bị khóa thì được coi là đã đăng nhập. Production cần HTTPS để cookie `Secure` có tác dụng.
3. `SUPABASE_URL` và `SUPABASE_ANON_KEY` chỉ đặt trên server (Vite đọc trong `vite.config`, Vercel env). Không đưa vào `define` của Vite. Anon key đọc được `profiles` vì policy anon của project LoanLook; không dùng service role.
