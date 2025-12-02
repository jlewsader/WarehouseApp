import express from "express";
const router = express.Router();

/**
 * Search products with filters
 */
router.get("/", (req, res) => {
  const db = req.app.locals.db;

  const { brand, product, lot, size, package_type } = req.query;

  let sql = `
    SELECT 
      p.*,
      COALESCE(SUM(i.qty), 0) AS on_hand
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
  if (lot) {
    sql += " AND p.lot LIKE ?";
    params.push(`%${lot}%`);
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

  db.get("SELECT * FROM products WHERE barcode = ?", [code], (err, product) => {
    if (err) return res.status(500).json({ error: err.message });

    if (!product) return res.status(404).json({ message: "Product not found" });

    // Now fetch locations
    db.all(
      `
      SELECT l.label, l.row_index, l.col_index, i.qty, i.owner
      FROM inventory i
      JOIN locations l ON l.id = i.location_id
      WHERE i.product_id = ?
    `,
      [product.id],
      (err, locations) => {
        if (err) return res.status(500).json({ error: err.message });

        res.json({ ...product, locations });
      }
    );
  });
});

export default router;

// Create product
router.post("/", (req, res) => {
  const db = req.app.locals.db;

  const {
    barcode,
    brand,
    product_code,
    lot,
    seed_size,
    package_type
  } = req.body;

  db.run(
    `
    INSERT INTO products (barcode, brand, product_code, lot, seed_size, package_type)
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [barcode, brand, product_code, lot, seed_size, package_type],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Product added", id: this.lastID });
    }
  );
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