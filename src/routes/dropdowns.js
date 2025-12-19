import express from 'express';

const router = express.Router();

export default function createDropdownRoutes(db) {
  // Public endpoint to get dropdown options (no auth required)
  router.get('/options', (req, res) => {
    const { category } = req.query;
    
    let sql = 'SELECT * FROM dropdown_options';
    let params = [];
    
    if (category) {
      sql += ' WHERE category = ?';
      params.push(category);
    }
    
    sql += ' ORDER BY category, display_order, value';
    
    db.all(sql, params, (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      // Group by category for easier frontend consumption
      const grouped = {};
      rows.forEach(row => {
        if (!grouped[row.category]) {
          grouped[row.category] = [];
        }
        grouped[row.category].push(row.value);
      });
      
      res.json(grouped);
    });
  });

  return router;
}
