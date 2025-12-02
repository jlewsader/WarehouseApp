import express from "express";
const router = express.Router();

/**
 * GET all inventory
 */
router.get("/", (req, res) => {
  const db = req.app.locals.db;

  db.all(
    `
    SELECT 
      i.id,
      i.product_id,
      p.brand,
      p.product_code,
      p.lot,
      p.seed_size,
      p.package_type,
      i.location_id,
      l.label AS location_label,
      l.zone,
      i.owner,
      i.qty
    FROM inventory i
    JOIN products p ON p.id = i.product_id
    JOIN locations l ON l.id = i.location_id
    ORDER BY l.zone, l.row_index, l.col_index
    `,
    [],
    (err, rows) => {
      if (err) {
        console.error("Failed to fetch inventory:", err);
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    }
  );
});

/**
 * GET inventory by location
 */
router.get("/location/:id", (req, res) => {
  const db = req.app.locals.db;
  const id = req.params.id;

  db.all(
    `
    SELECT 
      i.id,
      i.product_id,
      p.brand,
      p.product_code,
      p.lot,
      p.seed_size,
      p.package_type,
      i.location_id,
      l.label AS location_label,
      l.zone,
      i.owner,
      i.qty
    FROM inventory i
    JOIN products p ON p.id = i.product_id
    JOIN locations l ON l.id = i.location_id
    WHERE i.location_id = ?
    ORDER BY i.id
    `,
    [id],
    (err, rows) => {
      if (err) {
        console.error("Failed to fetch location inventory:", err);
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    }
  );
});

/**
 * GET inventory by product
 */
router.get("/product/:id", (req, res) => {
  const db = req.app.locals.db;
  const id = req.params.id;

  db.all(
    `
    SELECT 
      i.id,
      i.product_id,
      p.brand,
      p.product_code,
      p.lot,
      p.seed_size,
      p.package_type,
      i.location_id,
      l.label AS location_label,
      l.zone,
      i.owner,
      i.qty
    FROM inventory i
    JOIN products p ON p.id = i.product_id
    JOIN locations l ON l.id = i.location_id
    WHERE i.product_id = ?
    ORDER BY l.zone, l.row_index, l.col_index
    `,
    [id],
    (err, rows) => {
      if (err) {
        console.error("Failed to fetch product inventory:", err);
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    }
  );
});

/**
 * ADD inventory (place product in a location)
 */
router.post("/", (req, res) => {
  const { product_id, location_id, owner, qty } = req.body;

  if (!product_id || !location_id || !qty) {
    return res.status(400).json({
      error: "product_id, location_id, and qty are required",
    });
  }

  const db = req.app.locals.db;

  db.run(
    `
    INSERT INTO inventory (product_id, location_id, owner, qty)
    VALUES (?, ?, ?, ?)
    `,
    [product_id, location_id, owner || null, qty],
    function (err) {
      if (err) {
        console.error("Failed to insert inventory:", err);
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: "Inventory added", id: this.lastID });
    }
  );
});

/**
 * DELETE inventory entry
 */
router.delete("/:id", (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;

  db.run("DELETE FROM inventory WHERE id = ?", [id], function (err) {
    if (err) {
      console.error("Failed to delete inventory:", err);
      return res.status(500).json({ error: err.message });
    }

    if (this.changes === 0) {
      return res.status(404).json({ message: "Inventory record not found" });
    }

    res.json({ message: "Inventory deleted", id });
  });
});

export default router;