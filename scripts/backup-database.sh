#!/bin/bash
# Warehouse Database Backup Script
# Creates backups with rotation, compression, and cloud sync

set -e  # Exit on error

# Configuration
DB_FILE="/workspace/warehouse.db"
BACKUP_DIR="/workspace/backups"
LOCAL_RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE_ONLY=$(date +%Y%m%d)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"
mkdir -p "$BACKUP_DIR/daily"
mkdir -p "$BACKUP_DIR/weekly"
mkdir -p "$BACKUP_DIR/monthly"

# Function to print colored messages
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if database file exists
if [ ! -f "$DB_FILE" ]; then
    log_error "Database file not found: $DB_FILE"
    exit 1
fi

# Get database size
DB_SIZE=$(du -h "$DB_FILE" | cut -f1)
log_info "Database size: $DB_SIZE"

#############################################
# 1. Daily Backup (with timestamp)
#############################################
log_info "Creating daily backup..."
DAILY_BACKUP="$BACKUP_DIR/daily/warehouse_${TIMESTAMP}.db"

# Use SQLite's backup command for consistent backup
sqlite3 "$DB_FILE" ".backup '$DAILY_BACKUP'"

if [ -f "$DAILY_BACKUP" ]; then
    log_info "Daily backup created: $DAILY_BACKUP"
    
    # Compress the backup
    log_info "Compressing backup..."
    gzip -f "$DAILY_BACKUP"
    DAILY_BACKUP="${DAILY_BACKUP}.gz"
    
    BACKUP_SIZE=$(du -h "$DAILY_BACKUP" | cut -f1)
    log_info "Compressed backup size: $BACKUP_SIZE"
else
    log_error "Failed to create daily backup"
    exit 1
fi

#############################################
# 2. Weekly Backup (Sunday only)
#############################################
DAY_OF_WEEK=$(date +%u)  # 1=Monday, 7=Sunday
if [ "$DAY_OF_WEEK" -eq 7 ]; then
    log_info "Creating weekly backup (Sunday)..."
    WEEKLY_BACKUP="$BACKUP_DIR/weekly/warehouse_week_${DATE_ONLY}.db.gz"
    cp "$DAILY_BACKUP" "$WEEKLY_BACKUP"
    log_info "Weekly backup created: $WEEKLY_BACKUP"
fi

#############################################
# 3. Monthly Backup (1st of month only)
#############################################
DAY_OF_MONTH=$(date +%d)
if [ "$DAY_OF_MONTH" -eq 01 ]; then
    log_info "Creating monthly backup (1st of month)..."
    MONTHLY_BACKUP="$BACKUP_DIR/monthly/warehouse_month_${DATE_ONLY}.db.gz"
    cp "$DAILY_BACKUP" "$MONTHLY_BACKUP"
    log_info "Monthly backup created: $MONTHLY_BACKUP"
fi

#############################################
# 4. Cleanup old daily backups
#############################################
log_info "Cleaning up old daily backups (keeping last $LOCAL_RETENTION_DAYS days)..."
find "$BACKUP_DIR/daily" -name "warehouse_*.db.gz" -mtime +$LOCAL_RETENTION_DAYS -delete
REMAINING_DAILY=$(find "$BACKUP_DIR/daily" -name "warehouse_*.db.gz" | wc -l)
log_info "Daily backups remaining: $REMAINING_DAILY"

#############################################
# 5. Cleanup old weekly backups (keep 12 weeks)
#############################################
log_info "Cleaning up old weekly backups (keeping last 12 weeks)..."
find "$BACKUP_DIR/weekly" -name "warehouse_*.db.gz" -mtime +84 -delete
REMAINING_WEEKLY=$(find "$BACKUP_DIR/weekly" -name "warehouse_*.db.gz" | wc -l)
log_info "Weekly backups remaining: $REMAINING_WEEKLY"

#############################################
# 6. Keep all monthly backups (manual cleanup)
#############################################
REMAINING_MONTHLY=$(find "$BACKUP_DIR/monthly" -name "warehouse_*.db.gz" | wc -l)
log_info "Monthly backups: $REMAINING_MONTHLY"

#############################################
# 7. Cloud Sync (optional - uncomment to enable)
#############################################
if command -v rclone &> /dev/null; then
    if rclone listremotes | grep -q "cloud:"; then
        log_info "Syncing to cloud storage..."
        
        rclone sync "$BACKUP_DIR" cloud:warehouse-backups \
            --progress \
            --transfers 4 \
            --checkers 8 \
            --contimeout 60s \
            --timeout 300s \
            --retries 3 \
            --low-level-retries 10
        
        if [ $? -eq 0 ]; then
            log_info "Cloud sync completed successfully"
        else
            log_warn "Cloud sync failed (backups still saved locally)"
        fi
    else
        log_warn "rclone remote 'cloud' not configured. Skipping cloud sync."
    fi
else
    log_warn "rclone not installed. Skipping cloud sync."
fi

#############################################
# 8. Generate backup report
#############################################
log_info "Generating backup report..."

REPORT_FILE="$BACKUP_DIR/backup_report.txt"
cat > "$REPORT_FILE" << EOF
Warehouse Database Backup Report
Generated: $(date)
=====================================

Database Information:
- Location: $DB_FILE
- Size: $DB_SIZE
- Last Backup: $TIMESTAMP

Backup Statistics:
- Daily backups: $REMAINING_DAILY files
- Weekly backups: $REMAINING_WEEKLY files
- Monthly backups: $REMAINING_MONTHLY files

Latest Backup:
- File: $DAILY_BACKUP
- Size: $BACKUP_SIZE

Backup Directories:
- Daily: $BACKUP_DIR/daily
- Weekly: $BACKUP_DIR/weekly
- Monthly: $BACKUP_DIR/monthly

Retention Policy:
- Daily: $LOCAL_RETENTION_DAYS days
- Weekly: 12 weeks (84 days)
- Monthly: Indefinite (manual cleanup)

Cloud Sync Status:
$(if command -v rclone &> /dev/null && rclone listremotes | grep -q "cloud:"; then
    echo "- Enabled (remote: cloud:warehouse-backups)"
else
    echo "- Disabled (rclone not configured)"
fi)

Recovery Instructions:
1. Stop the application
2. Restore backup: gunzip -c <backup-file.db.gz> > /workspace/warehouse.db
3. Restart the application

=====================================
EOF

log_info "Backup report saved: $REPORT_FILE"

#############################################
# 9. Verify backup integrity
#############################################
log_info "Verifying backup integrity..."
gunzip -c "$DAILY_BACKUP" | sqlite3 /dev/null "PRAGMA integrity_check;" > /tmp/integrity_check.txt 2>&1

if grep -q "ok" /tmp/integrity_check.txt; then
    log_info "Backup integrity verified: OK"
else
    log_error "Backup integrity check failed!"
    cat /tmp/integrity_check.txt
    exit 1
fi

rm /tmp/integrity_check.txt

#############################################
# Summary
#############################################
echo ""
log_info "========================================="
log_info "Backup completed successfully!"
log_info "========================================="
log_info "Latest backup: $DAILY_BACKUP"
log_info "Backup size: $BACKUP_SIZE"
log_info "Total backups: $(($REMAINING_DAILY + $REMAINING_WEEKLY + $REMAINING_MONTHLY))"
log_info "========================================="
echo ""

exit 0
