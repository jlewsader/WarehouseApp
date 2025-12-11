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
      i.owner
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
      i.lot,
      p.seed_size,
      p.package_type,
      i.location_id,
      l.label AS location_label,
      l.zone,
      i.owner
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
      i.owner
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
  const { product_id, location_id, owner, qty, lot } = req.body;

  if (!product_id || !location_id || !qty) {
    return res.status(400).json({
      error: "product_id, location_id, and qty are required",
    });
  }

  const db = req.app.locals.db;
  const qtyNum = parseInt(qty, 10);

  if (qtyNum <= 0) {
    return res.status(400).json({ error: "qty must be greater than 0" });
  }

  // Insert N rows (one per unit)
  db.serialize(() => {
    const stmt = db.prepare(
      `INSERT INTO inventory (product_id, location_id, lot, owner)
       VALUES (?, ?, ?, ?)`
    );

    let insertedCount = 0;

    for (let i = 0; i < qtyNum; i++) {
      stmt.run(
        [product_id, location_id, lot || null, owner || null],
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
        console.error("Failed to finalize insert:", err);
        return res.status(500).json({ error: err.message });
      }

      res.json({
        message: "Inventory added",
        qty_inserted: insertedCount,
        product_id,
        location_id,
      });
    });
  });
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
router.post("/move", (req, res) => {
  const db = req.app.locals.db;
  const { inventory_ids, to_location_id } = req.body;

  if (!Array.isArray(inventory_ids) || inventory_ids.length === 0) {
    return res.status(400).json({ error: "inventory_ids must be a non-empty array" });
  }
  if (!to_location_id) {
    return res.status(400).json({ error: "to_location_id is required" });
  }

  // 1) Ensure destination location exists
  db.get(
    "SELECT id FROM locations WHERE id = ?",
    [to_location_id],
    (err, location) => {
      if (err) {
        console.error("Failed to validate location:", err);
        return res.status(500).json({ error: err.message });
      }
      if (!location) {
        return res.status(400).json({ error: "Destination location does not exist" });
      }

      // 2) Check if destination location already has items (enforce 1 item per location)
      db.get(
        "SELECT COUNT(*) as count FROM inventory WHERE location_id = ?",
        [to_location_id],
        (err2, result) => {
          if (err2) {
            console.error("Failed to check location inventory:", err2);
            return res.status(500).json({ error: err2.message });
          }

          if (result.count > 0) {
            return res.status(400).json({
              error: `Location already contains ${result.count} item(s). Stacking is not allowed. Choose another location.`,
            });
          }

          // 3) Move all requested inventory rows
          db.serialize(() => {
            const stmt = db.prepare(
              "UPDATE inventory SET location_id = ? WHERE id = ?"
            );

            let movedCount = 0;

            for (const invId of inventory_ids) {
              stmt.run([to_location_id, invId], function (err3) {
                if (err3) {
                  console.error("Failed to move inventory id", invId, err3);
                } else if (this.changes > 0) {
                  movedCount++;
                }
              });
            }

            stmt.finalize((err4) => {
              if (err4) {
                console.error("Failed to finalize move statement:", err4);
                return res.status(500).json({ error: "Failed to complete move" });
              }

              if (movedCount === 0) {
                return res.status(404).json({ message: "No inventory records were moved" });
              }

              res.json({
                message: "Inventory moved",
                moved: movedCount,
                to_location_id,
              });
            });
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
       VALUES (?, ?, ?, ?)`
    );

    let insertedCount = 0;

    for (let i = 0; i < qtyNum; i++) {
      stmt.run(
        [product_id, UNASSIGNED_ID, lot || null, owner || "Keystone"],
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
      p.units_per_package
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
       VALUES (?, ?, ?, ?)`
    );

    let insertedCount = 0;

    for (let i = 0; i < qtyNum; i++) {
      stmt.run(
        [product_id, 9999, lot || null, owner || "Keystone"],
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

export default router;