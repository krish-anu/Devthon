#!/usr/bin/env bash
# ============================================================
# EC2 First-Time Setup Script
# Run this ONCE on a fresh Ubuntu 22.04 / 24.04 EC2 instance
# Usage:  chmod +x ec2-setup.sh && sudo ./ec2-setup.sh
# ============================================================
set -euo pipefail

echo "──────────────────────────────────"
echo "  🚀 Trash2Cash EC2 Setup Script "
echo "──────────────────────────────────"

# ── 1. System updates ──
echo "📦 Updating system packages..."
apt-get update -y && apt-get upgrade -y

# ── 2. Install Docker ──
echo "🐳 Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    usermod -aG docker "$SUDO_USER" || usermod -aG docker ubuntu
    echo "✅ Docker installed"
else
    echo "✅ Docker already installed"
fi

# ── 3. Install Docker Compose plugin ──
echo "🔧 Installing Docker Compose plugin..."
if ! docker compose version &> /dev/null; then
    apt-get install -y docker-compose-plugin
    echo "✅ Docker Compose installed"
else
    echo "✅ Docker Compose already installed"
fi

# ── 4. Install Nginx (for Certbot webroot) ──
echo "📡 Certbot webroot directory..."
mkdir -p /var/www/certbot

# ── 5. Install Certbot (for HTTPS) ──
echo "🔐 Installing Certbot..."
if ! command -v certbot &> /dev/null; then
    apt-get install -y certbot
    echo "✅ Certbot installed"
else
    echo "✅ Certbot already installed"
fi

# ── 6. Create app directory ──
APP_DIR="/home/${SUDO_USER:-ubuntu}/trash2cash"
mkdir -p "$APP_DIR"
chown "${SUDO_USER:-ubuntu}":"${SUDO_USER:-ubuntu}" "$APP_DIR"
echo "✅ App directory: $APP_DIR"

# ── 7. Firewall (UFW) ──
echo "🔥 Configuring firewall..."
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw --force enable
echo "✅ Firewall configured (22, 80, 443)"

# ── 8. Swap file (useful for t2.micro / t3.micro) ──
if [ ! -f /swapfile ]; then
    echo "💾 Creating 2 GB swap file..."
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo "✅ Swap enabled"
else
    echo "✅ Swap already exists"
fi

echo ""
echo "══════════════════════════════════════════════"
echo "  ✅ EC2 SETUP COMPLETE!"
echo ""
echo "  Next steps:"
echo "  1. Log out & log back in (for docker group)"
echo "  2. cd ~/trash2cash"
echo "  3. Create .env file (or let CI/CD handle it)"
echo "  4. Push to 'main' branch → CI/CD deploys automatically"
echo "══════════════════════════════════════════════"
