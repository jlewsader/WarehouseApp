CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    barcode TEXT UNIQUE,
    brand TEXT,
    product_code TEXT,
    lot TEXT,
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
    owner TEXT,
    qty INTEGER DEFAULT 1,
    FOREIGN KEY (location_id) REFERENCES locations(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);