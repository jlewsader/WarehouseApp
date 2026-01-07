import express from "express";
import multer from "multer";
import XLSX from "xlsx";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * Search products with filters
 * Now uses COUNT instead of SUM for on_hand quantity
 */
router.get("/", (req, res) => {
  const db = req.app.locals.db;

  const { brand, product, size, package_type } = req.query;

  let sql = `
    SELECT 
      p.*,
      COALESCE(COUNT(i.id), 0) AS on_hand
    FROM products p
    LEFT JOIN inventory i ON p.id = i.product_id
    WHERE 1 = 1
  `;

  const params = [];

  if (brand) {
    sql += " AND p.brand LIKE ?";
    params.push(`%${brand}%`);
  }
  if (product) {
    sql += " AND p.product_code LIKE ?";
    params.push(`%${product}%`);
  }
  if (size) {
    sql += " AND p.seed_size = ?";
    params.push(size);
  }
  if (package_type) {
    sql += " AND p.package_type = ?";
    params.push(package_type);
  }

  sql += " GROUP BY p.id";

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

/**
 * Barcode lookup
 */
router.get("/barcode/:code", (req, res) => {
  const db = req.app.locals.db;
  const code = req.params.code;

  db.get(
    "SELECT * FROM products WHERE barcode = ?",
    [code],
    (err, product) => {
      if (err) return res.status(500).json({ error: err.message });

      if (!product)
        return res.status(404).json({ message: "NOT_FOUND" });

      res.json(product);
    }
  );
});

// Create product
router.post("/", (req, res) => {
  const db = req.app.locals.db;

  const {
    barcode,
    brand,
    product_code,
    seed_size,
    package_type
  } = req.body;

  db.run(
    `
    INSERT INTO products 
      (barcode, brand, product_code, seed_size, package_type)
    VALUES (?, ?, ?, ?, ?)
    `,
    [
      barcode, 
      brand, 
      product_code, 
      seed_size, 
      package_type
    ],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Product added", id: this.lastID });
    }
  );
});

/**
 * Update product fields (partial update)
 * Accepts JSON body with fields to update
 */
router.put("/:id", (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;
  const fields = req.body || {};

  // Build a dynamic update for only provided fields
  const allowed = ["barcode", "brand", "product_code", "seed_size", "package_type"];
  const sets = [];
  const params = [];

  allowed.forEach((k) => {
    if (Object.prototype.hasOwnProperty.call(fields, k)) {
      sets.push(`${k} = ?`);
      params.push(fields[k]);
    }
  });

  if (sets.length === 0) {
    return res.status(400).json({ error: "No updatable fields provided" });
  }

  params.push(id); // last param for WHERE

  const sql = `UPDATE products SET ${sets.join(", ")} WHERE id = ?`;

  db.run(sql, params, function (err) {
    if (err) {
      console.error("Update failed:", err);
      return res.status(500).json({ error: err.message });
    }

    if (this.changes === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json({ message: "Product updated", id });
  });
});

// Delete a product by ID
router.delete("/:id", (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;

  db.run(
    `DELETE FROM products WHERE id = ?`,
    [id],
    function (err) {
      if (err) {
        console.error("Delete failed:", err);
        return res.status(500).json({ error: err.message });
      }

      if (this.changes === 0) {
        return res.status(404).json({ message: "Product not found" });
      }

      res.json({ message: "Product deleted", id });
    }
  );
});

/**
 * Import products from Excel file
 * Expects columns: C=GTIN, B=Product, E=Seed Size, F=Package
 * Strategy: UPDATE if GTIN exists, INSERT if new
 * Optional: brand parameter from form data
 */
router.post("/import", upload.single("file"), async (req, res) => {
  const db = req.app.locals.db;

  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    // Get optional brand from form data
    const brand = req.body.brand ? req.body.brand.trim() : null;

    // Parse Excel file
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    // Process rows sequentially
    for (let i = 3; i < data.length; i++) {
      const row = data[i];
      const gtin = (row[2] || "").toString().trim();
      const product = (row[1] || "").toString().trim();
      const seedSize = (row[4] || "").toString().trim();
      const packageType = (row[5] || "").toString().trim();

      // Skip rows without GTIN
      if (!gtin) {
        skipped++;
        continue;
      }

      try {
        // Check if product exists
        await new Promise((resolve, reject) => {
          db.get("SELECT id FROM products WHERE barcode = ?", [gtin], (err, existing) => {
            if (err) return reject(err);

            if (existing) {
              // Update existing product (update brand only if provided)
              const updateSql = brand
                ? `UPDATE products 
                   SET brand = ?, product_code = ?, seed_size = ?, package_type = ? 
                   WHERE barcode = ?`
                : `UPDATE products 
                   SET product_code = ?, seed_size = ?, package_type = ? 
                   WHERE barcode = ?`;
              
              const updateParams = brand
                ? [brand, product, seedSize, packageType, gtin]
                : [product, seedSize, packageType, gtin];

              db.run(updateSql, updateParams, (updateErr) => {
                if (updateErr) return reject(updateErr);
                updated++;
                resolve();
              });
            } else {
              // Insert new product (use provided brand or NULL)
              db.run(
                `INSERT INTO products (barcode, brand, product_code, seed_size, package_type) 
                 VALUES (?, ?, ?, ?, ?)`,
                [gtin, brand, product, seedSize, packageType],
                (insertErr) => {
                  if (insertErr) return reject(insertErr);
                  imported++;
                  resolve();
                }
              );
            }
          });
        });
      } catch (err) {
        errors.push({ row: i + 1, gtin, error: err.message });
      }
    }

    res.json({
      success: true,
      imported,
      updated,
      skipped,
      total: data.length - 3,
      errors
    });
  } catch (err) {
    console.error("Import failed:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
