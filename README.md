# Devthon

Full-stack waste management application built with NestJS (backend), Next.js (frontend), and PostgreSQL.

## Quick Start (Docker - recommended)

Full-stack waste management application built with NestJS (backend), Next.js (frontend), and PostgreSQL.

## Quick Start (Docker - recommended)

1. Copy environment template and edit values:

```bash
cp .env.example .env
# Edit .env with required values (see Environment section)
```

```bash
cp .env.example .env
# Edit .env with required values (see Environment section)
```

2. Start services with Docker Compose (development):

```bash
docker compose -f docker-compose.dev.yml up --build
```

Services started by the compose setup:

- PostgreSQL (default port 5432)
- Backend API (default port 4000)
- Frontend (default port 3000)

Access:

Services started by the compose setup:

- PostgreSQL (default port 5432)
- Backend API (default port 4000)
- Frontend (default port 3000)

Access:
    
- Frontend: http://localhost:3000
- Backend API: http://localhost:4000/api
- API docs: http://localhost:4000/api/docs
- API docs: http://localhost:4000/api/docs

To restart after changing `.env`:

````bash
docker compose -f docker-compose.dev.yml down && docker compose -f docker-compose.dev.yml up --build

## Production (Docker)

Production uses prebuilt images from Docker Hub (`anusan2003/trash2cash`).

Start production:

```bash
docker compose -f docker-compose.prod.yml up
````

Stop production:

```bash
docker compose -f docker-compose.prod.yml down
```

````

## Manual (local) development

Prerequisites:

- Node.js 20+
- PostgreSQL 16+

Backend:

Backend:

```bash
cd server
npm install
npx prisma migrate dev
npm run start:dev
````

Frontend:

Frontend:

```bash
cd client
npm install
npm run dev
```

## Environment

Always use `.env` (copy from `.env.example`). The project includes `ENV_QUICK_REFERENCE.md` with examples and troubleshooting.

Required variables (examples):

```bash
# Database (example)
# Example: postgresql://user:password@host:5432/dbname?schema=public
DATABASE_URL=postgresql://user:password@host:5432/dev_db?schema=public
DIRECT_URL=postgresql://user:password@host:5432/dev_db

# JWT Secrets
JWT_ACCESS_SECRET=your_access_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here

# Third-party API keys
GEMINI_API_KEY=your_gemini_api_key_here
```

Optional / commonly used variables (with defaults):

```bash
# Application
PORT=4000                              # Default: 4000
NODE_ENV=development                   # Default: development
CORS_ORIGIN=http://localhost:3000      # Default: http://localhost:3000

# JWT Expiration
JWT_ACCESS_EXPIRES=15m                 # Default: 15m
JWT_REFRESH_EXPIRES=7d                 # Default: 7d

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id_here
# Server (for auth-code flow)
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000
```

If you need the full reference and troubleshooting tips, see `ENV_QUICK_REFERENCE.md`.

## Database & Migrations

- Prisma migrations live in `server/prisma/migrations`.
- The Docker compose will run migrations at container start (see `docker-compose.yml`).

To run migrations locally:

```bash
cd server
npx prisma migrate dev
```

## API Overview

Server base path: `/api` (see `server/src/main.ts`).

Authentication: protected endpoints require `Authorization: Bearer <accessToken>`. Admin endpoints require the `ADMIN` role.

Refer to the server source for full endpoints and DTOs.

## Running tests

Server e2e tests (requires services running):

```bash
cd server
npm run test:e2e
```

## Troubleshooting

- If `.env` changes don't apply, restart containers: `docker compose down && docker compose up --build`.
- Ensure `.env` is in the same folder as `docker-compose.yml`.
- Check `ENV_QUICK_REFERENCE.md` for common fixes.

## Useful files

- `docker-compose.dev.yml` — Development compose
- `docker-compose.prod.yml` — Production compose
- `server/prisma/schema.prisma` — DB schema
- `ENV_QUICK_REFERENCE.md` — env vars and quick commands

---
