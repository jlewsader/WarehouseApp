import express from "express";
const router = express.Router();

/**
 * List all locations
 */
router.get("/", (req, res) => {
  const db = req.app.locals.db;

  db.all("SELECT * FROM locations", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    res.json(rows);
  });
});

/**
 * Add a location
 */
router.post("/", (req, res) => {
  const db = req.app.locals.db;
  const { label, row_index, col_index, zone } = req.body;

  db.run(
    `
    INSERT INTO locations (label, row_index, col_index, zone)
    VALUES (?, ?, ?, ?)
  `,
    [label, row_index, col_index, zone],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      res.json({ message: "Location added", id: this.lastID });
    }
  );
});

export default router;