# Copilot Instructions for WarehouseApp

## Architecture Overview

**WarehouseApp** is a full-stack seed warehouse management system with an Express.js backend and vanilla JavaScript frontend. The system tracks product inventory across physical warehouse locations using barcode scanning.

### Core Components

1. **Backend (Node.js/Express)**
   - `src/app.js` - Express server entry point, route registration, database initialization
   - `src/db.js` - SQLite3 database connection (file: `warehouse.db`) in serialized mode
   - `src/routes/` - API route handlers (products, inventory, locations)

2. **Database (SQLite)**
   - `products` - Barcode, brand, product_code, lot, seed_size, package_type, units_per_package
   - `locations` - Warehouse grid with id, label, row_index, col_index, zone
   - `inventory` - Links products to locations with owner and qty; includes special UNASSIGNED location (id: 9999)

3. **Frontend (Vanilla JS)**
   - `public/` - Static HTML pages (scan.html, search.html, map.html, move.html, product.html, unassigned.html)
   - `public/js/` - Page-specific modules (scan.js, search.js, map.js, move.js, product.js, unassigned.js)
   - No API.js file currently (placeholder); frontend makes direct fetch requests to `http://localhost:4000/api/*`

## Critical Data Flow Patterns

- **Barcode Lookup**: Frontend → `/api/products/barcode/:code` → Returns product record with on-hand qty
- **Inventory View**: Products are always fetched with aggregated quantities and location info
- **Location Hierarchy**: Locations are ordered by `zone, row_index, col_index` for warehouse map display
- **UNASSIGNED Location**: Special location (id 9999) for products not yet placed; automatically seeded on app init

## Developer Workflows

### Start the Server
```bash
npm install
node src/app.js
# Server runs on port 4000 (default) or custom PORT env var
```

### Database Setup
- Schema is auto-applied on server startup via `db.exec(schema)` from `src/models/schema.sql`
- UNASSIGNED location is auto-seeded if missing
- SQLite uses serialized mode to prevent `.exec()` from blocking route registration

### Testing API Endpoints
```bash
curl http://localhost:4000/health
curl "http://localhost:4000/api/products?brand=YourBrand"
curl "http://localhost:4000/api/products/barcode/12345"
curl http://localhost:4000/api/locations
curl http://localhost:4000/api/inventory
```

## Code Patterns & Conventions

### SQLite Query Pattern
All routes use parameterized queries with `db.all()`, `db.get()`, `db.run()` callbacks:
```javascript
db.all(sql, params, (err, rows) => {
  if (err) return res.status(500).json({ error: err.message });
  res.json(rows);
});
```

### Frontend Data Fetch
Use standard `fetch()` to call `/api/*` endpoints; expect JSON responses with error handling:
```javascript
fetch('/api/products/barcode/' + code)
  .then(r => r.json())
  .then(data => { /* handle product */ })
  .catch(err => console.error(err));
```

### Location Filtering
Locations are filtered by zone (e.g., "A", "B", "UNASSIGNED") and displayed in grid coordinates (row_index, col_index).

### Inventory Aggregation
The `/api/inventory` endpoints return denormalized rows (product + location + qty) for efficient frontend display. Use LEFT JOIN when needing aggregated on-hand qty without requiring inventory rows.

### Error Responses
- 404 for product barcode not found: `{ message: "NOT_FOUND" }`
- 500 for DB errors: `{ error: "error message" }`

## Integration Points

- **External Dependency**: `html5-qrcode.min.js` (in `public/js/libs/`) for barcode scanning
- **CORS Enabled**: App allows cross-origin requests
- **Static Files**: `public/` is served as root (index.html, map.html, etc.)

## Key Files to Reference

- `src/app.js` - App initialization, schema loading, route mounting
- `src/models/schema.sql` - Complete data model definition
- `src/routes/inventory.js` - Most complex route file; demonstrates inventory joins and filtering
- `public/scan.html` - Example frontend page structure and barcode capture flow
