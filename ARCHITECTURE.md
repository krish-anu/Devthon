# 🏗️ Docker Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Host Machine                             │
│                      (Your Computer)                             │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              Docker Network: trash2cash-network            │ │
│  │                                                              │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │ │
│  │  │              │  │              │  │              │    │ │
│  │  │  PostgreSQL  │  │   NestJS     │  │   Next.js    │    │ │
│  │  │   Database   │  │   Backend    │  │   Frontend   │    │ │
│  │  │              │  │              │  │              │    │ │
│  │  │  Port: 5432  │  │  Port: 4000  │  │  Port: 3000  │    │ │
│  │  │              │  │              │  │              │    │ │
│  │  │  Container:  │  │  Container:  │  │  Container:  │    │ │
│  │  │  trash2cash  │  │  trash2cash  │  │  trash2cash  │    │ │
│  │  │     -db      │  │   -backend   │  │  -frontend   │    │ │
│  │  │              │  │              │  │              │    │ │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │ │
│  │         │                 │                 │            │ │
│  │         │    ┌────────────┴────────────┐    │            │ │
│  │         │    │  Internal Communication │    │            │ │
│  │         │    │  via Service Names:     │    │            │ │
│  │         │    │  - backend → db:5432    │    │            │ │
│  │         │    │  - frontend → backend:  │    │            │ │
│  │         │    │              4000       │    │            │ │
│  │         │    └─────────────────────────┘    │            │ │
│  │         │                                    │            │ │
│  └─────────┼────────────────────────────────────┼───────────┘ │
│            │                                    │              │
│  ┌─────────┼────────────────────────────────────┼───────────┐ │
│  │         │         Port Mapping               │           │ │
│  │         │                                    │           │ │
│  │    localhost:5432 ──────────────────────────┘           │ │
│  │    localhost:4000 ───────────────────────────────────────┘ │
│  │    localhost:3000 ───────────────────────────────────────┘ │
│  │                                                             │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    Persistent Volumes                        │ │
│  │                                                              │ │
│  │  postgres_data: Database files                              │ │
│  │  ./server/logs: Application logs                            │ │
│  │  ./server/src: Backend source (hot reload)                  │ │
│  │  ./client/app: Frontend source (hot reload)                 │ │
│  └─────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────┘
```

## Service Communication

### Browser → Frontend (Client-Side)
```
User Browser
    ↓ http://localhost:3000
Next.js Frontend Container
```

### Browser → Backend (Client-Side API Calls)
```
User Browser
    ↓ http://localhost:4000/api
NestJS Backend Container
```

### Frontend → Backend (Server-Side)
```
Next.js Frontend Container
    ↓ http://backend:4000/api (Docker service name)
NestJS Backend Container
```

### Backend → Database
```
NestJS Backend Container
    ↓ postgresql://trash2cash:password@db:5432/trash2cash
PostgreSQL Database Container
```

## Container Details

### 🗄️ PostgreSQL Database Container

**Image:** `postgres:16-alpine`  
**Container Name:** `trash2cash-db`  
**Internal Port:** 5432  
**Exposed Port:** 5432 → localhost:5432  

**Environment Variables:**
- `POSTGRES_USER=trash2cash`
- `POSTGRES_PASSWORD=trash2cash_dev_password`
- `POSTGRES_DB=trash2cash`

**Volumes:**
- `postgres_data:/var/lib/postgresql/data` (persistent storage)

**Health Check:**
- Command: `pg_isready -U trash2cash`
- Interval: 10s
- Timeout: 5s
- Retries: 5

---

### 🔧 NestJS Backend Container

**Base Image:** `node:20-alpine`  
**Container Name:** `trash2cash-backend`  
**Internal Port:** 4000  
**Exposed Port:** 4000 → localhost:4000  

**Build Context:** `./server`  
**Dockerfile:** `server/Dockerfile`

**Environment Variables:**
- `DATABASE_URL=postgresql://trash2cash:...@db:5432/trash2cash`
- `PORT=4000`
- `NODE_ENV=development`
- `JWT_ACCESS_SECRET=...`
- `JWT_REFRESH_SECRET=...`
- `CORS_ORIGIN=http://localhost:3000`

**Volumes (Hot Reload):**
- `./server/src:/app/src` (source code)
- `./server/prisma:/app/prisma` (database schema)
- `./server/logs:/app/logs` (application logs)
- `/app/node_modules` (anonymous volume)

**Startup Process:**
1. Install dependencies (`npm ci`)
2. Generate Prisma Client (`npx prisma generate`)
3. Run migrations (`npx prisma migrate deploy`)
4. Start dev server (`npm run start:dev`)

**Dependencies:**
- Waits for `db` service to be healthy

---

### ⚛️ Next.js Frontend Container

**Base Image:** `node:20-alpine`  
**Container Name:** `trash2cash-frontend`  
**Internal Port:** 3000  
**Exposed Port:** 3000 → localhost:3000  

**Build Context:** `./client`  
**Dockerfile:** `client/Dockerfile`

**Environment Variables:**
- `NEXT_PUBLIC_API_URL=http://backend:4000/api` (server-side)
- `NEXT_PUBLIC_CLIENT_API_URL=http://localhost:4000/api` (client-side)
- `NODE_ENV=development`

**Volumes (Hot Reload):**
- `./client/app:/app/app` (pages)
- `./client/components:/app/components` (components)
- `./client/lib:/app/lib` (utilities)
- `./client/hooks:/app/hooks` (React hooks)
- `./client/public:/app/public` (static files)
- `/app/node_modules` (anonymous volume)
- `/app/.next` (build cache)

**Startup Process:**
1. Install dependencies (`npm ci`)
2. Start dev server (`npm run dev`)

**Dependencies:**
- Waits for `backend` service to start

---

## Network Configuration

**Network Name:** `trash2cash-network`  
**Driver:** bridge

All containers are connected to this network, allowing them to communicate using service names as hostnames:

- `db` → PostgreSQL database
- `backend` → NestJS API server
- `frontend` → Next.js web server

## Volume Management

### Named Volumes
- **postgres_data**: Persists PostgreSQL database files across container restarts

### Bind Mounts (Development)
- **./server/src** → Hot reload for backend code changes
- **./client/app** → Hot reload for frontend code changes
- **./server/logs** → Access logs from host machine

### Anonymous Volumes
- **/app/node_modules** → Prevents host node_modules from overwriting container dependencies
- **/app/.next** → Preserves Next.js build cache

## Data Flow

### User Registration Flow
```
1. Browser → http://localhost:3000/signup
2. User fills form
3. Frontend → http://localhost:4000/api/auth/register
4. Backend validates data
5. Backend → db:5432 (INSERT user)
6. Database returns user data
7. Backend generates JWT tokens
8. Backend → Frontend (tokens + user data)
9. Frontend stores tokens in localStorage
10. Frontend redirects to dashboard
```

### Booking Creation Flow
```
1. Browser → http://localhost:3000/users/bookings/new
2. User fills booking form
3. Frontend → http://localhost:4000/api/bookings (with JWT)
4. Backend validates JWT
5. Backend validates booking data
6. Backend → db:5432 (INSERT booking)
7. Database returns booking data
8. Backend → Frontend (booking confirmation)
9. Frontend shows success message
```

## Development Workflow

### Making Code Changes

**Backend Changes:**
1. Edit files in `./server/src/`
2. NestJS automatically detects changes
3. Server recompiles and restarts
4. Changes reflected immediately

**Frontend Changes:**
1. Edit files in `./client/app/` or `./client/components/`
2. Next.js Fast Refresh detects changes
3. Browser automatically updates
4. Changes reflected immediately

**Database Schema Changes:**
1. Edit `./server/prisma/schema.prisma`
2. Run: `docker compose exec backend npx prisma migrate dev --name migration_name`
3. Prisma generates migration files
4. Migration applied to database
5. Prisma Client regenerated

## Port Reference

| Service    | Internal Port | External Port | Access URL                      |
|------------|---------------|---------------|---------------------------------|
| Frontend   | 3000          | 3000          | http://localhost:3000           |
| Backend    | 4000          | 4000          | http://localhost:4000/api       |
| API Docs   | 4000          | 4000          | http://localhost:4000/api/docs  |
| Database   | 5432          | 5432          | localhost:5432                  |
| Prisma Studio | 5555       | 5555          | http://localhost:5555           |

## Security Notes (Development)

⚠️ **This setup is for DEVELOPMENT only!**

**Current Security Considerations:**
- Database credentials are hardcoded
- JWT secrets are simple strings
- All ports are exposed to host
- No HTTPS/TLS encryption
- CORS allows localhost only

**For Production:**
- Use Docker secrets for sensitive data
- Generate strong, random JWT secrets
- Use environment-specific .env files
- Implement HTTPS with reverse proxy
- Use managed database service
- Restrict network access
- Enable rate limiting
- Implement proper logging and monitoring

## Troubleshooting

### Container Won't Start
```bash
# Check logs
docker compose logs [service-name]

# Check if ports are in use
sudo lsof -i :3000
sudo lsof -i :4000
sudo lsof -i :5432
```

### Database Connection Issues
```bash
# Check database health
docker compose ps

# Test database connection
docker compose exec db psql -U trash2cash -d trash2cash -c "SELECT 1;"
```

### Hot Reload Not Working
```bash
# Restart specific service
docker compose restart backend
docker compose restart frontend

# Rebuild if needed
docker compose up --build [service-name]
```

### Clean Start
```bash
# Stop everything and remove volumes
docker compose down -v

# Rebuild from scratch
docker compose up --build
```

---

**For more information, see [`DOCKER_SETUP.md`](DOCKER_SETUP.md)**
