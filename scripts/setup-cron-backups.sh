#!/bin/bash
# Setup Automated Cron Backups
# Configures cron jobs for automatic database backups

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

SCRIPT_DIR="/workspace/scripts"
BACKUP_SCRIPT="$SCRIPT_DIR/backup-database.sh"
LOG_FILE="/workspace/backups/backup.log"

# Make scripts executable
chmod +x "$BACKUP_SCRIPT"
chmod +x "$SCRIPT_DIR/restore-database.sh"

log_info "Setting up automated backup cron jobs..."

# Create cron job entries
CRON_JOBS="
# Warehouse Database Backups
# Run every 4 hours (00:00, 04:00, 08:00, 12:00, 16:00, 20:00)
0 */4 * * * $BACKUP_SCRIPT >> $LOG_FILE 2>&1

# Alternative schedules (uncomment the one you prefer):

# Every 6 hours
# 0 */6 * * * $BACKUP_SCRIPT >> $LOG_FILE 2>&1

# Twice daily (2am and 2pm)
# 0 2,14 * * * $BACKUP_SCRIPT >> $LOG_FILE 2>&1

# Daily at 2am
# 0 2 * * * $BACKUP_SCRIPT >> $LOG_FILE 2>&1

# Every hour
# 0 * * * * $BACKUP_SCRIPT >> $LOG_FILE 2>&1
"

# Check if running in container
if [ -f "/.dockerenv" ] || grep -q docker /proc/1/cgroup 2>/dev/null; then
    log_warn "Running in container - cron jobs need to be set up on host system"
    log_info "Add this to your HOST crontab (crontab -e):"
    echo "$CRON_JOBS"
else
    # Add to user's crontab
    (crontab -l 2>/dev/null || echo "") | grep -v "$BACKUP_SCRIPT" > /tmp/current_cron
    echo "$CRON_JOBS" >> /tmp/current_cron
    crontab /tmp/current_cron
    rm /tmp/current_cron
    
    log_info "Cron jobs installed successfully!"
    log_info "Current crontab:"
    crontab -l
fi

log_info ""
log_info "========================================="
log_info "Backup automation setup complete!"
log_info "========================================="
log_info "Backup script: $BACKUP_SCRIPT"
log_info "Log file: $LOG_FILE"
log_info "Schedule: Every 4 hours"
log_info ""
log_info "Manual backup: $BACKUP_SCRIPT"
log_info "View logs: tail -f $LOG_FILE"
log_info "View cron jobs: crontab -l"
log_info "========================================="

exit 0
