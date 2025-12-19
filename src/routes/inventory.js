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
      i.lot,
      p.seed_size,
      p.package_type,
      i.location_id,
      l.label AS location_label,
      l.zone,
      i.owner,
      i.staged
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
 * Search inventory by product attributes and lot
 */
router.get("/search", (req, res) => {
  const db = req.app.locals.db;
  const { brand, product, size, package_type, lot } = req.query;

  let sql = `
    SELECT
      i.id,
      i.product_id,
      p.brand,
      p.product_code,
      i.lot,
      p.seed_size,
      p.package_type,
      i.location_id,
      l.label AS location_label,
      l.zone,
      i.owner,
      i.staged
    FROM inventory i
    JOIN products p ON p.id = i.product_id
    JOIN locations l ON l.id = i.location_id
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
  if (lot) {
    sql += " AND i.lot LIKE ?";
    params.push(`%${lot}%`);
  }

  sql += " ORDER BY l.zone, l.row_index, l.col_index";

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error("Failed to search inventory:", err);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
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
      i.lot,
      p.seed_size,
      p.package_type,
      i.location_id,
      l.label AS location_label,
      l.zone,
      i.owner,
      i.staged
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
      i.lot,
      p.seed_size,
      p.package_type,
      i.location_id,
      l.label AS location_label,
      l.zone,
      i.owner,
      i.staged
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
 * Creates N inventory rows for qty N
 * Accepts: { product_id, location_id, owner, qty, lot }
 */
router.post("/", (req, res) => {
  const db = req.app.locals.db;

  const { product_id, lot, owner } = req.body;

  if (!product_id) {
    return res.status(400).json({
      error: "product_id is required"
    });
  }

  const location_id = 9999; // UNASSIGNED by default

  db.run(
    `
    INSERT INTO inventory (product_id, lot, owner, location_id)
    VALUES (?, ?, ?, ?)
    `,
    [product_id, lot || null, owner || null, location_id],
    function (err) {
      if (err) {
        console.error("Inventory insert failed:", err);
        return res.status(500).json({ error: err.message });
      }

      res.json({
        message: "Inventory added",
        id: this.lastID,
        location_id
      });
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

/**
 * MOVE inventory records to a new location
 * Body: { inventory_ids: [1,2,3], to_location_id: 123 }
 */
// POST /api/inventory/move
router.post("/move", (req, res) => {
  const db = req.app.locals.db;
  const { inventory_id, location_id } = req.body;

  if (!inventory_id || !location_id) {
    return res.status(400).json({
      error: "inventory_id and location_id are required"
    });
  }

  // 1 Ensure target location is empty
  db.get(
    "SELECT id FROM inventory WHERE location_id = ?",
    [location_id],
    (err, existing) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "DB error" });
      }

      if (existing) {
        return res.status(400).json({
          error: "Location already occupied"
        });
      }

      // 2 Move inventory item
      db.run(
        "UPDATE inventory SET location_id = ? WHERE id = ?",
        [location_id, inventory_id],
        function (err2) {
          if (err2) {
            console.error(err2);
            return res.status(500).json({ error: "Move failed" });
          }

          if (this.changes === 0) {
            return res.status(404).json({
              error: "Inventory item not found"
            });
          }

          res.json({
            message: "Inventory moved",
            inventory_id,
            location_id
          });
        }
      );
    }
  );
});
/**
 * ADD inventory to UNASSIGNED location (receiving intake)
 * Creates N inventory rows for qty N
 * Body: { product_id, qty, owner, lot }
 */
router.post("/unassigned", (req, res) => {
  const db = req.app.locals.db;
  const { product_id, qty, owner, lot } = req.body;

  if (!product_id || !qty) {
    return res.status(400).json({ error: "product_id and qty are required." });
  }

  const qtyNum = parseInt(qty, 10);

  if (qtyNum <= 0) {
    return res.status(400).json({ error: "qty must be greater than 0" });
  }

  const UNASSIGNED_ID = 9999;

  // Insert N rows (one per unit)
  db.serialize(() => {
    const stmt = db.prepare(
      `INSERT INTO inventory (product_id, location_id, lot, owner)
       VALUES (?, 9999, ?, ?)`
    );

    let insertedCount = 0;

    for (let i = 0; i < qtyNum; i++) {
      stmt.run(
          [product_id, lot || null, owner || "Keystone"],        
          function (err) {
          if (err) {
            console.error("Failed to insert unassigned inventory:", err);
          } else {
            insertedCount++;
          }
        }
      );
    }

    stmt.finalize((err) => {
      if (err) {
        console.error("Failed to finalize unassigned insert:", err);
        return res.status(500).json({ error: err.message });
      }

      res.json({
        message: "Inventory added to UNASSIGNED",
        qty_inserted: insertedCount,
        product_id,
        location_id: UNASSIGNED_ID,
      });
    });
  });
});

/**
 * GET all UNASSIGNED inventory
 */
router.get("/unassigned", (req, res) => {
  const db = req.app.locals.db;

  const sql = `
    SELECT 
      i.id,
      i.product_id,
      i.owner,
      i.location_id,
      p.brand,
      p.product_code,
      i.lot,
      p.seed_size,
      p.package_type,
      p.units_per_package,
      i.staged
    FROM inventory i
    JOIN products p ON p.id = i.product_id
    WHERE i.location_id = 9999
    ORDER BY i.id DESC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

/**
 * Receive inventory into UNASSIGNED area (creates N rows for qty N)
 * Body: { product_id, qty, owner, lot }
 */
router.post("/receive", (req, res) => {
  const db = req.app.locals.db;
  const { product_id, qty, owner, lot } = req.body;

  if (!product_id || !qty) {
    return res.status(400).json({ error: "Missing product_id or qty" });
  }

  const qtyNum = parseInt(qty, 10);

  if (qtyNum <= 0) {
    return res.status(400).json({ error: "qty must be greater than 0" });
  }

  // Insert N rows (one per unit)
  db.serialize(() => {
    const stmt = db.prepare(
      `INSERT INTO inventory (product_id, location_id, lot, owner)
       VALUES (?, 9999, ?, ?)`
    );

    let insertedCount = 0;

    for (let i = 0; i < qtyNum; i++) {
      stmt.run(
        [product_id, lot || null, owner || "Keystone"],
          function (err) {
          if (err) {
            console.error("Failed to insert inventory:", err);
          } else {
            insertedCount++;
          }
        }
      );
    }

    stmt.finalize((err) => {
      if (err) {
        console.error("Failed to finalize receive:", err);
        return res.status(500).json({ error: err.message });
      }

      res.json({
        message: "Inventory received",
        qty_inserted: insertedCount,
        product_id,
      });
    });
  });
});

/**
 * STAGE inventory items for a customer
 * Body: { inventory_ids: [1,2,3], customer: "CustomerName" }
 */
router.post("/stage", (req, res) => {
  const db = req.app.locals.db;
  const { inventory_ids, customer } = req.body;

  if (!inventory_ids || !Array.isArray(inventory_ids) || inventory_ids.length === 0) {
    return res.status(400).json({ error: "inventory_ids array is required" });
  }

  if (!customer || customer.trim() === "") {
    return res.status(400).json({ error: "customer name is required" });
  }

  const placeholders = inventory_ids.map(() => "?").join(",");
  const sql = `UPDATE inventory SET staged = 1, owner = ? WHERE id IN (${placeholders})`;
  const params = [customer, ...inventory_ids];

  db.run(sql, params, function (err) {
    if (err) {
      console.error("Failed to stage inventory:", err);
      return res.status(500).json({ error: err.message });
    }

    res.json({
      message: "Inventory staged",
      staged_count: this.changes,
      customer
    });
  });
});

/**
 * UNSTAGE inventory items
 * Body: { inventory_ids: [1,2,3] }
 */
router.post("/unstage", (req, res) => {
  const db = req.app.locals.db;
  const { inventory_ids } = req.body;

  if (!inventory_ids || !Array.isArray(inventory_ids) || inventory_ids.length === 0) {
    return res.status(400).json({ error: "inventory_ids array is required" });
  }

  const placeholders = inventory_ids.map(() => "?").join(",");
  const sql = `UPDATE inventory SET staged = 0, owner = NULL WHERE id IN (${placeholders})`;

  db.run(sql, inventory_ids, function (err) {
    if (err) {
      console.error("Failed to unstage inventory:", err);
      return res.status(500).json({ error: err.message });
    }

    res.json({
      message: "Inventory unstaged",
      unstaged_count: this.changes
    });
  });
});

export default router;