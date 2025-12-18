const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const webpush = require('web-push');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

app.use(cors());
app.use(express.json());

// Initialize database
const dbPath = path.join(__dirname, 'emergency.db');
const db = new sqlite3.Database(dbPath);

// Initialize database tables
db.serialize(() => {
  // Departments table
  db.run(`CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#3b82f6',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Emergency personnel users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    name TEXT NOT NULL,
    department_id INTEGER,
    permissions TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id)
  )`);
  
  // Add department_id column if it doesn't exist
  db.run(`ALTER TABLE users ADD COLUMN department_id INTEGER`, (err) => {
    // Ignore error if column already exists
  });
  
  // Add permissions column if it doesn't exist
  db.run(`ALTER TABLE users ADD COLUMN permissions TEXT`, (err) => {
    // Ignore error if column already exists
  });

  // Emergency reports table (public submissions)
  db.run(`CREATE TABLE IF NOT EXISTS emergency_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    location TEXT NOT NULL,
    description TEXT,
    reporter_name TEXT,
    reporter_phone TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    assigned_to INTEGER,
    department_id INTEGER,
    FOREIGN KEY (assigned_to) REFERENCES users(id),
    FOREIGN KEY (department_id) REFERENCES departments(id)
  )`);
  
  // Add department_id column if it doesn't exist
  db.run(`ALTER TABLE emergency_reports ADD COLUMN department_id INTEGER`, (err) => {
    // Ignore error if column already exists
  });
  
  // Create default departments
  db.run(`INSERT OR IGNORE INTO departments (name, description, color) 
    VALUES ('Fire', 'Fire Department', '#dc2626')`);
  db.run(`INSERT OR IGNORE INTO departments (name, description, color) 
    VALUES ('Police', 'Police Department', '#3b82f6')`);
  db.run(`INSERT OR IGNORE INTO departments (name, description, color) 
    VALUES ('EMS', 'Emergency Medical Services', '#10b981')`);
  db.run(`INSERT OR IGNORE INTO departments (name, description, color) 
    VALUES ('Dispatch', 'Dispatch Center', '#f59e0b')`);
  db.run(`INSERT OR IGNORE INTO departments (name, description, color) 
    VALUES ('Search and Rescue', 'Search and Rescue Team', '#059669')`);

  // Public alerts table
  db.run(`CREATE TABLE IF NOT EXISTS public_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT DEFAULT 'info',
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    FOREIGN KEY (created_by) REFERENCES users(id)
  )`);

  // Closed areas table
  db.run(`CREATE TABLE IF NOT EXISTS closed_areas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    address TEXT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    radius REAL DEFAULT 500,
    reason TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY (created_by) REFERENCES users(id)
  )`);
  
  // Add address column if it doesn't exist (for existing databases)
  db.run(`ALTER TABLE closed_areas ADD COLUMN address TEXT`, (err) => {
    // Ignore error if column already exists
  });

  // Parade routes table
  db.run(`CREATE TABLE IF NOT EXISTS parade_routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    address TEXT,
    coordinates TEXT NOT NULL,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY (created_by) REFERENCES users(id)
  )`);
  
  // Add address column if it doesn't exist
  db.run(`ALTER TABLE parade_routes ADD COLUMN address TEXT`, (err) => {
    // Ignore error if column already exists
  });

  // Detours table
  db.run(`CREATE TABLE IF NOT EXISTS detours (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    address TEXT,
    coordinates TEXT NOT NULL,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY (created_by) REFERENCES users(id)
  )`);
  
  // Add address column if it doesn't exist
  db.run(`ALTER TABLE detours ADD COLUMN address TEXT`, (err) => {
    // Ignore error if column already exists
  });

  // Callouts table (MCI mass callouts)
  db.run(`CREATE TABLE IF NOT EXISTS callouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    department_id INTEGER NOT NULL,
    location TEXT,
    priority TEXT DEFAULT 'high',
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    is_active INTEGER DEFAULT 1,
    acknowledged_by TEXT,
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
  )`);

  // Push subscriptions table
  db.run(`CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT UNIQUE NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Chat messages table
  db.run(`CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message TEXT NOT NULL,
    department_id INTEGER,
    user_id INTEGER NOT NULL,
    user_name TEXT NOT NULL,
    department_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // Closed roads table
  db.run(`CREATE TABLE IF NOT EXISTS closed_roads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    address TEXT,
    coordinates TEXT NOT NULL,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY (created_by) REFERENCES users(id)
  )`);

  // Create default admin user (password: admin123)
  // First check if admin exists, if not create it, if it exists but password might be wrong, update it
  db.get('SELECT * FROM users WHERE username = ?', ['admin'], (err, existingUser) => {
    if (err) {
      console.error('Error checking for admin user:', err);
      return;
    }
    
    const defaultPassword = bcrypt.hashSync('admin123', 10);
    
    if (!existingUser) {
      // Create admin user
      db.run(`INSERT INTO users (username, password, role, name) 
        VALUES (?, ?, ?, ?)`, ['admin', defaultPassword, 'admin', 'Administrator'], function(err) {
        if (err) {
          console.error('Error creating default admin user:', err);
        } else {
          console.log('✅ Default admin user created: username=admin, password=admin123');
        }
      });
    } else {
      // Admin exists, verify password works
      bcrypt.compare('admin123', existingUser.password, (err, match) => {
        if (err || !match) {
          // Password doesn't match, update it
          console.log('Admin user exists but password is incorrect. Resetting password...');
          db.run('UPDATE users SET password = ? WHERE username = ?', [defaultPassword, 'admin'], function(err) {
            if (err) {
              console.error('Error resetting admin password:', err);
            } else {
              console.log('✅ Admin password reset: username=admin, password=admin123');
            }
          });
        } else {
          console.log('✅ Default admin user exists and password is correct');
          console.log('   Login with: username=admin, password=admin123');
        }
      });
    }
  });
});

// Initialize VAPID keys for web push
// In production, generate keys with: npx web-push generate-vapid-keys
// and store them in .env file
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

// Only set VAPID details if keys are provided
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(
      'mailto:admin@adlc-emergency.com',
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );
    console.log('VAPID keys configured for push notifications');
  } catch (error) {
    console.warn('Warning: Invalid VAPID keys. Push notifications will be disabled.', error.message);
  }
} else {
  console.log('VAPID keys not configured. Push notifications will be disabled.');
  console.log('To enable push notifications, run: npx web-push generate-vapid-keys');
  console.log('Then add the keys to your .env file as VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY');
}

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Auth Routes
app.post('/api/auth/login', (req, res) => {
  console.log('=== LOGIN REQUEST ===');
  console.log('Request body:', JSON.stringify(req.body));
  console.log('Headers:', JSON.stringify(req.headers));
  
  const { username, password } = req.body;

  if (!username || !password) {
    console.log('Login failed: Missing username or password');
    return res.status(400).json({ error: 'Username and password are required' });
  }

  console.log('Looking up user:', username);
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      console.error('Database error during login:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (!user) {
      console.log('Login failed: User not found -', username);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('User found, comparing password...');
    bcrypt.compare(password, user.password, (err, match) => {
      if (err) {
        console.error('Password comparison error:', err);
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      if (!match) {
        console.log('Login failed: Password mismatch for user -', username);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      console.log('✅ Login successful for user:', username);

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          name: user.name
        }
      });
    });
  });
});

// Public Routes
app.get('/api/public/alerts', (req, res) => {
  const now = new Date().toISOString();
  db.all(
    `SELECT * FROM public_alerts 
     WHERE expires_at IS NULL OR expires_at > ?
     ORDER BY created_at DESC
     LIMIT 20`,
    [now],
    (err, alerts) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch alerts' });
      }
      res.json(alerts);
    }
  );
});

app.get('/api/public/closed-areas', (req, res) => {
  const now = new Date().toISOString();
  db.all(
    `SELECT * FROM closed_areas 
     WHERE is_active = 1 
     AND (expires_at IS NULL OR expires_at > ?)
     ORDER BY created_at DESC`,
    [now],
    (err, areas) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch closed areas' });
      }
      res.json(areas);
    }
  );
});

app.get('/api/public/parade-routes', (req, res) => {
  const now = new Date().toISOString();
  db.all(
    `SELECT * FROM parade_routes 
     WHERE is_active = 1 
     AND (expires_at IS NULL OR expires_at > ?)
     ORDER BY created_at DESC`,
    [now],
    (err, routes) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch parade routes' });
      }
      // Parse coordinates JSON
      const parsedRoutes = routes.map(route => ({
        ...route,
        coordinates: JSON.parse(route.coordinates)
      }));
      res.json(parsedRoutes);
    }
  );
});

app.get('/api/public/detours', (req, res) => {
  const now = new Date().toISOString();
  db.all(
    `SELECT * FROM detours 
     WHERE is_active = 1 
     AND (expires_at IS NULL OR expires_at > ?)
     ORDER BY created_at DESC`,
    [now],
    (err, detours) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch detours' });
      }
      // Parse coordinates JSON
      const parsedDetours = detours.map(detour => ({
        ...detour,
        coordinates: JSON.parse(detour.coordinates)
      }));
      res.json(parsedDetours);
    }
  );
});

app.get('/api/public/closed-roads', (req, res) => {
  const now = new Date().toISOString();
  db.all(
    `SELECT * FROM closed_roads 
     WHERE is_active = 1 
     AND (expires_at IS NULL OR expires_at > ?)
     ORDER BY created_at DESC`,
    [now],
    (err, roads) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch closed roads' });
      }
      // Parse coordinates JSON
      const parsedRoads = roads.map(road => ({
        ...road,
        coordinates: JSON.parse(road.coordinates)
      }));
      res.json(parsedRoads);
    }
  );
});

// Protected Routes (Emergency Personnel)

app.post('/api/personnel/alerts', authenticateToken, (req, res) => {
  const { title, message, severity, expires_at, send_push } = req.body;

  if (!title || !message) {
    return res.status(400).json({ error: 'Title and message are required' });
  }

  let expiresAtValue = null;
  if (expires_at) {
    try {
      expiresAtValue = new Date(expires_at).toISOString();
    } catch (e) {
      return res.status(400).json({ error: 'Invalid expiration date format' });
    }
  }

  db.run(
    `INSERT INTO public_alerts (title, message, severity, created_by, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [title, message, severity || 'info', req.user.id, expiresAtValue],
    function(err) {
      if (err) {
        console.error('Database error creating alert:', err);
        return res.status(500).json({ error: err.message || 'Failed to create alert' });
      }
      const alertId = this.lastID;
      
      // Send push notifications if requested
      if (send_push) {
        sendPushNotificationToAll(title, message, severity || 'info');
      }
      
      res.json({ 
        success: true, 
        message: 'Alert created successfully',
        alertId: alertId 
      });
    }
  );
});

// Helper function to send push notification to all subscribers
function sendPushNotificationToAll(title, message, severity) {
  // Check if VAPID keys are configured
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.log('Push notifications disabled: VAPID keys not configured');
    return;
  }

  db.all('SELECT endpoint, p256dh, auth FROM push_subscriptions', [], (err, subscriptions) => {
    if (err) {
      console.error('Error fetching push subscriptions:', err);
      return;
    }

    if (subscriptions.length === 0) {
      console.log('No push subscriptions found');
      return;
    }

    console.log(`Found ${subscriptions.length} subscription(s) to notify`);

    const payload = JSON.stringify({
      title: title,
      message: message,
      severity: severity,
      icon: '/favicon.ico',
      badge: '/favicon.ico'
    });

    const notifications = subscriptions.map(sub => {
      // Verify subscription data is valid
      if (!sub.endpoint || !sub.p256dh || !sub.auth) {
        console.error('Invalid subscription data:', sub);
        return Promise.reject(new Error('Invalid subscription data'));
      }

      const subscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };

      return webpush.sendNotification(subscription, payload)
        .then(() => {
          console.log(`✅ Push notification sent successfully to: ${sub.endpoint.substring(0, 50)}...`);
        })
        .catch(err => {
          // If subscription is invalid, remove it from database
          if (err.statusCode === 410 || err.statusCode === 404) {
            db.run('DELETE FROM push_subscriptions WHERE endpoint = ?', [sub.endpoint], (deleteErr) => {
              if (deleteErr) {
                console.error('Error deleting invalid subscription:', deleteErr);
              } else {
                console.log(`🗑️ Removed invalid subscription: ${sub.endpoint.substring(0, 50)}...`);
              }
            });
          } else {
            console.error(`❌ Error sending push notification to ${sub.endpoint.substring(0, 50)}...:`, err.message || err);
          }
        });
    });

    Promise.allSettled(notifications).then((results) => {
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      console.log(`📊 Push notification summary: ${successful} successful, ${failed} failed out of ${subscriptions.length} total`);
    });
  });
}

app.get('/api/personnel/users', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  db.all(
    `SELECT u.id, u.username, u.role, u.name, u.department_id, u.permissions, u.created_at, 
            d.name as department_name, d.color as department_color
     FROM users u
     LEFT JOIN departments d ON u.department_id = d.id
     ORDER BY u.created_at DESC`,
    (err, users) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch users' });
      }
      // Parse permissions JSON
      const parsedUsers = users.map(user => ({
        ...user,
        permissions: user.permissions ? JSON.parse(user.permissions) : null
      }));
      res.json(parsedUsers);
    }
  );
});

app.post('/api/personnel/users', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { username, password, role, name, department_id } = req.body;

  if (!username || !password || !role || !name) {
    return res.status(400).json({ error: 'Username, password, role, and name are required' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  db.run(
    `INSERT INTO users (username, password, role, name, department_id)
     VALUES (?, ?, ?, ?, ?)`,
    [username, hashedPassword, role, name, department_id || null],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint')) {
          return res.status(400).json({ error: 'Username already exists' });
        }
        console.error('Database error creating user:', err);
        return res.status(500).json({ error: err.message || 'Failed to create user' });
      }
      res.json({ 
        success: true, 
        message: 'User created successfully',
        userId: this.lastID 
      });
    }
  );
});

app.put('/api/personnel/users/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { id } = req.params;
  const { role, name, department_id, password } = req.body;

  const updates = [];
  const values = [];

  if (role) {
    updates.push('role = ?');
    values.push(role);
  }
  if (name) {
    updates.push('name = ?');
    values.push(name);
  }
  if (department_id !== undefined) {
    updates.push('department_id = ?');
    values.push(department_id || null);
  }
  if (password) {
    updates.push('password = ?');
    values.push(bcrypt.hashSync(password, 10));
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No updates provided' });
  }

  values.push(id);

  db.run(
    `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
    values,
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to update user' });
      }
      res.json({ success: true, message: 'User updated successfully' });
    }
  );
});

app.delete('/api/personnel/users/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { id } = req.params;

  // Don't allow deleting yourself
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  db.run('DELETE FROM users WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete user' });
    }
    res.json({ success: true, message: 'User deleted successfully' });
  });
});

// Departments Management
app.get('/api/personnel/departments', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  db.all(
    'SELECT * FROM departments ORDER BY name',
    (err, departments) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch departments' });
      }
      res.json(departments);
    }
  );
});

app.post('/api/personnel/departments', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { name, description, color } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Department name is required' });
  }

  db.run(
    `INSERT INTO departments (name, description, color)
     VALUES (?, ?, ?)`,
    [name, description || '', color || '#3b82f6'],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint')) {
          return res.status(400).json({ error: 'Department name already exists' });
        }
        console.error('Database error creating department:', err);
        return res.status(500).json({ error: err.message || 'Failed to create department' });
      }
      res.json({ 
        success: true, 
        message: 'Department created successfully',
        departmentId: this.lastID 
      });
    }
  );
});

app.put('/api/personnel/departments/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { id } = req.params;
  const { name, description, color } = req.body;

  const updates = [];
  const values = [];

  if (name) {
    updates.push('name = ?');
    values.push(name);
  }
  if (description !== undefined) {
    updates.push('description = ?');
    values.push(description);
  }
  if (color) {
    updates.push('color = ?');
    values.push(color);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No updates provided' });
  }

  values.push(id);

  db.run(
    `UPDATE departments SET ${updates.join(', ')} WHERE id = ?`,
    values,
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to update department' });
      }
      res.json({ success: true, message: 'Department updated successfully' });
    }
  );
});

app.delete('/api/personnel/departments/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { id } = req.params;

  // Check if department is in use
  db.get('SELECT COUNT(*) as count FROM users WHERE department_id = ?', [id], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to check department usage' });
    }
    if (result.count > 0) {
      return res.status(400).json({ error: 'Cannot delete department with assigned users' });
    }

    db.run('DELETE FROM departments WHERE id = ?', [id], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to delete department' });
      }
      res.json({ success: true, message: 'Department deleted successfully' });
    });
  });
});

app.get('/api/personnel/closed-areas', authenticateToken, (req, res) => {
  db.all(
    `SELECT ca.*, u.name as created_by_name 
     FROM closed_areas ca
     LEFT JOIN users u ON ca.created_by = u.id
     ORDER BY ca.created_at DESC`,
    (err, areas) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch closed areas' });
      }
      res.json(areas);
    }
  );
});

app.post('/api/personnel/closed-areas', authenticateToken, (req, res) => {
  console.log('POST /api/personnel/closed-areas - Request received');
  const { name, description, address, latitude, longitude, radius, reason, expires_at } = req.body;

  if (!name || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: 'Name, latitude, and longitude are required' });
  }

  // Validate numeric values
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);
  const rad = radius ? parseFloat(radius) : 500;

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: 'Latitude and longitude must be valid numbers' });
  }

  if (isNaN(rad) || rad <= 0) {
    return res.status(400).json({ error: 'Radius must be a positive number' });
  }

  // Convert expires_at to ISO string if provided
  let expiresAtValue = null;
  if (expires_at) {
    try {
      expiresAtValue = new Date(expires_at).toISOString();
    } catch (e) {
      return res.status(400).json({ error: 'Invalid expiration date format' });
    }
  }

  db.run(
    `INSERT INTO closed_areas (name, description, address, latitude, longitude, radius, reason, created_by, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, description || '', address || '', lat, lng, rad, reason || '', req.user.id, expiresAtValue],
    function(err) {
      if (err) {
        console.error('Database error creating closed area:', err);
        return res.status(500).json({ error: err.message || 'Failed to create closed area' });
      }
      res.json({ 
        success: true, 
        message: 'Closed area created successfully',
        areaId: this.lastID 
      });
    }
  );
});

app.put('/api/personnel/closed-areas/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { is_active, expires_at } = req.body;

  const updates = [];
  const values = [];

  if (is_active !== undefined) {
    updates.push('is_active = ?');
    values.push(is_active ? 1 : 0);
  }
  if (expires_at !== undefined) {
    updates.push('expires_at = ?');
    values.push(expires_at || null);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No updates provided' });
  }

  values.push(id);

  db.run(
    `UPDATE closed_areas SET ${updates.join(', ')} WHERE id = ?`,
    values,
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to update closed area' });
      }
      res.json({ success: true, message: 'Closed area updated successfully' });
    }
  );
});

app.delete('/api/personnel/closed-areas/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM closed_areas WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete closed area' });
    }
    res.json({ success: true, message: 'Closed area deleted successfully' });
  });
});

// Parade Routes Management
app.get('/api/personnel/parade-routes', authenticateToken, (req, res) => {
  db.all(
    `SELECT pr.*, u.name as created_by_name 
     FROM parade_routes pr
     LEFT JOIN users u ON pr.created_by = u.id
     ORDER BY pr.created_at DESC`,
    (err, routes) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch parade routes' });
      }
      const parsedRoutes = routes.map(route => ({
        ...route,
        coordinates: JSON.parse(route.coordinates)
      }));
      res.json(parsedRoutes);
    }
  );
});

app.post('/api/personnel/parade-routes', authenticateToken, (req, res) => {
  const { name, description, address, coordinates, expires_at } = req.body;

  if (!name || !coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
    return res.status(400).json({ error: 'Name and at least 2 coordinate points are required' });
  }

  const coordinatesJson = JSON.stringify(coordinates);
  let expiresAtValue = null;
  if (expires_at) {
    try {
      expiresAtValue = new Date(expires_at).toISOString();
    } catch (e) {
      return res.status(400).json({ error: 'Invalid expiration date format' });
    }
  }

  db.run(
    `INSERT INTO parade_routes (name, description, address, coordinates, created_by, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name, description || '', address || '', coordinatesJson, req.user.id, expiresAtValue],
    function(err) {
      if (err) {
        console.error('Database error creating parade route:', err);
        return res.status(500).json({ error: err.message || 'Failed to create parade route' });
      }
      res.json({ 
        success: true, 
        message: 'Parade route created successfully',
        routeId: this.lastID 
      });
    }
  );
});

app.put('/api/personnel/parade-routes/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { is_active, expires_at } = req.body;

  const updates = [];
  const values = [];

  if (is_active !== undefined) {
    updates.push('is_active = ?');
    values.push(is_active ? 1 : 0);
  }
  if (expires_at !== undefined) {
    updates.push('expires_at = ?');
    values.push(expires_at || null);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No updates provided' });
  }

  values.push(id);

  db.run(
    `UPDATE parade_routes SET ${updates.join(', ')} WHERE id = ?`,
    values,
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to update parade route' });
      }
      res.json({ success: true, message: 'Parade route updated successfully' });
    }
  );
});

app.delete('/api/personnel/parade-routes/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM parade_routes WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete parade route' });
    }
    res.json({ success: true, message: 'Parade route deleted successfully' });
  });
});

// Detours Management
app.get('/api/personnel/detours', authenticateToken, (req, res) => {
  db.all(
    `SELECT d.*, u.name as created_by_name 
     FROM detours d
     LEFT JOIN users u ON d.created_by = u.id
     ORDER BY d.created_at DESC`,
    (err, detours) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch detours' });
      }
      const parsedDetours = detours.map(detour => ({
        ...detour,
        coordinates: JSON.parse(detour.coordinates)
      }));
      res.json(parsedDetours);
    }
  );
});

app.post('/api/personnel/detours', authenticateToken, (req, res) => {
  const { name, description, address, coordinates, expires_at } = req.body;

  if (!name || !coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
    return res.status(400).json({ error: 'Name and at least 2 coordinate points are required' });
  }

  const coordinatesJson = JSON.stringify(coordinates);
  let expiresAtValue = null;
  if (expires_at) {
    try {
      expiresAtValue = new Date(expires_at).toISOString();
    } catch (e) {
      return res.status(400).json({ error: 'Invalid expiration date format' });
    }
  }

  db.run(
    `INSERT INTO detours (name, description, address, coordinates, created_by, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name, description || '', address || '', coordinatesJson, req.user.id, expiresAtValue],
    function(err) {
      if (err) {
        console.error('Database error creating detour:', err);
        return res.status(500).json({ error: err.message || 'Failed to create detour' });
      }
      res.json({ 
        success: true, 
        message: 'Detour created successfully',
        detourId: this.lastID 
      });
    }
  );
});

app.put('/api/personnel/detours/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { is_active, expires_at } = req.body;

  const updates = [];
  const values = [];

  if (is_active !== undefined) {
    updates.push('is_active = ?');
    values.push(is_active ? 1 : 0);
  }
  if (expires_at !== undefined) {
    updates.push('expires_at = ?');
    values.push(expires_at || null);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No updates provided' });
  }

  values.push(id);

  db.run(
    `UPDATE detours SET ${updates.join(', ')} WHERE id = ?`,
    values,
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to update detour' });
      }
      res.json({ success: true, message: 'Detour updated successfully' });
    }
  );
});

app.delete('/api/personnel/detours/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM detours WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete detour' });
    }
    res.json({ success: true, message: 'Detour deleted successfully' });
  });
});

// Closed Roads Management
app.get('/api/personnel/closed-roads', authenticateToken, (req, res) => {
  db.all(
    `SELECT cr.*, u.name as created_by_name 
     FROM closed_roads cr
     LEFT JOIN users u ON cr.created_by = u.id
     ORDER BY cr.created_at DESC`,
    (err, roads) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch closed roads' });
      }
      const parsedRoads = roads.map(road => ({
        ...road,
        coordinates: JSON.parse(road.coordinates)
      }));
      res.json(parsedRoads);
    }
  );
});

app.post('/api/personnel/closed-roads', authenticateToken, (req, res) => {
  console.log('POST /api/personnel/closed-roads - Request received');
  const { name, description, address, coordinates, expires_at } = req.body;

  if (!name || !coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
    return res.status(400).json({ error: 'Name and at least 2 coordinate points are required' });
  }

  const coordinatesJson = JSON.stringify(coordinates);
  let expiresAtValue = null;
  if (expires_at) {
    try {
      expiresAtValue = new Date(expires_at).toISOString();
    } catch (e) {
      return res.status(400).json({ error: 'Invalid expiration date format' });
    }
  }

  db.run(
    `INSERT INTO closed_roads (name, description, address, coordinates, created_by, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name, description || '', address || '', coordinatesJson, req.user.id, expiresAtValue],
    function(err) {
      if (err) {
        console.error('Database error creating closed road:', err);
        return res.status(500).json({ error: err.message || 'Failed to create closed road' });
      }
      res.json({ 
        success: true, 
        message: 'Closed road created successfully',
        roadId: this.lastID 
      });
    }
  );
});

app.put('/api/personnel/closed-roads/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { is_active, expires_at } = req.body;

  const updates = [];
  const values = [];

  if (is_active !== undefined) {
    updates.push('is_active = ?');
    values.push(is_active ? 1 : 0);
  }
  if (expires_at !== undefined) {
    updates.push('expires_at = ?');
    values.push(expires_at || null);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No updates provided' });
  }

  values.push(id);

  db.run(
    `UPDATE closed_roads SET ${updates.join(', ')} WHERE id = ?`,
    values,
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to update closed road' });
      }
      res.json({ success: true, message: 'Closed road updated successfully' });
    }
  );
});

app.delete('/api/personnel/closed-roads', authenticateToken, (req, res) => {
  // Delete all closed roads - MUST be before /:id route
  db.run('DELETE FROM closed_roads', function(err) {
    if (err) {
      console.error('Error deleting all closed roads:', err);
      return res.status(500).json({ error: 'Failed to delete all closed roads' });
    }
    res.json({ success: true, message: `All closed roads deleted successfully (${this.changes} roads)` });
  });
});

app.delete('/api/personnel/closed-roads/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM closed_roads WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete closed road' });
    }
    res.json({ success: true, message: 'Closed road deleted successfully' });
  });
});

// Callouts Management (MCI Mass Callouts)
app.get('/api/personnel/callouts', authenticateToken, (req, res) => {
  // Get callouts for user's department or all if admin
  const query = req.user.role === 'admin' 
    ? `SELECT c.*, d.name as department_name, d.color as department_color, u.name as created_by_name
       FROM callouts c
       LEFT JOIN departments d ON c.department_id = d.id
       LEFT JOIN users u ON c.created_by = u.id
       WHERE c.is_active = 1
       ORDER BY c.created_at DESC`
    : `SELECT c.*, d.name as department_name, d.color as department_color, u.name as created_by_name
       FROM callouts c
       LEFT JOIN departments d ON c.department_id = d.id
       LEFT JOIN users u ON c.created_by = u.id
       WHERE c.is_active = 1 
       AND c.department_id = (SELECT department_id FROM users WHERE id = ?)
       ORDER BY c.created_at DESC`;

  db.all(query, req.user.role === 'admin' ? [] : [req.user.id], (err, callouts) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch callouts' });
    }
    res.json(callouts);
  });
});

app.post('/api/personnel/callouts', authenticateToken, (req, res) => {
  const { title, message, department_id, location, priority, expires_at } = req.body;

  if (!title || !message || !department_id) {
    return res.status(400).json({ error: 'Title, message, and department are required' });
  }

  let expiresAtValue = null;
  if (expires_at) {
    try {
      expiresAtValue = new Date(expires_at).toISOString();
    } catch (e) {
      return res.status(400).json({ error: 'Invalid expiration date format' });
    }
  }

  db.run(
    `INSERT INTO callouts (title, message, department_id, location, priority, created_by, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [title, message, department_id, location || '', priority || 'high', req.user.id, expiresAtValue],
    function(err) {
      if (err) {
        console.error('Database error creating callout:', err);
        return res.status(500).json({ error: err.message || 'Failed to create callout' });
      }
      res.json({ 
        success: true, 
        message: 'Mass callout sent successfully',
        calloutId: this.lastID 
      });
    }
  );
});

app.put('/api/personnel/callouts/:id/acknowledge', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  // Get current acknowledged list
  db.get('SELECT acknowledged_by FROM callouts WHERE id = ?', [id], (err, callout) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch callout' });
    }

    let acknowledged = [];
    if (callout.acknowledged_by) {
      try {
        acknowledged = JSON.parse(callout.acknowledged_by);
      } catch (e) {
        acknowledged = [];
      }
    }

    // Add current user if not already acknowledged
    if (!acknowledged.includes(req.user.id)) {
      acknowledged.push(req.user.id);
    }

    db.run(
      'UPDATE callouts SET acknowledged_by = ? WHERE id = ?',
      [JSON.stringify(acknowledged), id],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to acknowledge callout' });
        }
        res.json({ success: true, message: 'Callout acknowledged' });
      }
    );
  });
});

app.put('/api/personnel/callouts/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;

  if (is_active === undefined) {
    return res.status(400).json({ error: 'is_active is required' });
  }

  db.run(
    'UPDATE callouts SET is_active = ? WHERE id = ?',
    [is_active ? 1 : 0, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to update callout' });
      }
      res.json({ success: true, message: 'Callout updated successfully' });
    }
  );
});

// Chat Routes
app.get('/api/personnel/chat/messages', authenticateToken, (req, res) => {
  const { department_id } = req.query;
  
  let query;
  let params;
  
  if (department_id && department_id !== 'all') {
    // Get messages for specific department
    query = `SELECT cm.*, u.department_id as user_dept_id, d.color as department_color
             FROM chat_messages cm
             LEFT JOIN users u ON cm.user_id = u.id
             LEFT JOIN departments d ON cm.department_id = d.id
             WHERE cm.department_id = ?
             ORDER BY cm.created_at ASC`;
    params = [department_id];
  } else {
    // Get all messages (for 'all' or no filter)
    query = `SELECT cm.*, u.department_id as user_dept_id, d.color as department_color
             FROM chat_messages cm
             LEFT JOIN users u ON cm.user_id = u.id
             LEFT JOIN departments d ON cm.department_id = d.id
             ORDER BY cm.created_at ASC
             LIMIT 500`;
    params = [];
  }
  
  db.all(query, params, (err, messages) => {
    if (err) {
      console.error('Error fetching chat messages:', err);
      return res.status(500).json({ error: 'Failed to fetch messages' });
    }
    res.json(messages);
  });
});

app.post('/api/personnel/chat/messages', authenticateToken, (req, res) => {
  const { message, department_id } = req.body;
  
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }
  
  // Get user info
  db.get('SELECT name, department_id FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to get user info' });
    }
    
    let departmentName = null;
    if (department_id && department_id !== 'all') {
      // Get department name
      db.get('SELECT name FROM departments WHERE id = ?', [department_id], (err, dept) => {
        if (!err && dept) {
          departmentName = dept.name;
        }
        
        db.run(
          `INSERT INTO chat_messages (message, department_id, user_id, user_name, department_name)
           VALUES (?, ?, ?, ?, ?)`,
          [message.trim(), department_id === 'all' ? null : department_id, req.user.id, user.name, departmentName],
          function(err) {
            if (err) {
              console.error('Error creating chat message:', err);
              return res.status(500).json({ error: 'Failed to send message' });
            }
            res.json({ 
              success: true, 
              message: 'Message sent successfully',
              messageId: this.lastID 
            });
          }
        );
      });
    } else {
      // Message to all departments
      db.run(
        `INSERT INTO chat_messages (message, department_id, user_id, user_name, department_name)
         VALUES (?, ?, ?, ?, ?)`,
        [message.trim(), null, req.user.id, user.name, 'All Departments'],
        function(err) {
          if (err) {
            console.error('Error creating chat message:', err);
            return res.status(500).json({ error: 'Failed to send message' });
          }
          res.json({ 
            success: true, 
            message: 'Message sent successfully',
            messageId: this.lastID 
          });
        }
      );
    }
  });
});

// Push Notification Routes
app.get('/api/public/push/vapid-key', (req, res) => {
  if (!VAPID_PUBLIC_KEY) {
    console.error('VAPID_PUBLIC_KEY is not configured');
    return res.status(503).json({ error: 'Push notifications are not configured' });
  }
  
  // Validate VAPID key format (should be base64url, typically 87-88 characters)
  if (VAPID_PUBLIC_KEY.length < 80 || VAPID_PUBLIC_KEY.length > 100) {
    console.warn(`VAPID_PUBLIC_KEY length is ${VAPID_PUBLIC_KEY.length}, expected ~87 characters`);
  }
  
  console.log('VAPID public key requested, length:', VAPID_PUBLIC_KEY.length);
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

app.post('/api/public/push/subscribe', (req, res) => {
  const { subscription } = req.body;

  console.log('Received subscription request:', {
    hasEndpoint: !!subscription?.endpoint,
    hasKeys: !!subscription?.keys,
    hasP256dh: !!subscription?.keys?.p256dh,
    hasAuth: !!subscription?.keys?.auth
  });

  if (!subscription || !subscription.endpoint || !subscription.keys) {
    console.error('Invalid subscription data:', subscription);
    return res.status(400).json({ error: 'Invalid subscription data' });
  }

  if (!subscription.keys.p256dh || !subscription.keys.auth) {
    console.error('Missing subscription keys:', subscription.keys);
    return res.status(400).json({ error: 'Missing subscription keys (p256dh or auth)' });
  }

  // Store subscription in database
  db.run(
    `INSERT OR REPLACE INTO push_subscriptions (endpoint, p256dh, auth)
     VALUES (?, ?, ?)`,
    [subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth],
    function(err) {
      if (err) {
        console.error('Error storing push subscription:', err);
        return res.status(500).json({ error: 'Failed to store subscription' });
      }
      console.log(`✅ Subscription saved successfully. Endpoint: ${subscription.endpoint.substring(0, 50)}...`);
      res.json({ success: true, message: 'Subscription saved successfully' });
    }
  );
});

app.post('/api/public/push/unsubscribe', (req, res) => {
  const { endpoint } = req.body;

  if (!endpoint) {
    return res.status(400).json({ error: 'Endpoint is required' });
  }

  db.run('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint], function(err) {
    if (err) {
      console.error('Error removing push subscription:', err);
      return res.status(500).json({ error: 'Failed to remove subscription' });
    }
    res.json({ success: true, message: 'Subscription removed successfully' });
  });
});

app.post('/api/personnel/push/send', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { title, message, severity } = req.body;

  if (!title || !message) {
    return res.status(400).json({ error: 'Title and message are required' });
  }

  sendPushNotificationToAll(title, message, severity || 'info');
  res.json({ success: true, message: 'Push notification sent to all subscribers' });
});

// Serve static files from React app in production
if (process.env.NODE_ENV === 'production') {
  // Serve static files from the React app build directory
  const buildPath = path.join(__dirname, '../client/build');
  const indexPath = path.join(buildPath, 'index.html');
  
  // Check if build directory exists
  if (!fs.existsSync(buildPath)) {
    console.error(`ERROR: Build directory not found at ${buildPath}`);
    console.error('Make sure to run "npm run build" before starting the server');
    console.error('Current working directory:', process.cwd());
    console.error('__dirname:', __dirname);
    console.error('Attempting to list parent directory:', path.join(__dirname, '..'));
    try {
      const parentDir = path.join(__dirname, '..');
      if (fs.existsSync(parentDir)) {
        const files = fs.readdirSync(parentDir);
        console.error('Files in parent directory:', files);
      }
    } catch (e) {
      console.error('Error reading parent directory:', e.message);
    }
  } else {
    console.log(`Serving static files from: ${buildPath}`);
    try {
      const buildFiles = fs.readdirSync(buildPath);
      console.log('Files in build directory:', buildFiles);
    } catch (e) {
      console.error('Error reading build directory:', e.message);
    }
    if (fs.existsSync(indexPath)) {
      console.log('✓ index.html found');
    } else {
      console.error(`ERROR: index.html not found at ${indexPath}`);
    }
  }
  
  // Serve static files from the React app build directory
  app.use(express.static(buildPath));
  
  // Serve static assets (CSS, JS, images) from the build directory
  app.use('/static', express.static(path.join(buildPath, 'static')));
  
  // Serve service worker and manifest
  app.use('/service-worker.js', express.static(path.join(__dirname, '../client/public/service-worker.js')));
  app.use('/manifest.json', express.static(path.join(__dirname, '../client/public/manifest.json')));
  app.use('/logo.png', express.static(path.join(__dirname, '../client/public/logo.png')));
  
  // The "catchall" handler: for any request that doesn't match an API route,
  // send back React's index.html file.
  app.get('*', (req, res) => {
    // Don't serve React app for API routes
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
    }
    
    // Send index.html for all other routes (React Router will handle routing)
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      console.error(`ERROR: index.html not found at ${indexPath}`);
      res.status(500).send(`
        <html>
          <head><title>Build Error</title></head>
          <body>
            <h1>React app not built</h1>
            <p>Please run "npm run build" first.</p>
            <p>Build path: ${buildPath}</p>
            <p>Index path: ${indexPath}</p>
          </body>
        </html>
      `);
    }
  });
} else {
  // 404 handler for debugging (development only)
  app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
      console.log(`404 - Route not found: ${req.method} ${req.path}`);
      res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
    } else {
      res.status(404).send('Route not found');
    }
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  if (process.env.NODE_ENV === 'production') {
    const buildPath = path.join(__dirname, '../client/build');
    if (fs.existsSync(buildPath)) {
      console.log(`Serving React app from: ${buildPath}`);
    } else {
      console.error(`WARNING: Build directory not found at ${buildPath}`);
      console.error('The React app may not be built. Run "npm run build" first.');
    }
  }
  console.log('Available routes:');
  console.log('  POST /api/personnel/closed-areas');
  console.log('  GET /api/personnel/closed-areas');
});

