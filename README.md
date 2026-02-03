# Devthon

Full-stack waste management application with NestJS backend, Next.js frontend, and PostgreSQL database.

## 🚀 Quick Start

### Option 1: Docker (Recommended)

Start the entire application with a single command:

```bash
docker compose up --build
```

This will start:
- PostgreSQL database on port 5432
- NestJS backend on port 4000
- Next.js frontend on port 3000

**Access the application:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:4000/api
- API Docs: http://localhost:4000/api/docs

For detailed Docker setup instructions, see [`DOCKER_SETUP.md`](DOCKER_SETUP.md).

### Option 2: Manual Setup

**Prerequisites:**
- Node.js 20+
- PostgreSQL 16+

**Backend:**
```bash
cd server
npm install
npx prisma migrate dev
npm run start:dev
```

**Frontend:**
```bash
cd client
npm install
npm run dev
```

---

## 📚 API Reference (server base: `/api`)

### Notes

- All server routes are prefixed with `/api` (see `server/src/main.ts`).
- Protected endpoints require a Bearer JWT in the `Authorization` header: `Authorization: Bearer <accessToken>`.
- Admin endpoints require the authenticated user's role to be `ADMIN`.

Public Endpoints (no auth)

- `GET /api/` — Health / hello (root)
- `GET /api/public/pricing` — Get public pricing information
- `POST /api/public/launch-notify` — Register an email for launch notifications (body: `{ email: string }`)
- `POST /api/chat` — Site-aware assistant chat (body: `{ messages: [{ role, content }], pageContext }`)

Auth Endpoints

- `POST /api/auth/register` — Register a new user (body: `RegisterDto`)
- `POST /api/auth/login` — Login and receive `accessToken` and `refreshToken` (body: `LoginDto`)
- `POST /api/auth/refresh` — Exchange a refresh token for new tokens (body: `{ refreshToken: string }`)
- `POST /api/auth/logout` — Logout (requires JWT)
- `POST /api/auth/otp/send` — Send OTP (body: `{ email: string }`)
- `POST /api/auth/otp/verify` — Verify OTP (body: `{ code: string }`)

User (Authenticated) Endpoints

- `GET /api/me` — Get the current user's profile (requires JWT)
- `PATCH /api/me` — Update current user's profile (requires JWT, body: `UpdateProfileDto`)

Bookings & Pickups (Authenticated)

- `GET /api/bookings` — List bookings for current user (requires JWT)
- `GET /api/bookings/:id` — Get booking by id (requires JWT)
- `POST /api/bookings` — Create a booking (requires JWT, body: `CreateBookingDto`)
- `POST /api/bookings/:id/cancel` — Cancel a booking (requires JWT)
- `GET /api/pickups/pending` — List pending pickups for current user (requires JWT)

Notifications (Authenticated)

- `GET /api/notifications` — List notifications for current user (requires JWT)
- `POST /api/notifications/mark-all-read` — Mark all notifications read (requires JWT)

Admin Endpoints (Authenticated + Role ADMIN)

- `GET /api/admin/metrics` — Get admin dashboard metrics
- `GET /api/admin/users` — List users (optional `?search=`)
- `POST /api/admin/users` — Create user (body: `AdminCreateUserDto`)
- `PATCH /api/admin/users/:id` — Update user (body: `AdminUpdateUserDto`)
- `DELETE /api/admin/users/:id` — Delete user
- `GET /api/admin/drivers` — List drivers
- `POST /api/admin/drivers` — Create driver (body: `AdminCreateDriverDto`)
- `PATCH /api/admin/drivers/:id` — Update driver (body: `AdminUpdateDriverDto`)
- `DELETE /api/admin/drivers/:id` — Delete driver
- `GET /api/admin/bookings` — List bookings (admin view)
- `GET /api/admin/pricing` — List pricing
- `PATCH /api/admin/pricing` — Update pricing (body: `AdminUpdatePricingDto`)

## 🛠️ Configuration

### Environment Variables

**Backend** (`server/.env`):
- `DATABASE_URL` — PostgreSQL connection string
- `PORT` — Server port (default: 4000)
- `JWT_ACCESS_SECRET` — JWT access token secret
- `JWT_REFRESH_SECRET` — JWT refresh token secret
- `CORS_ORIGIN` — Allowed CORS origins
- `GEMINI_API_KEY` — Google Gemini API key (optional, for assistant chat)

**Frontend** (`client`):
- `NEXT_PUBLIC_API_URL` — Backend API URL (configured in `client/lib/api.ts`, default: `http://localhost:4000/api`)

### Docker Environment

When using Docker, environment variables are configured in [`docker-compose.yml`](docker-compose.yml). The setup automatically:
- Creates and configures PostgreSQL database
- Runs Prisma migrations
- Generates Prisma Client
- Enables hot reload for both frontend and backend

If you'd like, I can expand each DTO/shape and example request/response payloads.

View Pages (client UI)

Default client base: `http://localhost:3000`

User (authenticated) pages

- `/app/dashboard` — User dashboard (bookings summary, KPIs)
- `/app/bookings` — My bookings list
- `/app/bookings/new` — Create a new booking
- `/app/bookings/:id` — Booking details (replace `:id`)
- `/app/notifications` — My notifications
- `/app/pending-pickups` — Pending pickups for my account
- `/app/profile` — Profile & settings

Admin pages (requires Admin role)

- `/admin/dashboard` — Admin dashboard and metrics
- `/admin/users` — Manage users (list, create, edit, delete)
- `/admin/drivers` — Manage drivers (list, create, edit, delete)
- `/admin/bookings` — Admin bookings view
- `/admin/pricing` — View/edit pricing

Examples

- User dashboard: `http://localhost:3000/app/dashboard`
- Admin users management: `http://localhost:3000/admin/users`
