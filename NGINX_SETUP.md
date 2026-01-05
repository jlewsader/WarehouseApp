# Nginx Reverse Proxy Setup

This setup allows the WarehouseApp to run behind nginx with flexible deployment options.

## Architecture

- **App Container**: Runs on HTTP (port 3001) - no SSL certificates needed
- **Nginx Container**: Handles SSL/TLS termination and proxies to app
- **Certificates**: Managed outside the app container (more secure)

## Deployment Modes

### 1. Tailscale Funnel (Testing/Demo)

Use this for public testing without managing certificates.

```bash
# Use Tailscale-optimized config
cp nginx-tailscale.conf nginx.conf

# Update docker-compose to use nginx version
docker compose -f docker-compose.nginx.yml up -d

# Enable Tailscale Funnel on your host
tailscale funnel 80
```

**How it works:**
- Tailscale Funnel → nginx (HTTP:80) → app (HTTP:3001)
- Tailscale handles HTTPS with valid certificates
- nginx adds security headers and proxying

### 2. Production with Let's Encrypt

Use this for production deployment with automatic SSL certificates.

```bash
# Use production config (already set as default)
# nginx.conf is already configured for HTTPS

# Install certbot
mkdir -p certbot/www

# Get Let's Encrypt certificate (replace yourdomain.com)
docker run -it --rm \
  -v ./certbot/www:/var/www/certbot \
  -v ./certbot/conf:/etc/letsencrypt \
  certbot/certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  -d yourdomain.com

# Link certificates to certs directory
ln -s ./certbot/conf/live/yourdomain.com/fullchain.pem ./certs/cert.pem
ln -s ./certbot/conf/live/yourdomain.com/privkey.pem ./certs/key.pem

# Start with nginx
docker compose -f docker-compose.nginx.yml up -d
```

### 3. Production with Custom Certificates

If you have your own SSL certificates:

```bash
# Copy your certificates to certs/
cp your-cert.pem ./certs/cert.pem
cp your-key.pem ./certs/key.pem

# Make sure they're readable
chmod 644 ./certs/cert.pem
chmod 600 ./certs/key.pem

# Start with nginx
docker compose -f docker-compose.nginx.yml up -d
```

### 4. Development/Local (Without nginx)

Use the original setup if you want to test locally:

```bash
# Use original docker-compose
docker compose up -d

# Access at http://localhost:3001
```

## Switching Between Modes

### From Tailscale to Production:

```bash
# Stop current setup
docker compose -f docker-compose.nginx.yml down

# Switch nginx config
cp nginx.conf.backup nginx.conf  # or manually edit

# Add your production certificates
# (see Production modes above)

# Update DNS to point to your server

# Restart
docker compose -f docker-compose.nginx.yml up -d
```

### From Production to Tailscale:

```bash
docker compose -f docker-compose.nginx.yml down
cp nginx-tailscale.conf nginx.conf
docker compose -f docker-compose.nginx.yml up -d
tailscale funnel 80
```

## Configuration Files

- `nginx.conf` - Production config with HTTPS (default)
- `nginx-tailscale.conf` - Tailscale Funnel optimized (HTTP only)
- `docker-compose.nginx.yml` - Docker setup with nginx
- `docker-compose.yml` - Original setup without nginx

## Security Notes

1. **No certificates in app container** - All SSL/TLS handled by nginx
2. **Proxy headers** - App trusts X-Forwarded-* headers from nginx
3. **Secure cookies** - Automatically enabled when BEHIND_PROXY=true
4. **Network isolation** - App container not directly exposed, only via nginx

## Troubleshooting

### Check logs:
```bash
docker compose -f docker-compose.nginx.yml logs -f nginx
docker compose -f docker-compose.nginx.yml logs -f warehouseapp
```

### Test nginx config:
```bash
docker exec warehouseapp-nginx nginx -t
```

### Reload nginx after config change:
```bash
docker exec warehouseapp-nginx nginx -s reload
```

### Check if app is accessible from nginx:
```bash
docker exec warehouseapp-nginx wget -qO- http://warehouseapp:3001/health
```
