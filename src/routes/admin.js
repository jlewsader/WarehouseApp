import express from 'express';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

export default function createAdminRoutes(db) {
  // Apply admin middleware to all routes
  router.use(requireAdmin);

  // ===== DROPDOWN OPTIONS MANAGEMENT =====

  // Get all dropdown options (optionally filter by category)
  router.get('/dropdown-options', (req, res) => {
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
      res.json(rows);
    });
  });

  // Create new dropdown option
  router.post('/dropdown-options', (req, res) => {
    const { category, value, display_order } = req.body;

    if (!category || !value) {
      return res.status(400).json({ error: 'Category and value are required' });
    }

    const order = display_order || 0;

    db.run(
      'INSERT INTO dropdown_options (category, value, display_order) VALUES (?, ?, ?)',
      [category, value, order],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'This option already exists' });
          }
          return res.status(500).json({ error: err.message });
        }
        res.json({ id: this.lastID, category, value, display_order: order });
      }
    );
  });

  // Update dropdown option
  router.put('/dropdown-options/:id', (req, res) => {
    const { id } = req.params;
    const { value, display_order } = req.body;

    if (!value && display_order === undefined) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    let updates = [];
    let params = [];

    if (value) {
      updates.push('value = ?');
      params.push(value);
    }
    if (display_order !== undefined) {
      updates.push('display_order = ?');
      params.push(display_order);
    }

    params.push(id);

    db.run(
      `UPDATE dropdown_options SET ${updates.join(', ')} WHERE id = ?`,
      params,
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Option not found' });
        }
        res.json({ success: true });
      }
    );
  });

  // Delete dropdown option
  router.delete('/dropdown-options/:id', (req, res) => {
    const { id } = req.params;

    db.run('DELETE FROM dropdown_options WHERE id = ?', [id], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Option not found' });
      }
      res.json({ success: true });
    });
  });

  // ===== BULK OPERATIONS =====

  // Clear entire inventory table (preserves products and locations)
  router.post('/clear-inventory', (req, res) => {
    db.run('DELETE FROM inventory', [], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ 
        success: true, 
        deletedCount: this.changes,
        message: `Deleted ${this.changes} inventory records` 
      });
    });
  });

  // Get inventory statistics
  router.get('/stats', (req, res) => {
    const stats = {};
    
    db.get('SELECT COUNT(*) as count FROM inventory', [], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      stats.inventoryCount = row.count;
      
      db.get('SELECT COUNT(*) as count FROM products', [], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        stats.productCount = row.count;
        
        db.get('SELECT COUNT(*) as count FROM locations WHERE id != 9999', [], (err, row) => {
          if (err) return res.status(500).json({ error: err.message });
          stats.locationCount = row.count;
          
          res.json(stats);
        });
      });
    });
  });

  // ===== PRODUCT MANAGEMENT =====

  // Get all products with inventory counts
  router.get('/products', (req, res) => {
    const sql = `
      SELECT 
        p.*,
        COUNT(i.id) as inventory_count
      FROM products p
      LEFT JOIN inventory i ON i.product_id = p.id
      GROUP BY p.id
      ORDER BY p.brand, p.product_code
    `;
    
    db.all(sql, [], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    });
  });

  // Delete product (only if no inventory exists)
  router.delete('/products/:id', (req, res) => {
    const { id } = req.params;

    // Check if product has inventory
    db.get('SELECT COUNT(*) as count FROM inventory WHERE product_id = ?', [id], (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (row.count > 0) {
        return res.status(400).json({ 
          error: `Cannot delete product with ${row.count} inventory record(s)` 
        });
      }

      // Safe to delete
      db.run('DELETE FROM products WHERE id = ?', [id], function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Product not found' });
        }
        res.json({ success: true });
      });
    });
  });

  return router;
}
