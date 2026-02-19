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

# Devthon

Devthon is a full-stack waste-management application using:

- Backend: NestJS
- Frontend: Next.js
- Database: PostgreSQL (with Prisma)

This repository contains both `server` and `client` apps plus Docker compose setups for local development and production.

Quick Links
- Frontend: http://localhost:3000
- Backend API: http://localhost:4000/api
- API docs: http://localhost:4000/api/docs

Quick Start (Docker - recommended)

1. Copy environment template and edit values:

```bash
cp .env.example .env
# Edit .env with required values (see Environment section)
```

2. Start development services:

```bash
docker compose -f docker-compose.dev.yml up --build
```

To stop or restart after changing `.env`:

```bash
docker compose -f docker-compose.dev.yml down
docker compose -f docker-compose.dev.yml up --build
```

Production (Docker)

Start production:

```bash
docker compose -f docker-compose.prod.yml up
```

Stop production:

```bash
docker compose -f docker-compose.prod.yml down
```

Manual (local) development

Prerequisites:

- Node.js 20+
- PostgreSQL 16+

Backend (local):

```bash
cd server
npm install
npx prisma migrate dev
npm run start:dev
```

Frontend (local): 

```bash
cd client
npm install
npm run dev
```

Environment

Copy `.env.example` to `.env` and set required values. See `ENV_QUICK_REFERENCE.md` for examples and troubleshooting.

Important vars (examples):

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/dev_db?schema=public

# JWT secrets
JWT_ACCESS_SECRET=your_access_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=your_recaptcha_site_key_here
RECAPTCHA_ALLOW_BROWSER_ERROR=false
```

Database & Migrations

- Prisma migrations live in `server/prisma/migrations`.
- To run migrations locally:

```bash
cd server
npx prisma migrate dev
```

API Overview

- Server base path: `/api` (see `server/src/main.ts`).
- Protected endpoints require `Authorization: Bearer <accessToken>`; admin endpoints require the `ADMIN` role.

Running tests

Server e2e tests (requires services running):

```bash
cd server
npm run test:e2e
```

Troubleshooting

- If `.env` changes don't apply, restart containers:

```bash
docker compose -f docker-compose.dev.yml down && docker compose -f docker-compose.dev.yml up --build
```
- Check `ENV_QUICK_REFERENCE.md` for env var examples and common fixes.

Useful files

- [docker-compose.dev.yml](docker-compose.dev.yml)
- [docker-compose.prod.yml](docker-compose.prod.yml)
- [server/prisma/schema.prisma](server/prisma/schema.prisma)
- [ENV_QUICK_REFERENCE.md](ENV_QUICK_REFERENCE.md)

**Team**

- **Leader:** Anusan Krishnathas
- **Team members:**
	- Ruththiragayan Sutharsan
	- Nidharshan Vigneswaram
	- Abaiyan Ramanaish
	- Neelayadhakshi Priyadhaksan

---
````
