# 🔑 Environment Variables Quick Reference

## Quick Commands

```bash
# Setup (first time)
cp .env.example .env

# Verify .env exists
ls -la .env

# Check if .env is ignored by Git (should see nothing)
git status | grep .env

# Start with environment variables
docker compose up --build

# Restart after changing .env
docker compose down && docker compose up --build
```

## File Locations

| File                 | Purpose                    | Tracked by Git? |
| -------------------- | -------------------------- | --------------- |
| `.env`               | Your actual credentials    | ❌ NO (ignored) |
| `.env.example`       | Template/reference         | ✅ YES          |
| `docker-compose.yml` | Uses variables from `.env` | ✅ YES          |
| `.gitignore`         | Ignores `.env`             | ✅ YES          |

## Environment Variables Reference

### Required Variables (Must be set)

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:port/db?pgbouncer=true
DIRECT_URL=postgresql://user:pass@host:port/db

# JWT Secrets
JWT_ACCESS_SECRET=your_secret_here
JWT_REFRESH_SECRET=your_secret_here

# External APIs
GEMINI_API_KEY=your_key_here

```

### Optional Variables (Have defaults)

```bash
# Application
PORT=4000                              # Default: 4000
NODE_ENV=development                   # Default: development
CORS_ORIGIN=http://localhost:3000      # Default: http://localhost:3000

# JWT Expiration
JWT_ACCESS_EXPIRES=15m                 # Default: 15m
JWT_REFRESH_EXPIRES=7d                 # Default: 7d

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:4000/api  # Default: http://localhost:4000/api
```

## Common Issues & Solutions

### Issue: Docker Compose can't find variables

```bash
# Solution: Ensure .env is in the same directory as docker-compose.yml
ls -la .env docker-compose.yml
```

### Issue: Changes to .env not taking effect

```bash
# Solution: Restart containers
docker compose down
docker compose up --build
```

### Issue: Variables showing as empty

```bash
# Solution: Check .env file syntax (no spaces around =)
# ✅ Correct:
DATABASE_URL=postgresql://...

# ❌ Wrong:
DATABASE_URL = postgresql://...
```

### Issue: .env file showing in git status

```bash
# Solution: Ensure .gitignore includes .env
echo ".env" >> .gitignore
git rm --cached .env  # Remove from Git if already tracked
```

## Security Checklist

- [ ] `.env` file exists and contains all required variables
- [ ] `.env` is NOT tracked by Git (`git status` should not show it)
- [ ] `.env.example` is tracked by Git (template for others)
- [ ] Production uses different credentials than development
- [ ] JWT secrets are strong and unique (not the defaults)
- [ ] API keys are valid and not expired

## Generate Strong Secrets

```bash
# Generate a random secret (use for JWT secrets)
openssl rand -base64 32

# Generate multiple secrets
for i in {1..3}; do openssl rand -base64 32; done
```

## Environment-Specific Setup

### Development

```bash
# Use .env for local development
cp .env.example .env
# Edit with development credentials
```

### Production

```bash
# Use your hosting platform's environment variable management
# Examples:
# - Heroku: heroku config:set KEY=value
# - Vercel: Project Settings > Environment Variables
# - AWS: Use Secrets Manager or Parameter Store
# - Docker: Use docker-compose.prod.yml with env_file
```

## Docker Compose Syntax

```yaml
# In docker-compose.yml:

# Required variable (no default)
DATABASE_URL: ${DATABASE_URL}

# Optional variable with default
PORT: ${PORT:-4000}

# Multiple variables
environment:
  VAR1: ${VAR1}
  VAR2: ${VAR2:-default_value}
```

## Testing Your Setup

```bash
# 1. Verify .env exists
test -f .env && echo "✓ .env exists" || echo "✗ .env missing"

# 2. Verify .env is ignored
git check-ignore .env && echo "✓ .env ignored" || echo "✗ .env NOT ignored"

# 3. Test Docker Compose can read variables
docker compose config | grep -i "database_url"

# 4. Start services
docker compose up --build
```

## Need More Help?

- 📖 [SECURITY_SETUP.md](SECURITY_SETUP.md) - Comprehensive security guide
- 🚀 [DOCKER_QUICK_START.md](DOCKER_QUICK_START.md) - Quick start guide
- 📋 [SECURITY_MIGRATION_SUMMARY.md](SECURITY_MIGRATION_SUMMARY.md) - What changed and why
- 📝 [.env.example](.env.example) - Template with all variables
