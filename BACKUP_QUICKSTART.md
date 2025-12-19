# Warehouse Backup System - Quick Reference

## ✅ System Installed & Tested

Your backup system is now installed and working! Initial backup completed successfully.

## 📦 What's Installed

### Backup Scripts (`/workspace/scripts/`)
- ✅ `backup-database.sh` - Main backup script (tested & working)
- ✅ `restore-database.sh` - Restore from backup
- ✅ `test-backup-system.sh` - System validation
- ✅ `setup-cron-backups.sh` - Automation setup

### Backup Locations
- **Daily backups:** `/workspace/backups/daily/` (30-day retention)
- **Weekly backups:** `/workspace/backups/weekly/` (12-week retention)
- **Monthly backups:** `/workspace/backups/monthly/` (indefinite)
- **Logs:** `/workspace/backups/backup.log`
- **Report:** `/workspace/backups/backup_report.txt`

### Current Status
```
Database: 68KB
First Backup: 12KB (compressed)
Products: 3
Inventory: 4
Status: ✓ All tests passed
```

---

## 🚀 Quick Commands

### Create Backup
```bash
./scripts/backup-database.sh
```

### List All Backups
```bash
ls -lh /workspace/backups/daily/
ls -lh /workspace/backups/weekly/
ls -lh /workspace/backups/monthly/
```

### View Latest Backup Report
```bash
cat /workspace/backups/backup_report.txt
```

### Restore from Backup
```bash
# List available backups first
./scripts/restore-database.sh

# Restore specific backup
./scripts/restore-database.sh /workspace/backups/daily/warehouse_20251219_180012.db.gz
```

### Test System
```bash
./scripts/test-backup-system.sh
```

---

## ⏰ Automated Backups (Dev Container)

Since you're running in a dev container, here are your options for automation:

### Option 1: Manual Backups (Recommended for Development)
Run backup manually whenever needed:
```bash
./scripts/backup-database.sh
```

### Option 2: Background Script
Create a background task that runs periodically while container is active:
```bash
# Run backup every 4 hours in background
while true; do
  ./scripts/backup-database.sh >> /workspace/backups/backup.log 2>&1
  sleep 14400  # 4 hours
done &
```

### Option 3: Add to Docker Compose (If using Docker Compose)
```yaml
services:
  warehouse:
    # ... existing config ...
    volumes:
      - ./backups:/workspace/backups  # Persist backups outside container
    command: >
      sh -c "
        (while true; do ./scripts/backup-database.sh; sleep 14400; done &)
        && node src/app.js
      "
```

### Option 4: Host Machine Cron (Production)
On the host machine (not in container):
```bash
# Edit crontab
crontab -e

# Add this line (adjust path to your workspace)
0 */4 * * * docker exec warehouse-container /workspace/scripts/backup-database.sh >> /path/to/logs/backup.log 2>&1
```

---

## ☁️ Cloud Backup Setup (Optional)

### Install rclone
```bash
curl https://rclone.org/install.sh | sudo bash
```

### Configure Cloud Storage
```bash
rclone config
```

**Popular Providers:**
- **AWS S3:** High reliability, pay-per-use
- **Google Drive:** Free 15GB, easy setup
- **Dropbox:** Free 2GB, simple integration
- **Backblaze B2:** Cheap, reliable

### Example: Google Drive Setup
```bash
rclone config

# Follow prompts:
n) New remote
name> cloud
Storage> drive
# Follow browser authentication
```

### Test Cloud Sync
```bash
# Manual sync
rclone sync /workspace/backups cloud:warehouse-backups --progress

# Automatic sync (add to backup script)
# Already configured - will auto-detect rclone
```

---

## 🔄 Backup & Restore Examples

### Scenario 1: Daily Manual Backup
```bash
# Before major changes
./scripts/backup-database.sh

# Check it was created
ls -lh /workspace/backups/daily/ | tail -1
```

### Scenario 2: Restore After Accident
```bash
# 1. List backups
./scripts/restore-database.sh

# 2. Choose backup and restore
./scripts/restore-database.sh /workspace/backups/daily/warehouse_20251219_180012.db.gz

# 3. Type 'yes' to confirm

# 4. Restart app
node src/app.js
```

### Scenario 3: Clone Database
```bash
# Extract backup to different location
gunzip -c /workspace/backups/daily/warehouse_20251219_180012.db.gz > /workspace/warehouse_copy.db

# Connect with sqlite3
sqlite3 /workspace/warehouse_copy.db
```

### Scenario 4: Export Data
```bash
# Export to SQL
sqlite3 /workspace/warehouse.db .dump > backup.sql

# Export specific table
sqlite3 /workspace/warehouse.db "SELECT * FROM products;" > products.csv
```

---

## 📊 Monitoring

### Check Backup Size Over Time
```bash
du -h /workspace/backups/daily/* | tail -10
```

### Verify Latest Backup
```bash
gunzip -c /workspace/backups/daily/warehouse_$(ls -t /workspace/backups/daily/ | head -1) | sqlite3 /dev/null "PRAGMA integrity_check;"
```

### View Backup History
```bash
ls -lht /workspace/backups/daily/ | head -20
```

### Storage Usage
```bash
du -sh /workspace/backups
```

---

## 🛡️ Best Practices

### DO:
- ✅ Run backup before major changes (clear inventory, bulk edits)
- ✅ Test restore process monthly
- ✅ Keep backups outside container (volume mount)
- ✅ Enable cloud sync for production
- ✅ Verify backups weekly

### DON'T:
- ❌ Delete backups without testing
- ❌ Store only local backups in production
- ❌ Ignore backup failures
- ❌ Edit backup files manually

---

## 🚨 Emergency Recovery

### Complete Database Loss
```bash
# 1. List all available backups
ls -lh /workspace/backups/daily/

# 2. Choose most recent
LATEST=$(ls -t /workspace/backups/daily/*.gz | head -1)

# 3. Restore
gunzip -c $LATEST > /workspace/warehouse.db

# 4. Verify
sqlite3 /workspace/warehouse.db "PRAGMA integrity_check;"

# 5. Restart
node src/app.js
```

### Corrupted Database
```bash
# Stop the app first!
pkill -f "node src/app.js"

# Restore from yesterday
./scripts/restore-database.sh /workspace/backups/daily/warehouse_20251218*.db.gz

# Restart app
node src/app.js
```

---

## 📞 Support

### Verify System Health
```bash
./scripts/test-backup-system.sh
```

### View Logs
```bash
tail -f /workspace/backups/backup.log
```

### Manual Commands
```bash
# Create backup manually
sqlite3 /workspace/warehouse.db ".backup '/workspace/manual_backup.db'"

# Restore manually
cp /workspace/manual_backup.db /workspace/warehouse.db

# Verify integrity
sqlite3 /workspace/warehouse.db "PRAGMA integrity_check;"
```

---

## 📝 Files Reference

| File | Purpose |
|------|---------|
| `/workspace/warehouse.db` | Live database |
| `/workspace/backups/daily/*.gz` | Daily compressed backups |
| `/workspace/backups/backup_report.txt` | Latest backup info |
| `/workspace/backups/backup.log` | Backup history log |
| `/workspace/scripts/backup-database.sh` | Main backup script |
| `/workspace/scripts/restore-database.sh` | Restore script |

---

## ✨ System Status

**Installation:** ✅ Complete  
**Testing:** ✅ All tests passed  
**First Backup:** ✅ Created (12KB)  
**Integrity:** ✅ Verified OK  
**Ready for:** Production use  

---

**Last Updated:** December 19, 2025  
**Version:** 1.0  
**Status:** Active & Working
