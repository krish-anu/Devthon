# 🚀 Docker Quick Start

## Prerequisites

Before starting, you need to set up your environment variables:

```bash
# Copy the example .env file
cp .env.example .env

# Edit .env with your actual credentials (if needed)
# The file already contains the current values, but you should review them
nano .env  # or use your preferred editor
```

**⚠️ IMPORTANT:** Never commit the `.env` file to version control. It contains sensitive credentials.

## One-Command Setup

```bash
docker compose up --build
```

That's it! This starts:
- ✅ NestJS backend with auto-migrations (connects to external Supabase database)
- ✅ Next.js frontend with hot reload

**Note:** This setup uses an external Supabase PostgreSQL database. No local database container is started.

## Access URLs

| Service | URL |
|---------|-----|
| 🌐 Frontend | http://localhost:3000 |
| 🔧 Backend API | http://localhost:4000/api |
| 📚 API Docs | http://localhost:4000/api/docs |
| 🗄️ Database | Supabase (external) |

## Essential Commands

### Start & Stop
```bash
# Start (foreground)
docker compose up

# Start (background)
docker compose up -d

# Stop
docker compose down

# Restart
docker compose restart
```

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db
```

### Database Operations
```bash
# Run migrations
docker compose exec backend npx prisma migrate deploy

# Create new migration
docker compose exec backend npx prisma migrate dev --name migration_name

# Seed database
docker compose exec backend npm run seed

# Open Prisma Studio
docker compose exec backend npx prisma studio
# Access at: http://localhost:5555

# Access database shell
docker compose exec db psql -U trash2cash -d trash2cash
```

### Container Shell Access
```bash
# Backend shell
docker compose exec backend sh

# Frontend shell
docker compose exec frontend sh

# Database shell
docker compose exec db psql -U trash2cash -d trash2cash
```

### Cleanup
```bash
# Stop and remove containers
docker compose down

# Remove everything including volumes (⚠️ deletes database!)
docker compose down -v

# Remove everything including images
docker compose down -v --rmi all
```

## Helper Script

Use the included helper script for easier management:

```bash
# Make executable (first time only)
chmod +x docker-dev.sh

# Start in background
./docker-dev.sh start-bg

# View logs
./docker-dev.sh logs

# Open backend shell
./docker-dev.sh shell backend

# Run migrations
./docker-dev.sh migrate

# Seed database
./docker-dev.sh seed

# Open Prisma Studio
./docker-dev.sh studio

# View all commands
./docker-dev.sh help
```

## Troubleshooting

### Port Already in Use
```bash
# Check what's using the port
sudo lsof -i :3000  # Frontend
sudo lsof -i :4000  # Backend
sudo lsof -i :5432  # Database

# Kill the process or change ports in docker-compose.yml
```

### Services Won't Start
```bash
# View logs to see the error
docker compose logs

# Try rebuilding
docker compose up --build

# Clean start
docker compose down -v
docker compose up --build
```

### Database Connection Failed
```bash
# Check if database is healthy
docker compose ps

# Wait a few seconds for database to initialize
# Then restart backend
docker compose restart backend
```

### Hot Reload Not Working
```bash
# Restart the service
docker compose restart backend
docker compose restart frontend
```

## Project Structure

```
Devthon/
├── docker-compose.yml       # Main configuration
├── docker-dev.sh           # Helper script
├── server/
│   ├── Dockerfile          # Backend container config
│   └── .dockerignore       # Excluded files
└── client/
    ├── Dockerfile          # Frontend container config
    └── .dockerignore       # Excluded files
```

## Environment Variables

Environment variables are configured in [`docker-compose.yml`](docker-compose.yml).

**Database Connection:**
- Uses external Supabase PostgreSQL database
- Connection strings are pre-configured in docker-compose.yml

**External Services:**
- Gemini AI and Redis credentials are already set
- You can override them by creating a `.env` file

## Default Credentials

**PostgreSQL (External Supabase):**
- Connection is pre-configured in docker-compose.yml
- See [`DATABASE_CONFIG.md`](DATABASE_CONFIG.md) for details

**JWT Secrets (Development):**
- Access: `dev_access_secret_change_in_production`
- Refresh: `dev_refresh_secret_change_in_production`

⚠️ **Change these in production!**

## Next Steps

- 📖 Read [`DOCKER_SETUP.md`](DOCKER_SETUP.md) for detailed documentation
- 🗄️ See [`DATABASE_CONFIG.md`](DATABASE_CONFIG.md) for database configuration
- 🏗️ See [`ARCHITECTURE.md`](ARCHITECTURE.md) for system architecture
- 📚 Check [`README.md`](README.md) for API reference

## Need Help?

```bash
# View service status
docker compose ps

# View all logs
docker compose logs -f

# Check Docker version
docker --version
docker compose version

# View helper script commands
./docker-dev.sh help
```

---

**Happy Coding! 🎉**
