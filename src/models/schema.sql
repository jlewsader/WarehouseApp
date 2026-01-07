CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    barcode TEXT UNIQUE,
    brand TEXT,
    product_code TEXT,
    seed_size TEXT,
    package_type TEXT
);


CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT,
    row_index INTEGER,
    col_index INTEGER,
    tier TEXT,
    zone TEXT
);

CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id INTEGER,
    product_id INTEGER,
    lot TEXT,
    owner TEXT,
    staged INTEGER DEFAULT 0,
    FOREIGN KEY (location_id) REFERENCES locations(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS dropdown_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    value TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    UNIQUE(category, value)
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS outbound_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inventory_id INTEGER,
    product_id INTEGER,
    brand TEXT,
    product_code TEXT,
    seed_size TEXT,
    package_type TEXT,
    lot TEXT,
    owner TEXT,
    location_label TEXT,
    zone TEXT,
    dispatched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    dispatched_by TEXT,
    notes TEXT,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX IF NOT EXISTS idx_outbound_log_dispatched_at ON outbound_log(dispatched_at);

INSERT OR IGNORE INTO locations (id, label, row_index, col_index, tier, zone)
VALUES (9999, 'UNASSIGNED', 0, 0, 'N/A', 'Receiving');