import express from "express";
const router = express.Router();

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
    package_type,
    units_per_package
  } = req.body;

  db.run(
    `
    INSERT INTO products 
      (barcode, brand, product_code, seed_size, package_type, units_per_package)
    VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      barcode, 
      brand, 
      product_code, 
      seed_size, 
      package_type,
      units_per_package || 1
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
  const allowed = ["barcode", "brand", "product_code", "seed_size", "package_type", "units_per_package"];
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

export default router;
