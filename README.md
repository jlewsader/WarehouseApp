# WarehouseApp

A lightweight warehouse management application built with Node.js, Express, and SQLite.

## Features

- 📦 Product location management
- 📊 Inventory tracking and updates
- 📤 Excel import/export functionality
- 🔄 Automated database backups
- 🔒 Secure session management
- 🐳 Docker deployment ready

## Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Start development server with auto-reload
npm run dev

# Or start production mode
npm start
```

The application will be available at `http://localhost:3001`

### Docker Deployment

```bash
# Standard deployment
docker compose up -d

# With nginx reverse proxy (recommended for production)
docker compose -f docker-compose.nginx.yml up -d
```

## Deployment Options

### VPS Deployment

For deploying to a cloud VPS (DigitalOcean, Linode, AWS, etc.), see [VPS-DEPLOYMENT.md](VPS-DEPLOYMENT.md) for detailed instructions.

The included setup script automatically:
- Installs Docker and dependencies
- Generates SSL certificates
- Configures the environment
- Starts the application

### Nginx Reverse Proxy

For production deployments with SSL/TLS termination, see [NGINX_SETUP.md](NGINX_SETUP.md) for:
- Let's Encrypt certificate setup
- Tailscale Funnel integration
- Custom certificate configuration
- Security best practices

## Database Backups

Automated backup system with retention policies. See [BACKUP_QUICKSTART.md](BACKUP_QUICKSTART.md) for:
- Daily, weekly, and monthly backup schedules
- Restore procedures
- Cloud backup integration with rclone
- Emergency recovery steps

### Quick Backup Commands

```bash
# Create manual backup
./scripts/backup-database.sh

# List backups
ls -lh backups/daily/

# Restore from backup
./scripts/restore-database.sh
```

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
NODE_ENV=production
PORT=3001
SESSION_SECRET=your-secure-random-secret
```

### Directory Structure

```
WarehouseApp/
├── src/              # Application source code
│   ├── app.js        # Express application entry point
│   ├── db.js         # SQLite database configuration
│   ├── models/       # Data models
│   ├── routes/       # API routes
│   └── middleware/   # Custom middleware
├── public/           # Static files (HTML, CSS, JS)
├── data/             # SQLite database storage
├── backups/          # Database backups
│   ├── daily/
│   ├── weekly/
│   └── monthly/
├── scripts/          # Utility scripts
└── certs/            # SSL certificates
```

## Technology Stack

- **Backend**: Node.js, Express 5.x
- **Database**: SQLite3
- **Authentication**: bcrypt, express-session
- **File Processing**: multer, xlsx
- **Deployment**: Docker, nginx

## Management Commands

### Application

```bash
# View logs
docker logs -f warehouseapp

# Restart application
docker compose restart

# Stop application
docker compose down

# Update and rebuild
git pull && docker compose up -d --build
```

### Database

```bash
# Create backup
./scripts/backup-database.sh

# Test backup system
./scripts/test-backup-system.sh

# View backup report
cat backups/backup_report.txt
```

## Security

- Password hashing with bcrypt
- Secure session management
- CORS configuration
- SSL/TLS support
- Proxy-aware secure cookies
- Environment-based configuration

## License

ISC

## Support

For detailed documentation on specific topics:
- 📘 [VPS Deployment Guide](VPS-DEPLOYMENT.md)
- 🔧 [Nginx Configuration](NGINX_SETUP.md)
- 💾 [Backup System Reference](BACKUP_QUICKSTART.md)
