# WarehouseApp Nginx Deployment

## ✅ Successfully Configured

Your app is now running with nginx as a reverse proxy. This is production-ready and Tailscale-compatible!

### Current Setup

```
Internet/Tailscale → nginx (port 8080/8443) → app (port 3001)
```

- **App**: Runs on HTTP internally (no certs in container - more secure)
- **Nginx**: Handles proxy, headers, and can terminate SSL
- **Network**: Containers communicate via internal network

### Access Points

- **HTTP**: http://localhost:8080
- **Health Check**: http://localhost:8080/health

### For Tailscale Funnel Testing

```bash
# Start Tailscale Funnel pointing to nginx
tailscale funnel 8080

# Your app will be available at:
# https://[your-machine].ts.net
```

Tailscale will:
- Provide HTTPS with valid certificates
- Proxy to nginx on port 8080
- nginx forwards to app on port 3001

### For Production Deployment

When ready for production:

1. **Switch to production nginx config**:
   ```bash
   cp nginx.conf nginx-current.conf
   docker compose -f docker-compose.nginx.yml restart nginx
   ```

2. **Get Let's Encrypt certificates**:
   ```bash
   # Install certbot and get certs
   # See NGINX_SETUP.md for details
   ```

3. **Use privileged ports** (requires root/sudo Docker):
   ```yaml
   # In docker-compose.nginx.yml, change ports to:
   ports:
     - "80:80"
     - "443:443"
   ```

### Key Files

- `docker-compose.nginx.yml` - Main docker compose for nginx setup
- `nginx-current.conf` - Active nginx configuration  
- `nginx-tailscale.conf` - HTTP-only config for Tailscale Funnel
- `nginx.conf` - Production config with HTTPS
- `NGINX_SETUP.md` - Detailed setup instructions

### Management Commands

```bash
# Start services
docker compose -f docker-compose.nginx.yml up -d

# Stop services
docker compose -f docker-compose.nginx.yml down

# View logs
docker compose -f docker-compose.nginx.yml logs -f

# Restart after config changes
docker compose -f docker-compose.nginx.yml restart nginx

# Check status
docker compose -f docker-compose.nginx.yml ps
```

### Security Benefits

✅ No SSL certificates in app container  
✅ App not directly exposed (only via nginx)  
✅ Secure cookies enabled when behind proxy  
✅ Proxy headers properly configured  
✅ Separate network for containers  

### Next Steps

1. Test with Tailscale Funnel: `tailscale funnel 8080`
2. Share the public URL for testing
3. When ready for production, follow production deployment steps in NGINX_SETUP.md

