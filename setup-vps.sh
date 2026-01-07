#!/bin/bash
set -e

# WarehouseApp VPS Setup Script
# This script installs all dependencies and starts the application on a fresh Linux VPS
# Usage: ./setup-vps.sh

echo "========================================="
echo "WarehouseApp VPS Setup"
echo "========================================="

# Check if running with sudo/root privileges
if [ "$EUID" -ne 0 ]; then
  echo "⚠️  This script requires root privileges"
  echo "Please run with: sudo bash setup-vps.sh"
  exit 1
fi

echo "✅ Running with root privileges"

# Detect Linux distribution
if [ -f /etc/os-release ]; then
  . /etc/os-release
  OS=$ID
else
  echo "❌ Cannot detect Linux distribution"
  exit 1
fi

echo "📋 Detected OS: $OS"

# Function to install Docker on Debian/Ubuntu
install_docker_debian() {
  echo "📦 Installing Docker on Debian/Ubuntu..."

  # Update package index
  apt-get update

  # Install prerequisites
  apt-get install -y ca-certificates curl gnupg lsb-release

  # Add Docker's official GPG key
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/$OS/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  # Set up the repository
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list >/dev/null

  # Install Docker
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

  echo "✅ Docker installed successfully"
}

# Function to install Docker on RHEL/CentOS/Fedora
install_docker_rhel() {
  echo "📦 Installing Docker on RHEL/CentOS/Fedora..."

  # Remove old versions
  dnf remove -y docker docker-client docker-client-latest docker-common docker-latest \
    docker-latest-logrotate docker-logrotate docker-engine 2>/dev/null || true

  # Install prerequisites
  dnf install -y dnf-plugins-core

  # Add Docker repository
  dnf config-manager --add-repo https://download.docker.com/linux/$OS/docker-ce.repo

  # Install Docker
  dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

  # Start and enable Docker
  systemctl start docker
  systemctl enable docker

  echo "✅ Docker installed successfully"
}

# Check if Docker is installed
if ! command -v docker &>/dev/null; then
  echo "🔍 Docker not found. Installing..."

  case $OS in
  ubuntu | debian)
    install_docker_debian
    ;;
  fedora | rhel | centos)
    install_docker_rhel
    ;;
  *)
    echo "❌ Unsupported OS: $OS"
    echo "Please install Docker manually: https://docs.docker.com/engine/install/"
    exit 1
    ;;
  esac

  echo ""
  echo "✅ Docker installation complete"
else
  echo "✅ Docker is already installed"
fi

# Check if docker-compose plugin is available
if ! docker compose version &>/dev/null; then
  echo "❌ Docker Compose plugin not found"
  echo "Please install it: https://docs.docker.com/compose/install/"
  exit 1
fi

echo "✅ Docker Compose is available"

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p data backups certs

# Generate SSL certificates for HTTPS (self-signed for testing)
if [ ! -f certs/server.key ] || [ ! -f certs/server.crt ]; then
  echo "🔐 Generating self-signed SSL certificates..."
  openssl req -x509 -newkey rsa:4096 -keyout certs/server.key -out certs/server.crt \
    -days 365 -nodes -subj "/CN=localhost" 2>/dev/null || {
    # If OpenSSL is not installed
    echo "⚠️  OpenSSL not found. Installing..."
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
      apt-get install -y openssl
    else
      dnf install -y openssl
    fi
    openssl req -x509 -newkey rsa:4096 -keyout certs/server.key -out certs/server.crt \
      -days 365 -nodes -subj "/CN=localhost"
  }
  echo "✅ SSL certificates generated"
else
  echo "✅ SSL certificates already exist"
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
  echo "⚙️  Creating .env file..."

  # Generate random session secret
  SESSION_SECRET=$(openssl rand -hex 32)

  cat >.env <<EOF
NODE_ENV=production
PORT=3001
SESSION_SECRET=${SESSION_SECRET}
EOF

  echo "✅ .env file created with secure session secret"
else
  echo "✅ .env file already exists"

  # Check if SESSION_SECRET needs updating
  if grep -q "your-secure-random-secret-here-change-this" .env 2>/dev/null; then
    echo "⚠️  Updating default SESSION_SECRET..."
    SESSION_SECRET=$(openssl rand -hex 32)
    sed -i "s/SESSION_SECRET=.*/SESSION_SECRET=${SESSION_SECRET}/" .env
    echo "✅ SESSION_SECRET updated"
  fi
fi

# Set proper permissions
chmod 600 .env
chmod 644 certs/server.crt
chmod 600 certs/server.key

echo ""
echo "========================================="
echo "🚀 Starting Application"
echo "========================================="

# Stop and remove existing containers
if docker ps -a --format '{{.Names}}' | grep -q warehouseapp; then
  echo "🛑 Stopping existing containers..."
  docker compose down
fi

echo "🚀 Starting containers..."
docker compose -f docker-compose.nginx.yml up -d

echo ""
echo "⏳ Waiting for application to be healthy..."
sleep 5

# Check container status
if docker ps --filter "name=warehouseapp" --filter "status=running" | grep -q warehouseapp; then
  echo "✅ Container is running"

  # Wait for healthcheck
  for i in {1..30}; do
    if docker inspect warehouseapp | grep -q '"Status": "running"' 2>/dev/null; then
      echo "✅ Application is running!"
      break
    fi
    echo "⏳ Waiting on application to start... ($i/30)"
    sleep 2
  done
else
  echo "❌ Container failed to start"
  echo "Logs:"
  docker logs warehouseapp
  exit 1
fi

echo ""
echo "========================================="
echo "✅ Setup Complete!"
echo "========================================="
echo ""
echo "📊 Application Status:"
docker ps --filter "name=warehouseapp"
echo ""
echo "🌐 Application is running at:"
echo "   https://localhost:3001"
echo "   (Self-signed certificate - accept security warning in browser)"
echo ""
echo "📝 Useful commands:"
echo "   View logs:      docker logs -f warehouseapp"
echo "   Stop app:       docker compose down"
echo "   Restart app:    docker compose restart"
echo "   View status:    docker compose ps"
echo "   Rebuild:        docker compose up -d --build"
echo ""
echo "📁 Data locations:"
echo "   Database:       ./data/"
echo "   Backups:        ./backups/"
echo "   SSL Certs:      ./certs/"
echo ""
