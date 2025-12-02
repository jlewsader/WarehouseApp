import express from "express";
const router = express.Router();

/**
 * Add inventory
 */
router.post("/", (req, res) => {
  const db = req.app.locals.db;
  const { location_id, product_id, owner, qty } = req.body;

  db.run(
    `
    INSERT INTO inventory (location_id, product_id, owner, qty)
    VALUES (?, ?, ?, ?)
  `,
    [location_id, product_id, owner, qty],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Inventory added", id: this.lastID });
    }
  );
});

/**
 * Move inventory
 */
router.patch("/move", (req, res) => {
  const db = req.app.locals.db;
  const { inventory_id, new_location_id } = req.body;

  db.run(
    `UPDATE inventory SET location_id = ? WHERE id = ?`,
    [new_location_id, inventory_id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Inventory moved" });
    }
  );
});

/**
 * Delete inventory entry
 */
router.delete("/:id", (req, res) => {
  const db = req.app.locals.db;

  db.run(
    `DELETE FROM inventory WHERE id = ?`,
    [req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Inventory removed" });
    }
  );
});

export default router;