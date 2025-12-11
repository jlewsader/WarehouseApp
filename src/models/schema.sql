CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    barcode TEXT UNIQUE,
    brand TEXT,
    product_code TEXT,
    seed_size TEXT,
    package_type TEXT,
    units_per_package INTEGER DEFAULT 1
);


CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT,
    row_index INTEGER,
    col_index INTEGER,
    zone TEXT
);

CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location_id INTEGER,
    product_id INTEGER,
    lot TEXT,
    owner TEXT,
    FOREIGN KEY (location_id) REFERENCES locations(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Seed a few test locations so the UI has data for development
INSERT OR IGNORE INTO locations (label, row_index, col_index, zone) VALUES
    ('C-R1-C1-T', 1, 1, 'Center'),
    ('C-R1-C1-M', 1, 1, 'Center'),
    ('C-R1-C1-B', 1, 1, 'Center'),
    ('E-R5-C1-T', 5, 1, 'East Wall'),
    ('W-R2-C3-T', 2, 3, 'West Wall'),
    ('C-R10-C4-M', 10, 4, 'Center');