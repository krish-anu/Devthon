#!/bin/bash
set -e

echo "=========================================="
echo "   🚀 ULTIMATE DEVELOPER SETUP (FIXED)   "
echo "=========================================="

# -------------------- 0. EMERGENCY REPAIR --------------------
# This clears the conflicting VS Code files and keys that caused your errors
echo "Step 0: Cleaning up repository conflicts..."
sudo rm -f /etc/apt/sources.list.d/vscode.list
sudo rm -f /etc/apt/sources.list.d/vscode.sources
sudo rm -f /etc/apt/sources.list.d/microsoft-prod.list
sudo rm -f /etc/apt/keyrings/vscode.gpg
sudo rm -f /usr/share/keyrings/microsoft.gpg

# -------------------- 1. SYSTEM UPDATE --------------------
echo "Step 1: Updating system packages..."
# 'dist-upgrade' handles the '17 not upgraded' packages by resolving dependency changes
sudo apt update -y && sudo apt dist-upgrade -y

echo "Installing base dependencies..."
sudo apt install -y \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  git \
  build-essential \
  unzip \
  zip \
  jq \
  tree \
  htop \
  software-properties-common

# -------------------- 2. DOCKER --------------------
echo "Step 2: Setting up Docker..."
sudo install -m 0755 -d /etc/apt/keyrings
sudo rm -f /etc/apt/keyrings/docker.gpg
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update -y
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker "$USER"

# -------------------- 3. VS CODE --------------------
echo "Step 3: Installing VS Code (Clean Install)..."
curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor | sudo tee /usr/share/keyrings/microsoft.gpg > /dev/null
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/microsoft.gpg] https://packages.microsoft.com/repos/code stable main" | \
sudo tee /etc/apt/sources.list.d/vscode.list

sudo apt update -y
sudo apt install -y code

# -------------------- 4. LANGUAGES & TOOLS --------------------
echo "Step 4: Installing Python, Java, and PostgreSQL Client..."
sudo apt install -y python3 python3-pip python3-venv openjdk-17-jdk postgresql-client

# -------------------- 5. NVM + NODE.JS --------------------
echo "Step 5: Installing NVM & Node.js..."
export NVM_DIR="$HOME/.nvm"
if [ ! -d "$NVM_DIR" ]; then
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi

# Load NVM into the current script session
source "$NVM_DIR/nvm.sh"
nvm install 20
nvm use 20
nvm alias default 20
npm install -g yarn pnpm

# -------------------- 6. GOOGLE CHROME --------------------
echo "Step 6: Installing Google Chrome..."
sudo rm -f /etc/apt/sources.list.d/google-chrome.list
curl -fsSL https://dl.google.com/linux/linux_signing_key.pub | sudo gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" | \
sudo tee /etc/apt/sources.list.d/google-chrome.list
sudo apt update -y && sudo apt install -y google-chrome-stable

# -------------------- 7. NGINX & ZSH --------------------
echo "Step 7: Installing Nginx and Zsh..."
sudo apt install -y nginx zsh
sudo systemctl enable nginx
sudo systemctl start nginx

# -------------------- FINISH --------------------
echo "----------------------------------"
echo " ✅ INSTALLATION COMPLETE!"
echo "----------------------------------"
echo "Versions installed:"
docker --version
node -v
python3 --version
java -version 2>&1 | head -n 1
code --version | head -n 1
echo "----------------------------------"
echo "IMPORTANT NEXT STEPS:"
echo "1. Run: newgrp docker (to use docker without sudo)"
echo "2. Run: chsh -s \$(which zsh) (to switch to Zsh if it didn't prompt)"
echo "3. Log out and log back in to apply all changes."
echo "=================================="
