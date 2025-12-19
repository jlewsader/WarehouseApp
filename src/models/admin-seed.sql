-- Seed dropdown options with current hardcoded values

-- Brands
INSERT OR IGNORE INTO dropdown_options (category, value, display_order) VALUES
('brand', 'Keystone', 1),
('brand', 'Dekalb', 2),
('brand', 'Croplan', 3),
('brand', 'Brevant', 4),
('brand', 'Asgrow', 5),
('brand', 'Armor', 6),
('brand', 'Agrigold', 7),
('brand', 'NK', 8),
('brand', 'Xitavo', 9);

-- Seed Sizes
INSERT OR IGNORE INTO dropdown_options (category, value, display_order) VALUES
('seed_size', 'MP', 1),
('seed_size', 'MF', 2),
('seed_size', 'MR', 3),
('seed_size', 'LP', 4),
('seed_size', 'AF', 5),
('seed_size', 'AF2', 6),
('seed_size', 'AR', 7),
('seed_size', 'AR2', 8),
('seed_size', 'CPR2', 9),
('seed_size', 'CPF2', 10),
('seed_size', 'CPR', 11),
('seed_size', 'CPF', 12),
('seed_size', 'CPP', 13),
('seed_size', 'F1', 14),
('seed_size', 'F2', 15),
('seed_size', 'R1', 16),
('seed_size', 'R2', 17);

-- Package Types
INSERT OR IGNORE INTO dropdown_options (category, value, display_order) VALUES
('package_type', 'SP50', 1),
('package_type', 'SP45', 2),
('package_type', 'SP40', 3),
('package_type', 'SP35', 4),
('package_type', 'SP30', 5),
('package_type', 'MB45', 6),
('package_type', 'MB40', 7),
('package_type', 'Bulk 80M', 8),
('package_type', 'Bulk 140M', 9);

-- Default admin user (password: admin123)
-- Hash generated with bcrypt rounds=10
INSERT OR IGNORE INTO users (username, password_hash, role) VALUES
('admin', '$2b$10$5FPCppbLeUvfSNz5.S6muOOil64Qu9KDTZ385zViNdGqON4Tcof8K', 'admin');
