# 🚀 AWS EC2 Deployment Guide — Trash2Treasure

## Architecture

```
                 ┌─────────┐
  Internet ──▶   │  Nginx  │ :80 / :443
                 └────┬────┘
            ┌─────────┴─────────┐
            ▼                   ▼
      /api/* routes       Everything else
            │                   │
    ┌───────▼───────┐   ┌──────▼──────┐
    │  NestJS API   │   │  Next.js UI │
    │   :4000       │   │   :3000     │
    └───────────────┘   └─────────────┘
            │
    ┌───────▼───────┐
    │   Supabase    │
    │  PostgreSQL   │
    └───────────────┘
```

---

## What was created

| File                           | Purpose                                                  |
| ------------------------------ | -------------------------------------------------------- |
| `.github/workflows/deploy.yml` | GitHub Actions CI/CD pipeline                            |
| `server/Dockerfile.prod`       | Multi-stage production Dockerfile for NestJS             |
| `client/Dockerfile.prod`       | Multi-stage production Dockerfile for Next.js            |
| `docker-compose.prod.yml`      | Production compose with Nginx reverse proxy              |
| `nginx/nginx.conf`             | Nginx config routing `/api/*` → backend, `/*` → frontend |
| `ec2-setup.sh`                 | One-time EC2 instance setup script                       |

---

## Step-by-Step: What YOU Need To Do

### 1️⃣ Launch an EC2 Instance

1. Go to **AWS Console → EC2 → Launch Instance**
2. Choose:
   - **AMI:** Ubuntu 22.04 or 24.04 LTS
   - **Instance type:** `t3.small` (minimum, `t3.medium` recommended)
   - **Storage:** 20 GB+ gp3
3. **Security Group** — open these ports:

   | Port | Protocol | Source    | Purpose |
   | ---- | -------- | --------- | ------- |
   | 22   | TCP      | Your IP   | SSH     |
   | 80   | TCP      | 0.0.0.0/0 | HTTP    |
   | 443  | TCP      | 0.0.0.0/0 | HTTPS   |

4. **Key Pair:** Create or select an existing `.pem` key pair. Download it.

### 2️⃣ SSH Into EC2 & Run Setup

```bash
# Make key readable
chmod 400 your-key.pem

# Connect
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>

# Upload & run the setup script (from your local machine, separate terminal)
scp -i your-key.pem ec2-setup.sh ubuntu@<EC2_PUBLIC_IP>:~/
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP> "sudo bash ~/ec2-setup.sh"
```

Then **log out and log back in** (so the `docker` group applies):

```bash
exit
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>
```

### 3️⃣ Create a Docker Hub Access Token

1. Go to [hub.docker.com](https://hub.docker.com) → Account Settings → Security
2. Click **New Access Token**
3. Name it `github-actions`, give it **Read/Write** access
4. Copy the token

### 4️⃣ Add GitHub Secrets

Go to your GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**

Add ALL of these secrets:

| Secret Name                    | Value                                                          |
| ------------------------------ | -------------------------------------------------------------- |
| `DOCKER_HUB_USERNAME`          | Your Docker Hub username (e.g. `anusan2003`)                   |
| `DOCKER_HUB_TOKEN`             | Docker Hub access token from Step 3                            |
| `EC2_HOST`                     | EC2 public IP or Elastic IP (e.g. `54.123.45.67`)              |
| `EC2_USER`                     | `ubuntu`                                                       |
| `EC2_SSH_KEY`                  | Paste the ENTIRE content of your `.pem` file                   |
| `DATABASE_URL`                 | Your Supabase/PostgreSQL connection string                     |
| `DIRECT_URL`                   | Your direct PostgreSQL connection string                       |
| `JWT_ACCESS_SECRET`            | Generate with `openssl rand -base64 32`                        |
| `JWT_REFRESH_SECRET`           | Generate with `openssl rand -base64 32`                        |
| `GEMINI_API_KEY`               | Your Gemini API key                                            |
| `CORS_ORIGIN`                  | `http://<EC2_PUBLIC_IP>` (or `https://yourdomain.com` later)   |
| `NEXT_PUBLIC_API_URL`          | `http://<EC2_PUBLIC_IP>/api` (or `https://yourdomain.com/api`) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Your Google OAuth client ID                                    |
| `NEXT_PUBLIC_SUPABASE_URL`     | Your Supabase project URL (`https://<project>.supabase.co`)    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase publishable/anon key                            |
| `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET` | Supabase bucket for avatars (e.g. `avatars`)            |
| `NEXT_PUBLIC_SUPABASE_BOOKINGS_BUCKET` | Supabase bucket for booking images (e.g. `bookings`)    |
| `GOOGLE_CLIENT_ID`             | Your Google OAuth client ID (server)                           |
| `GOOGLE_CLIENT_SECRET`         | Your Google OAuth client secret (server)                       |
| `GOOGLE_REDIRECT_URI`          | Your OAuth redirect URI for the auth-code flow (server)        |
| `TEXTLK_API_TOKEN`             | (optional) SMS gateway token                                   |
| `TEXTLK_SENDER_ID`             | (optional) SMS sender ID                                       |
| `VAPID_PUBLIC_KEY`             | Web Push VAPID public key                                      |
| `VAPID_PRIVATE_KEY`            | Web Push VAPID private key                                     |
| `VAPID_SUBJECT`                | Contact URI, e.g. `mailto:admin@yourdomain.com`               |

### 5️⃣ Push to Main → Automatic Deployment!

```bash
git add .
git commit -m "feat: add CI/CD pipeline for EC2 deployment"
git push origin main
```

GitHub Actions will:

1. ✅ Build production Docker images (multi-stage, optimized)
2. ✅ Push images to Docker Hub
3. ✅ SSH into your EC2
4. ✅ Write the `.env` file from GitHub Secrets
5. ✅ Pull new images & restart containers
6. ✅ Clean up old images

### 6️⃣ Verify It Works

```bash
# Check from your browser
http://<EC2_PUBLIC_IP>          # → Frontend
http://<EC2_PUBLIC_IP>/api      # → Backend API

# Or SSH in and check containers
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>
cd ~/trash2treasure
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f
```

---

## Optional: Custom Domain + HTTPS

### A) Point Domain to EC2

1. Get an **Elastic IP** (AWS Console → EC2 → Elastic IPs → Allocate)
2. Associate it with your EC2 instance
3. In your DNS provider, add an `A` record: `yourdomain.com → <ELASTIC_IP>`

### B) Get SSL Certificate

```bash
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>
cd ~/trash2treasure

# Make sure containers are running (Nginx needs to serve ACME challenge)
docker compose -f docker-compose.prod.yml up -d

# Get certificate
sudo certbot certonly --webroot -w /var/www/certbot -d yourdomain.com

# Uncomment the HTTPS server block in nginx/nginx.conf
# Replace "yourdomain.com" with your actual domain
# Then restart:
docker compose -f docker-compose.prod.yml restart nginx
```

### C) Auto-Renew SSL

```bash
# Add cron job
sudo crontab -e
# Add this line:
0 3 * * * certbot renew --quiet && docker restart trash2treasure-nginx-1
```

---

## Troubleshooting

```bash
# View logs
docker compose -f docker-compose.prod.yml logs backend
docker compose -f docker-compose.prod.yml logs frontend
docker compose -f docker-compose.prod.yml logs nginx

# Restart everything
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d

# Check GitHub Actions run
# Go to GitHub repo → Actions tab → see the latest run

# SSH into a container
docker compose -f docker-compose.prod.yml exec backend sh
```

## Cost Estimate (Monthly)

| Resource        | Spec             | Est. Cost          |
| --------------- | ---------------- | ------------------ |
| EC2 `t3.small`  | 2 vCPU, 2 GB RAM | ~$15/mo            |
| EC2 `t3.medium` | 2 vCPU, 4 GB RAM | ~$30/mo            |
| Elastic IP      | Static public IP | Free (if attached) |
| Storage         | 20 GB gp3        | ~$1.60/mo          |
| Data Transfer   | First 100 GB/mo  | Free tier          |

> 💡 **Tip:** Use a `t3.small` to start. If you need more RAM, upgrade to `t3.medium`.
