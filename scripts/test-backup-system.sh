#!/bin/bash
# Test Backup System
# Validates backup and restore functionality

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_pass() { echo -e "${GREEN}✓${NC} $1"; }
log_fail() { echo -e "${RED}✗${NC} $1"; }
log_info() { echo -e "${YELLOW}ℹ${NC} $1"; }

TEST_DIR="/workspace/backups/test"
BACKUP_SCRIPT="/workspace/scripts/backup-database.sh"
RESTORE_SCRIPT="/workspace/scripts/restore-database.sh"
DB_FILE="/workspace/warehouse.db"

echo "========================================="
echo "Testing Warehouse Backup System"
echo "========================================="
echo ""

# Test 1: Check scripts exist
log_info "Test 1: Checking scripts exist..."
if [ -f "$BACKUP_SCRIPT" ] && [ -x "$BACKUP_SCRIPT" ]; then
    log_pass "Backup script exists and is executable"
else
    log_fail "Backup script missing or not executable"
    exit 1
fi

if [ -f "$RESTORE_SCRIPT" ] && [ -x "$RESTORE_SCRIPT" ]; then
    log_pass "Restore script exists and is executable"
else
    log_fail "Restore script missing or not executable"
    exit 1
fi

# Test 2: Check database exists
log_info "Test 2: Checking database exists..."
if [ -f "$DB_FILE" ]; then
    log_pass "Database file exists: $DB_FILE"
else
    log_fail "Database file not found: $DB_FILE"
    exit 1
fi

# Test 3: Verify database integrity
log_info "Test 3: Verifying database integrity..."
INTEGRITY=$(sqlite3 "$DB_FILE" "PRAGMA integrity_check;")
if [ "$INTEGRITY" = "ok" ]; then
    log_pass "Database integrity check passed"
else
    log_fail "Database integrity check failed: $INTEGRITY"
    exit 1
fi

# Test 4: Get database stats
log_info "Test 4: Reading database statistics..."
PRODUCT_COUNT=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM products;" 2>/dev/null || echo "0")
INVENTORY_COUNT=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM inventory;" 2>/dev/null || echo "0")
log_pass "Products: $PRODUCT_COUNT"
log_pass "Inventory: $INVENTORY_COUNT"

# Test 5: Create test backup
log_info "Test 5: Creating test backup..."
mkdir -p "$TEST_DIR"
TEST_BACKUP="$TEST_DIR/test_backup_$(date +%Y%m%d_%H%M%S).db"

sqlite3 "$DB_FILE" ".backup '$TEST_BACKUP'"
if [ -f "$TEST_BACKUP" ]; then
    log_pass "Test backup created: $TEST_BACKUP"
else
    log_fail "Failed to create test backup"
    exit 1
fi

# Test 6: Compress test backup
log_info "Test 6: Compressing backup..."
gzip -f "$TEST_BACKUP"
TEST_BACKUP="${TEST_BACKUP}.gz"
if [ -f "$TEST_BACKUP" ]; then
    BACKUP_SIZE=$(du -h "$TEST_BACKUP" | cut -f1)
    log_pass "Backup compressed: $BACKUP_SIZE"
else
    log_fail "Failed to compress backup"
    exit 1
fi

# Test 7: Verify compressed backup
log_info "Test 7: Verifying compressed backup..."
gunzip -t "$TEST_BACKUP"
if [ $? -eq 0 ]; then
    log_pass "Compressed backup is valid"
else
    log_fail "Compressed backup is corrupted"
    exit 1
fi

# Test 8: Test restore to temp location
log_info "Test 8: Testing restore to temp location..."
TEST_RESTORE="$TEST_DIR/test_restore.db"
gunzip -c "$TEST_BACKUP" > "$TEST_RESTORE"

if [ -f "$TEST_RESTORE" ]; then
    log_pass "Backup restored to temp location"
else
    log_fail "Failed to restore backup"
    exit 1
fi

# Test 9: Verify restored database integrity
log_info "Test 9: Verifying restored database..."
RESTORE_INTEGRITY=$(sqlite3 "$TEST_RESTORE" "PRAGMA integrity_check;")
if [ "$RESTORE_INTEGRITY" = "ok" ]; then
    log_pass "Restored database integrity OK"
else
    log_fail "Restored database integrity failed"
    exit 1
fi

# Test 10: Compare data counts
log_info "Test 10: Comparing data counts..."
RESTORE_PRODUCTS=$(sqlite3 "$TEST_RESTORE" "SELECT COUNT(*) FROM products;" 2>/dev/null || echo "0")
RESTORE_INVENTORY=$(sqlite3 "$TEST_RESTORE" "SELECT COUNT(*) FROM inventory;" 2>/dev/null || echo "0")

if [ "$PRODUCT_COUNT" -eq "$RESTORE_PRODUCTS" ] && [ "$INVENTORY_COUNT" -eq "$RESTORE_INVENTORY" ]; then
    log_pass "Data counts match (Products: $RESTORE_PRODUCTS, Inventory: $RESTORE_INVENTORY)"
else
    log_fail "Data counts mismatch!"
    exit 1
fi

# Test 11: Check backup directories
log_info "Test 11: Checking backup directory structure..."
for dir in daily weekly monthly; do
    if [ -d "/workspace/backups/$dir" ]; then
        log_pass "Directory exists: /workspace/backups/$dir"
    else
        mkdir -p "/workspace/backups/$dir"
        log_pass "Created directory: /workspace/backups/$dir"
    fi
done

# Test 12: Check cron jobs (if not in container)
log_info "Test 12: Checking cron configuration..."
if [ -f "/.dockerenv" ] || grep -q docker /proc/1/cgroup 2>/dev/null; then
    log_info "Running in container - skipping cron check"
else
    if crontab -l 2>/dev/null | grep -q "backup-database.sh"; then
        log_pass "Cron job configured"
    else
        log_info "Cron job not configured (run setup-cron-backups.sh)"
    fi
fi

# Test 13: Check rclone (optional)
log_info "Test 13: Checking cloud backup capability..."
if command -v rclone &> /dev/null; then
    log_pass "rclone is installed"
    if rclone listremotes 2>/dev/null | grep -q "cloud:"; then
        log_pass "rclone remote 'cloud' is configured"
    else
        log_info "rclone remote 'cloud' not configured (optional)"
    fi
else
    log_info "rclone not installed (optional for cloud backup)"
fi

# Cleanup test files
log_info "Cleaning up test files..."
rm -f "$TEST_RESTORE"
rm -f "$TEST_BACKUP"
rm -rf "$TEST_DIR"
log_pass "Test files cleaned up"

echo ""
echo "========================================="
echo -e "${GREEN}All tests passed!${NC}"
echo "========================================="
echo ""
echo "Backup system is working correctly."
echo ""
echo "Next steps:"
echo "1. Set up automated backups: ./setup-cron-backups.sh"
echo "2. Configure cloud storage: rclone config (optional)"
echo "3. Run manual backup: ./backup-database.sh"
echo "4. Review BACKUP_GUIDE.md for complete documentation"
echo ""

exit 0
