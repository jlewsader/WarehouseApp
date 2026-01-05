# WarehouseApp Deployment Guide

Complete deployment guide for running WarehouseApp with nginx reverse proxy.

## 📋 Table of Contents

- [Local Development](#local-development)
- [Production Deployment](#production-deployment)
- [Configuration](#configuration)
- [Maintenance](#maintenance)
- [Troubleshooting](#troubleshooting)

---

## Local Development

### Quick Start

```bash
# Start the application
docker compose -f docker-compose.nginx.yml up -d

# View logs
docker compose -f docker-compose.nginx.yml logs -f

# Stop everything
docker compose -f docker-compose.nginx.yml down
```

### Access URLs

- **HTTPS**: https://localhost:8443
- **HTTP**: http://localhost:8080 (redirects to HTTPS)
- **Health Check**: https://localhost:8443/health

### Architecture

```
Browser → nginx (HTTPS:8443) → warehouseapp (HTTP:3001)
        ↳ nginx (HTTP:8080) redirects to HTTPS
```

**Local Development Setup:**
- nginx terminates SSL using mkcert certificates
- App runs on HTTP internally (port 3001)
- nginx adds security headers and proxies requests
- App container not directly exposed to host

### SSL Certificates for Development

The app uses mkcert certificates in `./certs/`:
- `localhost+3.pem` (certificate)
- `localhost+3-key.pem` (private key)

Valid for: localhost, 127.0.0.1, ::1

**To regenerate certificates:**
```bash
# Install mkcert (if not already installed)
# macOS: brew install mkcert
# Linux: See https://github.com/FiloSottile/mkcert

# Install local CA
mkcert -install

# Generate new certificates
cd certs
mkcert localhost 127.0.0.1 ::1
```

---

## Production Deployment

### Prerequisites

1. Server with Docker and Docker Compose installed
2. Domain name pointing to your server
3. SSL certificate (Let's Encrypt recommended)
4. Ports 80 and 443 available

### Production Configuration

**1. Set up SSL certificates**

Option A: Let's Encrypt (recommended)
```bash
# Install certbot
sudo apt-get install certbot

# Get certificate
sudo certbot certonly --standalone -d yourdomain.com

# Copy certificates to app directory
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./certs/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./certs/key.pem
sudo chown $(whoami):$(whoami) ./certs/*.pem
```

Option B: Custom certificates
```bash
# Copy your certificates to ./certs/
cp your-cert.pem ./certs/cert.pem
cp your-key.pem ./certs/key.pem
```

**2. Configure nginx**

```bash
# Use production nginx config
cp nginx.conf nginx-current.conf

# Edit server_name in nginx-current.conf
# Replace "server_name _;" with "server_name yourdomain.com;"
```

**3. Update docker-compose ports**

Edit `docker-compose.nginx.yml` to use standard ports:
```yaml
nginx:
  ports:
    - "80:80"    # HTTP
    - "443:443"  # HTTPS
```

**4. Set environment variables**

```bash
# Create/edit .env file
echo "SESSION_SECRET=$(openssl rand -base64 32)" > .env
echo "NODE_ENV=production" >> .env
```

**5. Deploy**

```bash
# Pull latest code
git pull

# Build and start containers
docker compose -f docker-compose.nginx.yml up -d --build

# Verify deployment
docker compose -f docker-compose.nginx.yml ps
curl https://yourdomain.com/health
```

### Certificate Renewal (Let's Encrypt)

Set up automatic renewal:
```bash
# Test renewal
sudo certbot renew --dry-run

# Add cron job for auto-renewal (runs daily)
echo "0 0 * * * certbot renew --post-hook 'cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem /path/to/app/certs/cert.pem && cp /etc/letsencrypt/live/yourdomain.com/privkey.pem /path/to/app/certs/key.pem && docker compose -f /path/to/app/docker-compose.nginx.yml restart nginx'" | sudo crontab -
```

---

## Configuration

### Configuration Files

- **docker-compose.nginx.yml** - Docker orchestration
- **nginx-current.conf** - Active nginx configuration
- **nginx-local-dev.conf** - Template for local development
- **nginx.conf** - Template for production
- **.env** - Environment variables

### Nginx Configuration

**Local Development (`nginx-local-dev.conf`):**
- Uses mkcert localhost certificates
- Listens on ports 80 and 443
- Server name: localhost, 127.0.0.1

**Production (`nginx.conf`):**
- Uses custom SSL certificates (cert.pem, key.pem)
- Includes Let's Encrypt ACME challenge support
- Server name: _ (wildcard, should be changed to your domain)

**To switch configurations:**
```bash
# Use local dev config
cp nginx-local-dev.conf nginx-current.conf

# Use production config
cp nginx.conf nginx-current.conf

# Apply changes
docker compose -f docker-compose.nginx.yml restart nginx
```

### Environment Variables

Required in `.env`:
```
SESSION_SECRET=<random-secret-key>
NODE_ENV=production
```

Optional:
```
PORT=3001  # App internal port (default: 3001)
```

### Container Configuration

**warehouseapp container:**
- Runs Node.js app on HTTP port 3001
- Not exposed to host (internal only)
- Environment: `BEHIND_PROXY=true` (enables secure cookies)
- Resource limits: 512MB RAM, 1 CPU

**nginx container:**
- nginx:alpine image
- Terminates SSL/TLS
- Proxies requests to app
- Adds security headers

---

## Maintenance

### Common Operations

**View logs:**
```bash
# All services
docker compose -f docker-compose.nginx.yml logs -f

# Specific service
docker compose -f docker-compose.nginx.yml logs -f nginx
docker compose -f docker-compose.nginx.yml logs -f warehouseapp
```

**Restart services:**
```bash
# Restart nginx only
docker compose -f docker-compose.nginx.yml restart nginx

# Restart app only
docker compose -f docker-compose.nginx.yml restart warehouseapp

# Restart all
docker compose -f docker-compose.nginx.yml restart
```

**Update application:**
```bash
# Pull latest code
git pull

# Rebuild and restart
docker compose -f docker-compose.nginx.yml up -d --build

# Or rebuild specific service
docker compose -f docker-compose.nginx.yml build warehouseapp
docker compose -f docker-compose.nginx.yml up -d warehouseapp
```

**Update nginx config:**
```bash
# Edit config
nano nginx-current.conf

# Test config syntax
docker compose -f docker-compose.nginx.yml exec nginx nginx -t

# Apply changes
docker compose -f docker-compose.nginx.yml restart nginx
```

### Data Persistence

Data persists in host directories (mounted as volumes):
- `./data/warehouse.db` - SQLite database
- `./backups/` - Database backups
- `.env` - Environment variables

These survive container restarts and rebuilds.

### Backup Strategy

**Automated backups** are configured in the app (see BACKUP_QUICKSTART.md):
- Automatic daily backups at 2 AM
- Backups stored in `./backups/`
- Retention: 7 daily, 4 weekly backups

**Manual backup:**
```bash
# Backup database
docker compose -f docker-compose.nginx.yml exec warehouseapp node -e "require('./src/services/backupService').createBackup()"

# Or copy database directly
cp ./data/warehouse.db ./backups/manual-backup-$(date +%Y%m%d).db
```

### Updates and Security

**Keep Docker images updated:**
```bash
# Pull latest nginx image
docker pull nginx:alpine

# Rebuild app with latest base image
docker compose -f docker-compose.nginx.yml build --no-cache warehouseapp

# Restart with new images
docker compose -f docker-compose.nginx.yml up -d
```

**Monitor security:**
- Subscribe to security advisories for Node.js and nginx
- Keep SSL certificates valid
- Review nginx access logs regularly

---

## Troubleshooting

### HTTPS Not Working

```bash
# Check nginx is running
docker compose -f docker-compose.nginx.yml ps

# Check nginx config
docker compose -f docker-compose.nginx.yml exec nginx nginx -t

# Check ports are listening
docker compose -f docker-compose.nginx.yml exec nginx netstat -tlnp

# Restart nginx
docker compose -f docker-compose.nginx.yml restart nginx
```

### App Not Responding

```bash
# Check app health
curl -k https://localhost:8443/health

# Check app container logs
docker compose -f docker-compose.nginx.yml logs warehouseapp

# Check app is running
docker compose -f docker-compose.nginx.yml exec warehouseapp wget -q -O- http://localhost:3001/health
```

### Certificate Issues

```bash
# Verify certificate files exist
ls -l ./certs/

# For local dev: Check mkcert CA is installed
mkcert -CAROOT

# For production: Check certificate validity
openssl x509 -in ./certs/cert.pem -text -noout | grep -E 'Not (Before|After)'

# Check nginx can read certificates
docker compose -f docker-compose.nginx.yml exec nginx ls -l /etc/nginx/ssl/
```

### Database Issues

```bash
# Check database file exists
ls -l ./data/warehouse.db

# Check permissions
ls -ld ./data

# Restore from backup
cp ./backups/latest-backup.db ./data/warehouse.db
docker compose -f docker-compose.nginx.yml restart warehouseapp
```

### Port Conflicts

```bash
# Check what's using ports 8080/8443 (or 80/443)
sudo netstat -tlnp | grep -E ':(80|443|8080|8443)'

# Stop conflicting services or change ports in docker-compose.nginx.yml
```

### View All Container Details

```bash
# Service status
docker compose -f docker-compose.nginx.yml ps

# Resource usage
docker stats warehouseapp warehouseapp-nginx

# Inspect network
docker network inspect warehouseapp_warehouse-network

# Shell access
docker compose -f docker-compose.nginx.yml exec warehouseapp sh
docker compose -f docker-compose.nginx.yml exec nginx sh
```

---

## Default Credentials

**⚠️ IMPORTANT - Change these immediately!**

- **Username**: admin
- **Password**: admin123

Change the admin password after first login through the admin interface.

---

## Security Checklist

- [ ] Change default admin password
- [ ] Generate strong SESSION_SECRET
- [ ] Use valid SSL certificates
- [ ] Configure firewall (allow only 80, 443)
- [ ] Keep Docker images updated
- [ ] Monitor logs regularly
- [ ] Set up automated backups
- [ ] Review nginx access logs
- [ ] Enable HTTPS redirect (enabled by default)
- [ ] Verify security headers are set (X-Frame-Options, etc.)
