# WarehouseApp - VPS Deployment Guide

This guide will help you deploy the WarehouseApp on a fresh cloud VPS (DigitalOcean, Linode, AWS EC2, etc.).

## Quick Start

On your **fresh VPS**, run these commands:

```bash
# Clone the repository
git clone <your-repo-url> warehouseapp
cd warehouseapp

# Run the setup script
sudo bash setup-vps.sh
```

That's it! The script will automatically:
- ✅ Detect your Linux distribution (Ubuntu, Debian, Fedora, RHEL, CentOS)
- ✅ Install Docker and Docker Compose if not present
- ✅ Generate SSL certificates for HTTPS
- ✅ Create a secure `.env` file with random session secret
- ✅ Create necessary directories (data, backups, certs)
- ✅ Build and start the Docker containers
- ✅ Verify the application is running and healthy

## Requirements

- **Fresh Linux VPS** (Ubuntu 20.04+, Debian 11+, Fedora, RHEL, or CentOS)
- **2GB RAM minimum** (recommended: 4GB)
- **10GB disk space minimum**
- **Non-root user with sudo privileges**

## After Setup

### Access Your Application

The app will be running at:
- **Local**: `https://localhost:3001`
- **Public**: `https://your-vps-ip:3001`

⚠️ **Note**: You'll see a security warning because the SSL certificate is self-signed. This is normal for testing.

### Configure Firewall

Allow incoming traffic on port 3001:

**Ubuntu/Debian:**
```bash
sudo ufw allow 3001/tcp
sudo ufw enable
```

**RHEL/CentOS/Fedora:**
```bash
sudo firewall-cmd --permanent --add-port=3001/tcp
sudo firewall-cmd --reload
```

### Production SSL Certificates (Optional)

For production use with a domain name, replace self-signed certificates with Let's Encrypt:

```bash
# Install certbot
sudo apt install certbot  # Ubuntu/Debian
# OR
sudo dnf install certbot  # Fedora/RHEL

# Get certificate (replace your-domain.com)
sudo certbot certonly --standalone -d your-domain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem certs/server.crt
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem certs/server.key
sudo chown $USER:$USER certs/server.*

# Restart the app
docker compose restart
```

## Managing the Application

### View Logs
```bash
docker logs -f warehouseapp
```

### Stop Application
```bash
docker compose down
```

### Start Application
```bash
docker compose up -d
```

### Restart Application
```bash
docker compose restart
```

### Rebuild After Code Changes
```bash
git pull
docker compose up -d --build
```

### Check Status
```bash
docker compose ps
```

### Backup Database
The database is automatically stored in `./data/` directory. To backup:
```bash
# Create manual backup
cp -r data/ backups/manual-backup-$(date +%Y%m%d-%H%M%S)/
```

## Troubleshooting

### Script says "Please log out and log back in"
This happens after Docker installation. Either:
1. Log out and log back in, then run `./setup-vps.sh` again
2. Or run: `newgrp docker && ./setup-vps.sh`

### Container fails to start
Check logs:
```bash
docker logs warehouseapp
```

### Port 3001 already in use
```bash
# Find what's using the port
sudo lsof -i :3001

# Stop the application first
docker compose down
```

### Permission denied errors
Make sure directories have correct permissions:
```bash
chmod 755 data backups certs
chmod 600 .env certs/server.key
chmod 644 certs/server.crt
```

## Environment Variables

The script automatically creates a `.env` file with:
- `NODE_ENV=production`
- `PORT=3001`
- `SESSION_SECRET=<random-secure-value>`

You can modify these in the `.env` file if needed, then restart:
```bash
docker compose restart
```

## Updating the Application

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker compose up -d --build
```

## Uninstalling

```bash
# Stop and remove containers
docker compose down

# Remove data (optional - this deletes your database!)
# rm -rf data/ backups/

# Remove Docker images (optional)
docker image prune -a
```

## Support

For issues or questions, check the main README.md or application logs.
