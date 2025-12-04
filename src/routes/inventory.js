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

      // 2) Move all requested inventory rows
      db.serialize(() => {
        const stmt = db.prepare(
          "UPDATE inventory SET location_id = ? WHERE id = ?"
        );

        let movedCount = 0;

        for (const invId of inventory_ids) {
          stmt.run([to_location_id, invId], function (err2) {
            if (err2) {
              console.error("Failed to move inventory id", invId, err2);
              // we do not early-return here, we log and continue
            } else if (this.changes > 0) {
              movedCount++;
            }
          });
        }

        stmt.finalize((err3) => {
          if (err3) {
            console.error("Failed to finalize move statement:", err3);
            return res.status(500).json({ error: "Failed to complete move" });
          }

          if (movedCount === 0) {
            return res
              .status(404)
              .json({ message: "No inventory records were moved" });
          }

          res.json({
            message: "Inventory moved",
            moved: movedCount,
            to_location_id
          });
        });
      });
    }
  );
});

/**
 * ADD inventory to UNASSIGNED location (receiving intake)
 * Body: { product_id, qty, owner }
 */
router.post("/unassigned", (req, res) => {
  const db = req.app.locals.db;
  const { product_id, qty, owner } = req.body;

  if (!product_id || !qty) {
    return res
      .status(400)
      .json({ error: "product_id and qty are required." });
  }

  const UNASSIGNED_ID = 9999;

  db.run(
    `
    INSERT INTO inventory (product_id, location_id, owner, qty)
    VALUES (?, ?, ?, ?)
    `,
    [product_id, UNASSIGNED_ID, owner || "Keystone", qty],
    function (err) {
      if (err) {
        console.error("Failed to insert unassigned inventory:", err);
        return res.status(500).json({ error: err.message });
      }

      res.json({
        message: "Inventory added to UNASSIGNED",
        id: this.lastID,
        product_id,
        location_id: UNASSIGNED_ID,
      });
    }
  );
});

/**
 * GET all UNASSIGNED inventory
 */
router.get("/unassigned", (req, res) => {
  const db = req.app.locals.db;
  const UNASSIGNED_ID = 9999;

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
    ORDER BY i.id DESC
    `,
    [UNASSIGNED_ID],
    (err, rows) => {
      if (err) {
        console.error("Failed to fetch unassigned inventory:", err);
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    }
  );
});

// Receive inventory into UNASSIGNED area
router.post("/receive", (req, res) => {
  const db = req.app.locals.db;
  const { product_id, qty, owner } = req.body;

  if (!product_id || !qty) {
    return res.status(400).json({ error: "Missing product_id or qty" });
  }

  db.run(
    `
    INSERT INTO inventory (product_id, qty, owner, location_id)
    VALUES (?, ?, ?, 9999)
    `,
    [product_id, qty, owner || "Keystone"],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      res.json({ message: "Inventory received", id: this.lastID });
    }
  );
});



export default router;