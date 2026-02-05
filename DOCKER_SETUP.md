# 🐳 Docker Setup Guide

Complete Docker setup for the Trash2Cash full-stack application with NestJS backend, Next.js frontend, and PostgreSQL database.

## 📁 Project Structure

```
Devthon/
├── docker-compose.yml          # Main Docker Compose configuration
├── .env.example                # Environment variables template
├── server/                     # NestJS Backend
│   ├── Dockerfile             # Backend Docker configuration
│   ├── .dockerignore          # Files to exclude from Docker build
│   ├── .env.docker.example    # Backend environment template
│   ├── src/                   # Source code
│   └── prisma/                # Database schema and migrations
└── client/                     # Next.js Frontend
    ├── Dockerfile             # Frontend Docker configuration
    ├── .dockerignore          # Files to exclude from Docker build
    ├── app/                   # Next.js app directory
    └── components/            # React components
```

## 🚀 Quick Start

### Prerequisites

- Docker (version 20.10 or higher)
- Docker Compose (version 2.0 or higher)

### 1. Clone and Navigate

```bash
cd /home/nidharshan/Documents/Projects/Devthon
```

### 2. Set Up Environment Variables (Optional)

If you need to use external services like Gemini AI:

```bash
# Copy the example file
cp .env.example .env

# Edit .env and add your API keys
nano .env
```

### 3. Start the Application

```bash
# Build and start all services
docker compose up --build

# Or run in detached mode (background)
docker compose up --build -d
```

This single command will:

- ✅ Start PostgreSQL database
- ✅ Build and start NestJS backend
- ✅ Run Prisma migrations automatically
- ✅ Generate Prisma Client
- ✅ Build and start Next.js frontend
- ✅ Set up networking between services

### 4. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000/api
- **API Documentation**: http://localhost:4000/api/docs
- **Database**: localhost:5432

## 🛠️ Docker Services

### PostgreSQL Database (`db`)

- **Image**: postgres:16-alpine
- **Port**: 5432
- **Credentials**:
  - User: `trash2cash`
  - Password: `trash2cash_dev_password`
  - Database: `trash2cash`
- **Data Persistence**: Volume `postgres_data`

### NestJS Backend (`backend`)

- **Port**: 4000
- **Features**:
  - Hot reload enabled (watches `src/` directory)
  - Automatic Prisma migrations on startup
  - Winston logging to `logs/` directory
  - JWT authentication
  - Swagger API documentation

### Next.js Frontend (`frontend`)

- **Port**: 3000
- **Features**:
  - Hot reload enabled
  - Automatic connection to backend via Docker network
  - Environment variables for API URLs

## 📝 Common Commands

### Start Services

```bash
# Start all services
docker compose up

# Start in background
docker compose up -d

# Rebuild and start
docker compose up --build
```

### Stop Services

```bash
# Stop all services
docker compose down

# Stop and remove volumes (⚠️ deletes database data)
docker compose down -v
```

### View Logs

```bash
# View all logs
docker compose logs

# Follow logs in real-time
docker compose logs -f

# View specific service logs
docker compose logs backend
docker compose logs frontend
docker compose logs db
```

### Execute Commands in Containers

```bash
# Access backend shell
docker compose exec backend sh

# Access frontend shell
docker compose exec frontend sh

# Access database shell
docker compose exec db psql -U trash2cash -d trash2cash

# Run Prisma commands
docker compose exec backend npx prisma studio
docker compose exec backend npx prisma migrate dev
docker compose exec backend npx prisma db seed
```

### Restart Services

```bash
# Restart all services
docker compose restart

# Restart specific service
docker compose restart backend
```

### View Running Containers

```bash
docker compose ps
```

## 🔧 Development Workflow

### Making Code Changes

The Docker setup includes volume mounts for hot reload:

**Backend** (`server/src` and `server/prisma`):

- Changes to TypeScript files automatically trigger NestJS reload
- Changes to Prisma schema require manual migration:
  ```bash
  docker compose exec backend npx prisma migrate dev --name your_migration_name
  ```

**Frontend** (`client/app`, `client/components`, etc.):

- Changes automatically trigger Next.js hot reload
- No manual restart needed

### Database Migrations

```bash
# Create a new migration
docker compose exec backend npx prisma migrate dev --name add_new_field

# Apply migrations
docker compose exec backend npx prisma migrate deploy

# Reset database (⚠️ deletes all data)
docker compose exec backend npx prisma migrate reset

# Seed database
docker compose exec backend npm run seed
```

### Prisma Studio (Database GUI)

```bash
# Open Prisma Studio
docker compose exec backend npx prisma studio
```

Then access at: http://localhost:5555

## 🌐 Network Configuration

All services are connected via the `trash2cash-network` bridge network:

- **Frontend → Backend**: Uses `http://backend:4000/api` (Docker service name)
- **Backend → Database**: Uses `postgresql://trash2cash:trash2cash_dev_password@db:5432/trash2cash`
- **Browser → Backend**: Uses `http://localhost:4000/api` (host machine)

## 🔐 Environment Variables

### Backend Environment Variables

Set in [`docker-compose.yml`](docker-compose.yml):

| Variable             | Description                  | Default                                          |
| -------------------- | ---------------------------- | ------------------------------------------------ |
| `DATABASE_URL`       | PostgreSQL connection string | `postgresql://trash2cash:...@db:5432/trash2cash` |
| `DIRECT_URL`         | Direct database connection   | Same as DATABASE_URL                             |
| `PORT`               | Backend server port          | `4000`                                           |
| `NODE_ENV`           | Environment mode             | `development`                                    |
| `JWT_ACCESS_SECRET`  | JWT access token secret      | `dev_access_secret_change_in_production`         |
| `JWT_REFRESH_SECRET` | JWT refresh token secret     | `dev_refresh_secret_change_in_production`        |
| `CORS_ORIGIN`        | Allowed CORS origins         | `http://localhost:3000`                          |
| `GEMINI_API_KEY`     | Google Gemini API key        | (optional)                                       |

### Frontend Environment Variables

| Variable              | Description                   | Default                     |
| --------------------- | ----------------------------- | --------------------------- |
| `NEXT_PUBLIC_API_URL` | Backend API URL (client-side) | `http://localhost:4000/api` |

## 🐛 Troubleshooting

### Port Already in Use

If you get "port already in use" errors:

```bash
# Check what's using the port
sudo lsof -i :3000  # Frontend
sudo lsof -i :4000  # Backend
sudo lsof -i :5432  # Database

# Stop the conflicting process or change ports in docker-compose.yml
```

### Database Connection Issues

```bash
# Check if database is healthy
docker compose ps

# View database logs
docker compose logs db

# Restart database
docker compose restart db
```

### Backend Not Starting

```bash
# View backend logs
docker compose logs backend

# Common issues:
# 1. Database not ready - wait a few seconds and check again
# 2. Prisma migration failed - check migration files
# 3. Missing dependencies - rebuild: docker compose up --build
```

### Frontend Not Loading

```bash
# View frontend logs
docker compose logs frontend

# Check if backend is accessible
curl http://localhost:4000/api

# Rebuild frontend
docker compose up --build frontend
```

### Clear Everything and Start Fresh

```bash
# Stop and remove all containers, networks, and volumes
docker compose down -v

# Remove all images
docker compose down --rmi all

# Rebuild from scratch
docker compose up --build
```

## 🔄 Updating Dependencies

### Backend Dependencies

```bash
# Access backend container
docker compose exec backend sh

# Install new package
npm install package-name

# Exit container
exit

# Rebuild to persist changes
docker compose up --build backend
```

### Frontend Dependencies

```bash
# Access frontend container
docker compose exec frontend sh

# Install new package
npm install package-name

# Exit container
exit

# Rebuild to persist changes
docker compose up --build frontend
```

## 📊 Production Considerations

This setup is optimized for **development**. For production:

1. **Use multi-stage builds** to reduce image size
2. **Change JWT secrets** to strong, random values
3. **Use environment-specific .env files**
4. **Enable HTTPS** with reverse proxy (nginx/traefik)
5. **Set `NODE_ENV=production`**
6. **Use managed database** instead of Docker container
7. **Implement proper logging** and monitoring
8. **Add health checks** for all services
9. **Use Docker secrets** for sensitive data
10. **Implement backup strategy** for database

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)

## 🆘 Getting Help

If you encounter issues:

1. Check the logs: `docker compose logs -f`
2. Verify all services are running: `docker compose ps`
3. Ensure ports are not in use: `sudo lsof -i :3000 :4000 :5432`
4. Try rebuilding: `docker compose up --build`
5. Start fresh: `docker compose down -v && docker compose up --build`

---

**Happy Coding! 🚀**
