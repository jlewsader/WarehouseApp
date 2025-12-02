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