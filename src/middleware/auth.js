import bcrypt from 'bcrypt';

// Middleware to check if user is authenticated
export function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

// Middleware to check if user has admin role
export function requireAdmin(req, res, next) {
  if (req.session && req.session.userId && req.session.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Forbidden - Admin access required' });
  }
}

// Create auth routes
export function createAuthRoutes(db) {
  return {
    // Login endpoint
    login: (req, res) => {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
      }

      db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        if (!user) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        try {
          const match = await bcrypt.compare(password, user.password_hash);
          if (!match) {
            return res.status(401).json({ error: 'Invalid credentials' });
          }

          // Set session
          req.session.userId = user.id;
          req.session.username = user.username;
          req.session.role = user.role;

          res.json({
            success: true,
            user: {
              id: user.id,
              username: user.username,
              role: user.role
            }
          });
        } catch (error) {
          res.status(500).json({ error: 'Authentication error' });
        }
      });
    },

    // Logout endpoint
    logout: (req, res) => {
      req.session.destroy((err) => {
        if (err) {
          return res.status(500).json({ error: 'Logout failed' });
        }
        res.json({ success: true });
      });
    },

    // Check session status
    checkAuth: (req, res) => {
      if (req.session && req.session.userId) {
        res.json({
          authenticated: true,
          user: {
            id: req.session.userId,
            username: req.session.username,
            role: req.session.role
          }
        });
      } else {
        res.json({ authenticated: false });
      }
    }
  };
}

// Helper function to hash passwords
export async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}
