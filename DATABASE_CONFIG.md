# 🗄️ Database Configuration

## Current Setup: External Supabase Database

This Docker setup is configured to use an **external Supabase PostgreSQL database** instead of a local containerized database.

### Connection Details

**Database URL (with connection pooling):**
```
postgresql://postgres.edlszchwwczuqyssacfb:Trash2Cash_D@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

**Direct URL (for migrations):**
```
postgresql://postgres.edlszchwwczuqyssacfb:Trash2Cash_D@aws-1-ap-south-1.pooler.supabase.com:5432/postgres
```

### Configuration Location

The database connection is configured in [`docker-compose.yml`](docker-compose.yml) under the `backend` service environment variables:

```yaml
environment:
  DATABASE_URL: postgresql://postgres.edlszchwwczuqyssacfb:Trash2Cash_D@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true
  DIRECT_URL: postgresql://postgres.edlszchwwczuqyssacfb:Trash2Cash_D@aws-1-ap-south-1.pooler.supabase.com:5432/postgres
```

## Why External Database?

✅ **Persistent Data**: Data persists even if Docker containers are removed  
✅ **Shared Access**: Multiple developers can access the same database  
✅ **Managed Service**: Supabase handles backups, scaling, and maintenance  
✅ **Production-like**: Development environment matches production setup  
✅ **No Local Resources**: Saves local disk space and memory  

## Local Database Option (Optional)

If you prefer to use a local PostgreSQL database for development, you can uncomment the `db` service in [`docker-compose.yml`](docker-compose.yml):

### Step 1: Uncomment the db service

```yaml
services:
  # Uncomment this entire section:
  db:
    image: postgres:16-alpine
    container_name: trash2cash-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: trash2cash
      POSTGRES_PASSWORD: trash2cash_dev_password
      POSTGRES_DB: trash2cash
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - trash2cash-network
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U trash2cash']
      interval: 10s
      timeout: 5s
      retries: 5
```

### Step 2: Update backend environment variables

Change the database URLs in the `backend` service:

```yaml
environment:
  DATABASE_URL: postgresql://trash2cash:trash2cash_dev_password@db:5432/trash2cash
  DIRECT_URL: postgresql://trash2cash:trash2cash_dev_password@db:5432/trash2cash
```

### Step 3: Add dependency

Add this to the `backend` service:

```yaml
depends_on:
  db:
    condition: service_healthy
```

### Step 4: Restart

```bash
docker compose down -v
docker compose up --build
```

## Database Operations

### Running Migrations

**Important:** Since the Supabase database is already set up with existing schema and data, migrations are **NOT run automatically** on container startup to avoid conflicts.

To run migrations manually (only if needed):

```bash
docker compose exec backend npx prisma migrate deploy
```

**Note:** If you get a "database schema is not empty" error (P3005), it means the database already has the schema. You can either:
1. Skip migrations (database is already up to date)
2. Baseline the existing database: `docker compose exec backend npx prisma migrate resolve --applied 20260128111921_init`

### Creating New Migrations

```bash
docker compose exec backend npx prisma migrate dev --name your_migration_name
```

### Seeding the Database

```bash
docker compose exec backend npm run seed
```

### Accessing Prisma Studio

```bash
docker compose exec backend npx prisma studio
```

Then open: http://localhost:5555

### Resetting the Database

⚠️ **Warning: This will delete all data!**

```bash
docker compose exec backend npx prisma migrate reset --force
```

## Connection Pooling

The Supabase connection uses **PgBouncer** for connection pooling:

- **Pooled Connection** (port 6543): Used for application queries
- **Direct Connection** (port 5432): Used for migrations and schema changes

This is why we have two different URLs:
- `DATABASE_URL`: Uses port 6543 with `?pgbouncer=true`
- `DIRECT_URL`: Uses port 5432 for direct access

## Security Notes

⚠️ **Database credentials are currently hardcoded in docker-compose.yml**

For production:
- Use Docker secrets or environment variables
- Rotate database passwords regularly
- Use SSL/TLS connections
- Implement IP whitelisting
- Use read-only replicas for reporting

## Troubleshooting

### Connection Timeout

If you get connection timeout errors:

1. Check your internet connection
2. Verify Supabase service is running
3. Check if your IP is whitelisted in Supabase settings
4. Try the direct URL instead of pooled URL

### Migration Errors

If migrations fail:

```bash
# Check database connection
docker compose exec backend npx prisma db pull

# View migration status
docker compose exec backend npx prisma migrate status

# Force reset (⚠️ deletes data)
docker compose exec backend npx prisma migrate reset --force
```

### SSL/TLS Errors

If you get SSL errors, you may need to add SSL parameters to the connection string:

```
?sslmode=require
```

## Switching Between Databases

### From External to Local

1. Uncomment `db` service in docker-compose.yml
2. Update `DATABASE_URL` and `DIRECT_URL` to use `db:5432`
3. Add `depends_on` for db service
4. Run: `docker compose down -v && docker compose up --build`

### From Local to External

1. Comment out `db` service in docker-compose.yml
2. Update `DATABASE_URL` and `DIRECT_URL` to Supabase URLs
3. Remove `depends_on` for db service
4. Run: `docker compose down && docker compose up --build`

## Environment Variables Reference

| Variable | Purpose | Current Value |
|----------|---------|---------------|
| `DATABASE_URL` | Application queries (pooled) | Supabase pooler (port 6543) |
| `DIRECT_URL` | Migrations and schema changes | Supabase direct (port 5432) |

Both are configured in [`docker-compose.yml`](docker-compose.yml) under the `backend` service.

---

**Current Configuration**: Using external Supabase database  
**Local Database**: Commented out (optional)  
**Connection Pooling**: Enabled via PgBouncer
