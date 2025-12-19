#!/bin/bash
# Warehouse Database Restore Script
# Restores warehouse.db from backup

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

DB_FILE="/workspace/warehouse.db"
BACKUP_DIR="/workspace/backups"

# Check if backup file provided
if [ -z "$1" ]; then
    log_error "Usage: $0 <backup-file>"
    log_info "Available backups:"
    echo ""
    echo "Daily backups:"
    ls -lh "$BACKUP_DIR/daily/" 2>/dev/null | tail -10 || echo "  No daily backups found"
    echo ""
    echo "Weekly backups:"
    ls -lh "$BACKUP_DIR/weekly/" 2>/dev/null || echo "  No weekly backups found"
    echo ""
    echo "Monthly backups:"
    ls -lh "$BACKUP_DIR/monthly/" 2>/dev/null || echo "  No monthly backups found"
    exit 1
fi

BACKUP_FILE="$1"

# Check if backup exists
if [ ! -f "$BACKUP_FILE" ]; then
    log_error "Backup file not found: $BACKUP_FILE"
    exit 1
fi

log_warn "========================================="
log_warn "WARNING: This will overwrite the current database!"
log_warn "Current database: $DB_FILE"
log_warn "Backup file: $BACKUP_FILE"
log_warn "========================================="
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    log_info "Restore cancelled."
    exit 0
fi

# Create safety backup of current database
if [ -f "$DB_FILE" ]; then
    SAFETY_BACKUP="/workspace/backups/pre-restore-safety_$(date +%Y%m%d_%H%M%S).db"
    log_info "Creating safety backup of current database..."
    cp "$DB_FILE" "$SAFETY_BACKUP"
    log_info "Safety backup created: $SAFETY_BACKUP"
fi

# Restore from backup
log_info "Restoring database from backup..."

if [[ "$BACKUP_FILE" == *.gz ]]; then
    # Compressed backup
    gunzip -c "$BACKUP_FILE" > "$DB_FILE"
else
    # Uncompressed backup
    cp "$BACKUP_FILE" "$DB_FILE"
fi

# Verify restored database
log_info "Verifying restored database..."
sqlite3 "$DB_FILE" "PRAGMA integrity_check;" > /tmp/restore_check.txt 2>&1

if grep -q "ok" /tmp/restore_check.txt; then
    log_info "Database integrity verified: OK"
else
    log_error "Restored database failed integrity check!"
    cat /tmp/restore_check.txt
    
    # Restore safety backup
    if [ -f "$SAFETY_BACKUP" ]; then
        log_warn "Restoring safety backup..."
        cp "$SAFETY_BACKUP" "$DB_FILE"
    fi
    exit 1
fi

rm /tmp/restore_check.txt

# Show database stats
log_info "Restored database statistics:"
sqlite3 "$DB_FILE" << EOF
SELECT 'Products: ' || COUNT(*) FROM products;
SELECT 'Inventory: ' || COUNT(*) FROM inventory;
SELECT 'Locations: ' || COUNT(*) FROM locations;
SELECT 'Users: ' || COUNT(*) FROM users;
EOF

log_info "========================================="
log_info "Database restored successfully!"
log_info "========================================="
log_info "Please restart the application."

exit 0
