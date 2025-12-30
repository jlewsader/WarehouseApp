# WarehouseApp Docker Deployment Guide

This guide provides comprehensive instructions for deploying WarehouseApp using Docker and Docker Compose for testing and production environments, including VPS hosting.

## Prerequisites

Before deploying WarehouseApp, ensure you have the following installed:

1. **Docker** (version 20.10 or later)
   - Installation: https://docs.docker.com/engine/install/
   
2. **Docker Compose** (version 2.0 or later)
   - Usually included with Docker Desktop
   - For Linux: https://docs.docker.com/compose/install/

3. **SSL Certificates**
   - Self-signed certificates (for testing)
   - Valid SSL certificates from Let's Encrypt or other CA (for production)

4. **Domain/IP Address** (optional but recommended for production)
   - A domain name pointing to your server
   - Or a static IP address

## Quick Start

Follow these steps to get WarehouseApp running with Docker:

### 1. Clone the Repository

```bash
git clone https://github.com/jlewsader/WarehouseApp.git
cd WarehouseApp
```

### 2. Environment Setup

Copy the production environment template and edit the values:

```bash
cp .env.production .env
```

Edit the `.env` file and change the `SESSION_SECRET` to a strong random value:

```bash
# Generate a secure SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the generated value and update the `SESSION_SECRET` in your `.env` file.

### 3. SSL Certificate Setup

You have two options for SSL certificates:

#### Option A: Use Existing Certificates

If you have existing SSL certificates, place them in the `certs` directory:

```bash
cp /path/to/your/certificate.pem certs/localhost+3.pem
cp /path/to/your/private-key.pem certs/localhost+3-key.pem
```

#### Option B: Generate Self-Signed Certificates with mkcert (Recommended for Testing)

For local testing, use mkcert to generate trusted self-signed certificates:

**Install mkcert on Ubuntu/Debian:**

```bash
# Install mkcert
sudo apt update
sudo apt install -y wget libnss3-tools
wget https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-amd64
chmod +x mkcert-v1.4.4-linux-amd64
sudo mv mkcert-v1.4.4-linux-amd64 /usr/local/bin/mkcert

# Install local CA
mkcert -install

# Generate certificates for localhost
cd certs
mkcert localhost 127.0.0.1 ::1
mv localhost+2.pem localhost+3.pem
mv localhost+2-key.pem localhost+3-key.pem
cd ..
```

**For production with Let's Encrypt:**

```bash
# Install certbot
sudo apt update
sudo apt install -y certbot

# Generate certificates (replace yourdomain.com)
sudo certbot certonly --standalone -d yourdomain.com

# Copy certificates to certs directory
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem certs/localhost+3.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem certs/localhost+3-key.pem
sudo chown $USER:$USER certs/*
```

### 4. Create Data Directories

Create the necessary directories and database file for data persistence:

```bash
mkdir -p data backups
touch data/warehouse.db
```

### 5. Build and Start the Container

Build the Docker image and start the container:

```bash
# Build the image
docker-compose build

# Start the container in detached mode
docker-compose up -d
```

### 6. Verify Deployment

Check that the container is running:

```bash
# Check container status
docker-compose ps

# Check application health
curl -k https://localhost:3001/health
```

You should see:
```json
{"status":"ok"}
```

Access the application at: `https://localhost:3001`

## Container Management

### Stop the Application

```bash
docker-compose down
```

### Restart the Application

```bash
docker-compose restart
```

### View Logs

View real-time logs:

```bash
# Follow logs
docker-compose logs -f

# View last 100 lines
docker-compose logs --tail=100
```

### Update the Application

To update to the latest version:

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose down
docker-compose build
docker-compose up -d
```

### Backup Database

The SQLite database is stored in the `data` directory. To back it up:

```bash
# Create a timestamped backup
timestamp=$(date +%Y%m%d_%H%M%S)
docker-compose exec warehouseapp sqlite3 /app/warehouse.db ".backup /app/backups/warehouse_backup_$timestamp.db"

# Or copy the database file directly (stop container first)
docker-compose down
cp data/warehouse.db backups/warehouse_backup_$timestamp.db
docker-compose up -d
```

### Restore Database

To restore from a backup:

```bash
# Stop the container
docker-compose down

# Restore the backup
cp backups/warehouse_backup_YYYYMMDD_HHMMSS.db data/warehouse.db

# Start the container
docker-compose up -d
```

## VPS-Specific Setup

For production deployment on a VPS (Virtual Private Server):

### Firewall Configuration

Configure your firewall to allow traffic on port 3001:

```bash
# Using UFW (Ubuntu/Debian)
sudo ufw allow 3001/tcp
sudo ufw status
```

### Nginx Reverse Proxy (Recommended)

For production, use Nginx as a reverse proxy with SSL termination:

**Install Nginx:**

```bash
sudo apt update
sudo apt install -y nginx
```

**Create Nginx configuration** (`/etc/nginx/sites-available/warehouseapp`):

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Proxy settings
    location / {
        proxy_pass https://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Allow self-signed certificates for backend
        proxy_ssl_verify off;
    }
}
```

**Enable the site:**

```bash
sudo ln -s /etc/nginx/sites-available/warehouseapp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Systemd Service for Auto-Start

Create a systemd service to automatically start the application on boot:

**Create service file** (`/etc/systemd/system/warehouseapp.service`):

```ini
[Unit]
Description=WarehouseApp Docker Container
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/youruser/WarehouseApp
ExecStart=/usr/bin/docker-compose up -d
ExecStop=/usr/bin/docker-compose down
User=youruser
Group=youruser

[Install]
WantedBy=multi-user.target
```

**Enable and start the service:**

```bash
sudo systemctl daemon-reload
sudo systemctl enable warehouseapp
sudo systemctl start warehouseapp
sudo systemctl status warehouseapp
```

## Monitoring

### Resource Usage

Monitor container resource usage:

```bash
# Real-time stats
docker stats warehouseapp

# Container resource usage
docker-compose stats
```

### Disk Usage

Check disk usage:

```bash
# Docker disk usage
docker system df

# Container size
docker-compose ps -a --format "table {{.Name}}\t{{.Size}}"

# Volume sizes
du -sh data backups
```

## Troubleshooting

### Container Won't Start

Check logs for errors:

```bash
docker-compose logs

# Check if port is already in use
sudo netstat -tulpn | grep 3001
```

### Permission Issues

If you encounter permission issues with volumes:

```bash
# Fix ownership (1001:1001 is the nodejs user in the container)
sudo chown -R 1001:1001 data backups
```

### Database Access

To access the SQLite database directly:

```bash
# Access database from inside the container
docker-compose exec warehouseapp sqlite3 /app/warehouse.db

# Or use sqlite3 on host
sqlite3 data/warehouse.db
```

### SSL Certificate Issues

If you have SSL certificate errors:

```bash
# Verify certificate files exist and have correct permissions
ls -la certs/
chmod 644 certs/localhost+3.pem
chmod 600 certs/localhost+3-key.pem
```

### Reset Everything (WARNING: Data Loss)

To completely reset the application:

```bash
# Stop and remove containers, volumes
docker-compose down -v

# Remove data (WARNING: This deletes your database!)
rm -rf data/*

# Rebuild and start fresh
docker-compose up -d
```

## Security Recommendations

1. **Change Default SESSION_SECRET**
   - Always use a strong, random SESSION_SECRET in production
   - Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

2. **Use Proper SSL Certificates**
   - For production, use certificates from Let's Encrypt or a trusted CA
   - Never use self-signed certificates in production

3. **Regular Backups**
   - Set up automated daily backups of the database
   - Store backups in a separate location or cloud storage
   - Test backup restoration regularly

4. **Update Regularly**
   - Keep Docker and Docker Compose updated
   - Regularly update the application with `git pull` and rebuild

5. **Limit Access**
   - Use firewall rules to restrict access to necessary ports only
   - Consider using a VPN for administrative access
   - Implement IP whitelisting if appropriate

6. **Monitor Logs**
   - Regularly review application logs for suspicious activity
   - Set up log rotation to prevent disk space issues
   - Consider using a log aggregation service for production

## Performance Tuning

### Adjusting Resource Limits

Edit `docker-compose.yml` to adjust resource limits based on your needs:

```yaml
deploy:
  resources:
    limits:
      cpus: '2'          # Increase for more CPU
      memory: 1G         # Increase for more memory
    reservations:
      cpus: '1'
      memory: 512M
```

After changes, rebuild and restart:

```bash
docker-compose down
docker-compose up -d
```

### Database Optimization

Optimize the SQLite database periodically:

```bash
# Run VACUUM to optimize database
docker-compose exec warehouseapp sqlite3 /app/warehouse.db "VACUUM;"

# Analyze database for query optimization
docker-compose exec warehouseapp sqlite3 /app/warehouse.db "ANALYZE;"
```

## Support

For issues, questions, or contributions:
- GitHub Issues: https://github.com/jlewsader/WarehouseApp/issues
- Documentation: See README.md for application-specific documentation

## License

See the LICENSE file in the repository root for license information.
