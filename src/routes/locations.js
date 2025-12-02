import express from "express";
const router = express.Router();

/**
 * GET all locations
 */
router.get("/", (req, res) => {
  const db = req.app.locals.db;
  db.all(
    "SELECT * FROM locations ORDER BY zone, row_index, col_index",
    [],
    (err, rows) => {
      if (err) {
        console.error("Failed to fetch locations:", err);
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    }
  );
});

/**
 * GET locations by zone
 */
router.get("/zone/:zone", (req, res) => {
  const db = req.app.locals.db;
  const { zone } = req.params;

  db.all(
    "SELECT * FROM locations WHERE zone = ? ORDER BY row_index, col_index",
    [zone],
    (err, rows) => {
      if (err) {
        console.error("Failed to fetch locations by zone:", err);
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    }
  );
});

/**
 * CREATE a single location
 */
router.post("/", (req, res) => {
  const db = req.app.locals.db;

  const { label, row_index, col_index, zone } = req.body;

  if (!label || row_index == null || col_index == null) {
    return res
      .status(400)
      .json({ error: "label, row_index, and col_index are required." });
  }

  db.run(
    `
      INSERT INTO locations (label, row_index, col_index, zone)
      VALUES (?, ?, ?, ?)
    `,
    [label, row_index, col_index, zone || null],
    function (err) {
      if (err) {
        console.error("Failed to insert location:", err);
        return res.status(500).json({ error: err.message });
      }

      res.json({
        message: "Location added",
        id: this.lastID,
      });
    }
  );
});

/**
 * DELETE a single location
 */
router.delete("/:id", (req, res) => {
  const db = req.app.locals.db;
  const { id } = req.params;

  db.run("DELETE FROM locations WHERE id = ?", [id], function (err) {
    if (err) {
      console.error("Failed to delete location:", err);
      return res.status(500).json({ error: err.message });
    }

    if (this.changes === 0) {
      return res.status(404).json({ message: "Location not found" });
    }

    res.json({ message: "Location deleted", id });
  });
});

/**
 * GENERATE ALL BLOCK LOCATIONS:
 * - Center: 25 rows, 5 stacks, 3 high
 * - East Wall: 23 rows, 2 stacks, 3 high
 * - West Wall: 24 rows, 3 stacks, 3 high
 */
router.post("/generate-all", (req, res) => {
  const db = req.app.locals.db;

  const blocks = [
    { prefix: "C", zone: "Center", rows: 25, cols: 5 },
    { prefix: "E", zone: "East Wall", rows: 23, cols: 2 },
    { prefix: "W", zone: "West Wall", rows: 24, cols: 3 },
  ];

  const levels = ["T", "M", "B"];

  // Clear existing locations before generating
  db.run("DELETE FROM locations", [], (err) => {
    if (err) {
      console.error("Failed to clear locations:", err);
      return res.status(500).json({ error: "Failed to clear locations" });
    }

    const stmt = db.prepare(`
      INSERT INTO locations (label, row_index, col_index, zone)
      VALUES (?, ?, ?, ?)
    `);

    let total = 0;

    for (const block of blocks) {
      for (let r = 1; r <= block.rows; r++) {
        for (let c = 1; c <= block.cols; c++) {
          for (const lvl of levels) {
            const label = `${block.prefix}-R${r}-C${c}-${lvl}`;
            stmt.run([label, r, c, block.zone]);
            total++;
          }
        }
      }
    }

    stmt.finalize((err2) => {
      if (err2) {
        console.error("Failed to finalize location inserts:", err2);
        return res.status(500).json({ error: "Failed to finalize inserts" });
      }

      res.json({
        message: "All warehouse blocks generated.",
        total_locations: total,
      });
    });
  });
});

export default router;