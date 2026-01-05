# Multi-stage production Dockerfile for WarehouseApp
# Stage 1: Builder - Install dependencies with native module build tools
FROM node:20-alpine AS builder

# Install build dependencies for native modules (bcrypt, sqlite3)
RUN apk add --no-cache python3 make g++ sqlite

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for building native modules)
RUN npm ci

# Stage 2: Production - Minimal runtime image
FROM node:20-alpine

# Install runtime dependencies
RUN apk add --no-cache sqlite

# Create non-root user for security
RUN addgroup -g 1001 nodejs && \
    adduser -u 1001 -G nodejs -s /bin/sh -D nodejs

WORKDIR /app

# Copy package files for reference
COPY package*.json ./

# Copy built native modules from builder stage (includes all dependencies)
COPY --from=builder /app/node_modules ./node_modules

# Copy application code with proper ownership
COPY --chown=nodejs:nodejs . .

# Create required directories with proper permissions
RUN mkdir -p /app/backups /app/certs /app/data && \
    chown -R nodejs:nodejs /app/backups /app/certs /app/data && \
    chmod 777 /app/data

# Switch to non-root user
USER nodejs

# Expose application port
EXPOSE 3001

# Add healthcheck using HTTPS endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "const https = require('https'); const options = { hostname: 'localhost', port: 3001, path: '/health', method: 'GET', rejectUnauthorized: false }; const req = https.request(options, (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }); req.on('error', () => { process.exit(1); }); req.end();"

# Start the application
CMD ["node", "src/app.js"]
