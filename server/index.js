const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const webpush = require('web-push');
const { execSync } = require('child_process');
const { initDatabase, run, get, all, serialize, convertSQL, insertOrIgnore, getDbType } = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

app.use(cors());
app.use(express.json());

// Initialize database
const { db, dbType } = initDatabase();
const isPostgres = dbType === 'postgres';

// Initialize database tables
(async () => {
  await serialize(async () => {
  // Departments table
  const deptTableSQL = isPostgres 
    ? `CREATE TABLE IF NOT EXISTS departments (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      description TEXT,
      color VARCHAR(50) DEFAULT '#3b82f6',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
    : `CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      color TEXT DEFAULT '#3b82f6',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`;
  await run(deptTableSQL);

  // Emergency personnel users table
  const usersTableSQL = isPostgres
    ? `CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL,
      name VARCHAR(255) NOT NULL,
      department_id INTEGER,
      permissions TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments(id)
    )`
    : `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      name TEXT NOT NULL,
      department_id INTEGER,
      permissions TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments(id)
    )`;
  await run(usersTableSQL);
  
  // Add department_id column if it doesn't exist
  try {
    await run(`ALTER TABLE users ADD COLUMN department_id INTEGER`);
  } catch (err) {
    // Ignore error if column already exists
    if (!err.message.includes('duplicate column') && !err.message.includes('already exists')) {
      console.error('Error adding department_id column:', err.message);
    }
  }
  
  // Add permissions column if it doesn't exist
  try {
    await run(`ALTER TABLE users ADD COLUMN permissions TEXT`);
  } catch (err) {
    // Ignore error if column already exists
    if (!err.message.includes('duplicate column') && !err.message.includes('already exists')) {
      console.error('Error adding permissions column:', err.message);
    }
  }

  // Emergency reports table (public submissions)
  const reportsTableSQL = isPostgres
    ? `CREATE TABLE IF NOT EXISTS emergency_reports (
      id SERIAL PRIMARY KEY,
      type VARCHAR(100) NOT NULL,
      location VARCHAR(255) NOT NULL,
      description TEXT,
      reporter_name VARCHAR(255),
      reporter_phone VARCHAR(50),
      status VARCHAR(50) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      assigned_to INTEGER,
      department_id INTEGER,
      FOREIGN KEY (assigned_to) REFERENCES users(id),
      FOREIGN KEY (department_id) REFERENCES departments(id)
    )`
    : `CREATE TABLE IF NOT EXISTS emergency_reports (
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
    )`;
  await run(reportsTableSQL);
  
  // Add department_id column if it doesn't exist
  try {
    await run(`ALTER TABLE emergency_reports ADD COLUMN department_id INTEGER`);
  } catch (err) {
    if (!err.message.includes('duplicate column') && !err.message.includes('already exists')) {
      console.error('Error adding department_id column to emergency_reports:', err.message);
    }
  }
  
  // Create default departments
  const defaultDepts = [
    { name: 'Fire', description: 'Fire Department', color: '#dc2626' },
    { name: 'Police', description: 'Police Department', color: '#3b82f6' },
    { name: 'EMS', description: 'Emergency Medical Services', color: '#10b981' },
    { name: 'Dispatch', description: 'Dispatch Center', color: '#f59e0b' },
    { name: 'Search and Rescue', description: 'Search and Rescue Team', color: '#059669' }
  ];
  
  for (const dept of defaultDepts) {
    if (isPostgres) {
      await run(`INSERT INTO departments (name, description, color) 
        VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING`, [dept.name, dept.description, dept.color]);
    } else {
      await run(`INSERT OR IGNORE INTO departments (name, description, color) 
        VALUES (?, ?, ?)`, [dept.name, dept.description, dept.color]);
    }
  }

  // Public alerts table
  const alertsTableSQL = isPostgres
    ? `CREATE TABLE IF NOT EXISTS public_alerts (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      severity VARCHAR(50) DEFAULT 'info',
      created_by INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`
    : `CREATE TABLE IF NOT EXISTS public_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      severity TEXT DEFAULT 'info',
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`;
  await run(alertsTableSQL);

  // Closed areas table
  const closedAreasTableSQL = isPostgres
    ? `CREATE TABLE IF NOT EXISTS closed_areas (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      address VARCHAR(255),
      crossroads VARCHAR(255),
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      radius DOUBLE PRECISION DEFAULT 500,
      reason TEXT,
      created_by INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP,
      is_active BOOLEAN DEFAULT true,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`
    : `CREATE TABLE IF NOT EXISTS closed_areas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      address TEXT,
      crossroads TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      radius REAL DEFAULT 500,
      reason TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`;
  await run(closedAreasTableSQL);
  
  // Add address column if it doesn't exist (for existing databases)
  try {
    await run(`ALTER TABLE closed_areas ADD COLUMN address ${isPostgres ? 'VARCHAR(255)' : 'TEXT'}`);
  } catch (err) {
    if (!err.message.includes('duplicate column') && !err.message.includes('already exists')) {
      console.error('Error adding address column to closed_areas:', err.message);
    }
  }
  
  // Add crossroads column if it doesn't exist
  try {
    await run(`ALTER TABLE closed_areas ADD COLUMN crossroads ${isPostgres ? 'VARCHAR(255)' : 'TEXT'}`);
  } catch (err) {
    if (!err.message.includes('duplicate column') && !err.message.includes('already exists')) {
      console.error('Error adding crossroads column to closed_areas:', err.message);
    }
  }

  // Parade routes table
  const paradeRoutesTableSQL = isPostgres
    ? `CREATE TABLE IF NOT EXISTS parade_routes (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      address VARCHAR(255),
      crossroads VARCHAR(255),
      coordinates TEXT NOT NULL,
      created_by INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP,
      is_active BOOLEAN DEFAULT true,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`
    : `CREATE TABLE IF NOT EXISTS parade_routes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      address TEXT,
      crossroads TEXT,
      coordinates TEXT NOT NULL,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`;
  await run(paradeRoutesTableSQL);
  
  // Add address column if it doesn't exist
  try {
    await run(`ALTER TABLE parade_routes ADD COLUMN address ${isPostgres ? 'VARCHAR(255)' : 'TEXT'}`);
  } catch (err) {
    if (!err.message.includes('duplicate column') && !err.message.includes('already exists')) {
      console.error('Error adding address column to parade_routes:', err.message);
    }
  }
  
  // Add crossroads column if it doesn't exist
  try {
    await run(`ALTER TABLE parade_routes ADD COLUMN crossroads ${isPostgres ? 'VARCHAR(255)' : 'TEXT'}`);
  } catch (err) {
    if (!err.message.includes('duplicate column') && !err.message.includes('already exists')) {
      console.error('Error adding crossroads column to parade_routes:', err.message);
    }
  }

  // Detours table
  const detoursTableSQL = isPostgres
    ? `CREATE TABLE IF NOT EXISTS detours (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      address VARCHAR(255),
      crossroads VARCHAR(255),
      coordinates TEXT NOT NULL,
      created_by INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP,
      is_active BOOLEAN DEFAULT true,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`
    : `CREATE TABLE IF NOT EXISTS detours (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      address TEXT,
      crossroads TEXT,
      coordinates TEXT NOT NULL,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`;
  await run(detoursTableSQL);
  
  // Add address column if it doesn't exist
  try {
    await run(`ALTER TABLE detours ADD COLUMN address ${isPostgres ? 'VARCHAR(255)' : 'TEXT'}`);
  } catch (err) {
    if (!err.message.includes('duplicate column') && !err.message.includes('already exists')) {
      console.error('Error adding address column to detours:', err.message);
    }
  }
  
  // Add crossroads column if it doesn't exist
  try {
    await run(`ALTER TABLE detours ADD COLUMN crossroads ${isPostgres ? 'VARCHAR(255)' : 'TEXT'}`);
  } catch (err) {
    if (!err.message.includes('duplicate column') && !err.message.includes('already exists')) {
      console.error('Error adding crossroads column to detours:', err.message);
    }
  }

  // Callouts table (MCI mass callouts)
  const calloutsTableSQL = isPostgres
    ? `CREATE TABLE IF NOT EXISTS callouts (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      department_id INTEGER NOT NULL,
      location VARCHAR(255),
      priority VARCHAR(50) DEFAULT 'high',
      created_by INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP,
      is_active BOOLEAN DEFAULT true,
      acknowledged_by TEXT,
      FOREIGN KEY (department_id) REFERENCES departments(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`
    : `CREATE TABLE IF NOT EXISTS callouts (
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
    )`;
  await run(calloutsTableSQL);

  // Push subscriptions table
  const pushSubsTableSQL = isPostgres
    ? `CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      endpoint TEXT UNIQUE NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
    : `CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT UNIQUE NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`;
  await run(pushSubsTableSQL);

  // Chat messages table
  const chatMessagesTableSQL = isPostgres
    ? `CREATE TABLE IF NOT EXISTS chat_messages (
      id SERIAL PRIMARY KEY,
      message TEXT NOT NULL,
      department_id INTEGER,
      user_id INTEGER NOT NULL,
      user_name VARCHAR(255) NOT NULL,
      department_name VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`
    : `CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message TEXT NOT NULL,
      department_id INTEGER,
      user_id INTEGER NOT NULL,
      user_name TEXT NOT NULL,
      department_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`;
  await run(chatMessagesTableSQL);

  // Closed roads table
  const closedRoadsTableSQL = isPostgres
    ? `CREATE TABLE IF NOT EXISTS closed_roads (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      address VARCHAR(255),
      crossroads VARCHAR(255),
      coordinates TEXT NOT NULL,
      created_by INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP,
      is_active BOOLEAN DEFAULT true,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`
    : `CREATE TABLE IF NOT EXISTS closed_roads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      address TEXT,
      crossroads TEXT,
      coordinates TEXT NOT NULL,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`;
  await run(closedRoadsTableSQL);
  
  // Add crossroads column if it doesn't exist
  try {
    await run(`ALTER TABLE closed_roads ADD COLUMN crossroads ${isPostgres ? 'VARCHAR(255)' : 'TEXT'}`);
  } catch (err) {
    if (!err.message.includes('duplicate column') && !err.message.includes('already exists')) {
      console.error('Error adding crossroads column to closed_roads:', err.message);
    }
  }

  // Search and Rescue operations table
  const sarTableSQL = isPostgres
    ? `CREATE TABLE IF NOT EXISTS search_rescue_operations (
      id SERIAL PRIMARY KEY,
      case_number VARCHAR(255) UNIQUE,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      location VARCHAR(255) NOT NULL,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      status VARCHAR(50) DEFAULT 'active',
      priority VARCHAR(50) DEFAULT 'medium',
      missing_person_name VARCHAR(255),
      missing_person_age VARCHAR(50),
      missing_person_description TEXT,
      last_seen_location VARCHAR(255),
      last_seen_time TIMESTAMP,
      contact_name VARCHAR(255),
      contact_phone VARCHAR(50),
      assigned_team VARCHAR(255),
      search_area_coordinates TEXT,
      crossroads VARCHAR(255),
      created_by INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      resolved_at TIMESTAMP,
      is_active BOOLEAN DEFAULT true,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`
    : `CREATE TABLE IF NOT EXISTS search_rescue_operations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_number TEXT UNIQUE,
      title TEXT NOT NULL,
      description TEXT,
      location TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      status TEXT DEFAULT 'active',
      priority TEXT DEFAULT 'medium',
      missing_person_name TEXT,
      missing_person_age TEXT,
      missing_person_description TEXT,
      last_seen_location TEXT,
      last_seen_time DATETIME,
      contact_name TEXT,
      contact_phone TEXT,
      assigned_team TEXT,
      search_area_coordinates TEXT,
      crossroads TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`;
  await run(sarTableSQL);
  
  // Add crossroads column if it doesn't exist
  try {
    await run(`ALTER TABLE search_rescue_operations ADD COLUMN crossroads ${isPostgres ? 'VARCHAR(255)' : 'TEXT'}`);
  } catch (err) {
    if (!err.message.includes('duplicate column') && !err.message.includes('already exists')) {
      console.error('Error adding crossroads column to search_rescue_operations:', err.message);
    }
  }

  // Create default admin user (password: admin123)
  // This runs after all tables are created
  setTimeout(async () => {
    try {
      const existingUser = await get('SELECT * FROM users WHERE username = ?', ['admin']);
      
      const defaultPassword = bcrypt.hashSync('admin123', 10);
      
      if (!existingUser) {
        // Create admin user
        const result = await run(
          `INSERT INTO users (username, password, role, name) 
           VALUES (?, ?, ?, ?)`,
          ['admin', defaultPassword, 'admin', 'Administrator']
        );
        console.log('✅ Default admin user created: username=admin, password=admin123');
        if (result.lastID) {
          console.log('   User ID:', result.lastID);
        }
      } else {
        // Admin exists, verify password works
        const match = await bcrypt.compare('admin123', existingUser.password);
        if (!match) {
          // Password doesn't match, update it
          console.log('Admin user exists but password is incorrect. Resetting password...');
          await run(
            `UPDATE users SET password = ? WHERE username = ?`,
            [defaultPassword, 'admin']
          );
          console.log('✅ Admin password reset: username=admin, password=admin123');
        } else {
          console.log('✅ Admin user exists and password is correct');
          console.log('   Admin user ID:', existingUser.id);
          console.log('   Login with: username=admin, password=admin123');
        }
      }
    } catch (err) {
      console.error('Error managing admin user:', err);
      console.error('Error details:', err.message);
    }
  }, 1000); // Wait 1 second to ensure all tables are created
  });
})();

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
app.post('/api/auth/login', async (req, res) => {
  console.log('=== LOGIN REQUEST ===');
  console.log('Request body:', JSON.stringify(req.body));
  console.log('Headers:', JSON.stringify(req.headers));
  console.log('Database type:', dbType);
  
  const { username, password } = req.body;

  if (!username || !password) {
    console.log('Login failed: Missing username or password');
    return res.status(400).json({ error: 'Username and password are required' });
  }

  console.log('Looking up user:', username);
  
  try {
    // First, verify database is accessible
    await get('SELECT COUNT(*) as count FROM users');
    
    // Database is accessible, proceed with login
    const user = await get('SELECT * FROM users WHERE username = ?', [username]);
    
    if (!user) {
      console.log('Login failed: User not found -', username);
      // Check if any users exist at all
      const countResult = await get('SELECT COUNT(*) as count FROM users');
      if (countResult && countResult.count === 0) {
        console.log('⚠️ No users found in database. Default admin user may not have been created.');
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('User found, comparing password...');
    const match = await bcrypt.compare(password, user.password);
    
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
  } catch (err) {
    console.error('Database error during login:', err);
    return res.status(500).json({ 
      error: 'Database connection error. Please check server logs.',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
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
async function sendPushNotificationToAll(title, message, severity) {
  // Check if VAPID keys are configured
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.log('Push notifications disabled: VAPID keys not configured');
    return;
  }

  try {
    const subscriptions = await all('SELECT endpoint, p256dh, auth FROM push_subscriptions');
    
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
        .catch(async (err) => {
          // If subscription is invalid, remove it from database
          if (err.statusCode === 410 || err.statusCode === 404) {
            try {
              await run('DELETE FROM push_subscriptions WHERE endpoint = ?', [sub.endpoint]);
              console.log(`🗑️ Removed invalid subscription: ${sub.endpoint.substring(0, 50)}...`);
            } catch (deleteErr) {
              console.error('Error deleting invalid subscription:', deleteErr);
            }
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
  } catch (err) {
    console.error('Error fetching push subscriptions:', err);
  }
}

app.get('/api/personnel/users', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const users = await all(
      `SELECT u.id, u.username, u.role, u.name, u.department_id, u.permissions, u.created_at, 
              d.name as department_name, d.color as department_color
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       ORDER BY u.created_at DESC`
    );
    // Parse permissions JSON
    const parsedUsers = users.map(user => ({
      ...user,
      permissions: user.permissions ? JSON.parse(user.permissions) : null
    }));
    res.json(parsedUsers);
  } catch (err) {
    console.error('Error fetching users:', err);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.post('/api/personnel/users', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { username, password, role, name, department_id, permissions } = req.body;

  if (!username || !password || !role || !name) {
    return res.status(400).json({ error: 'Username, password, role, and name are required' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const permissionsJson = permissions ? JSON.stringify(permissions) : null;

  db.run(
    `INSERT INTO users (username, password, role, name, department_id, permissions)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [username, hashedPassword, role, name, department_id || null, permissionsJson],
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

app.put('/api/personnel/users/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { id } = req.params;
  const { role, name, department_id, password, permissions } = req.body;

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
  if (permissions !== undefined) {
    updates.push('permissions = ?');
    values.push(permissions ? JSON.stringify(permissions) : null);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No updates provided' });
  }

  values.push(id);

  try {
    await run(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    res.json({ success: true, message: 'User updated successfully' });
  } catch (err) {
    console.error('Error updating user:', err);
    return res.status(500).json({ error: 'Failed to update user' });
  }
});

app.delete('/api/personnel/users/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { id } = req.params;

  // Don't allow deleting yourself
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  try {
    await run('DELETE FROM users WHERE id = ?', [id]);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    console.error('Error deleting user:', err);
    return res.status(500).json({ error: 'Failed to delete user' });
  }
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
    `INSERT INTO closed_areas (name, description, address, crossroads, latitude, longitude, radius, reason, created_by, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, description || '', address || '', req.body.crossroads || '', lat, lng, rad, reason || '', req.user.id, expiresAtValue],
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
  const { name, description, address, crossroads, latitude, longitude, radius, reason, is_active, expires_at } = req.body;

  const updates = [];
  const values = [];

  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }
  if (description !== undefined) {
    updates.push('description = ?');
    values.push(description);
  }
  if (address !== undefined) {
    updates.push('address = ?');
    values.push(address);
  }
  if (crossroads !== undefined) {
    updates.push('crossroads = ?');
    values.push(crossroads);
  }
  if (latitude !== undefined && longitude !== undefined) {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'Latitude and longitude must be valid numbers' });
    }
    updates.push('latitude = ?');
    updates.push('longitude = ?');
    values.push(lat, lng);
  }
  if (radius !== undefined) {
    const rad = parseFloat(radius);
    if (isNaN(rad) || rad <= 0) {
      return res.status(400).json({ error: 'Radius must be a positive number' });
    }
    updates.push('radius = ?');
    values.push(rad);
  }
  if (reason !== undefined) {
    updates.push('reason = ?');
    values.push(reason);
  }
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
    `INSERT INTO parade_routes (name, description, address, crossroads, coordinates, created_by, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [name, description || '', address || '', req.body.crossroads || '', coordinatesJson, req.user.id, expiresAtValue],
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
  const { name, description, address, crossroads, coordinates, is_active, expires_at } = req.body;

  const updates = [];
  const values = [];

  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }
  if (description !== undefined) {
    updates.push('description = ?');
    values.push(description);
  }
  if (address !== undefined) {
    updates.push('address = ?');
    values.push(address);
  }
  if (crossroads !== undefined) {
    updates.push('crossroads = ?');
    values.push(crossroads);
  }
  if (coordinates !== undefined) {
    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      return res.status(400).json({ error: 'Coordinates must be an array with at least 2 points' });
    }
    updates.push('coordinates = ?');
    values.push(JSON.stringify(coordinates));
  }
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
    `INSERT INTO detours (name, description, address, crossroads, coordinates, created_by, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [name, description || '', address || '', req.body.crossroads || '', coordinatesJson, req.user.id, expiresAtValue],
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
  const { name, description, address, crossroads, coordinates, is_active, expires_at } = req.body;

  const updates = [];
  const values = [];

  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }
  if (description !== undefined) {
    updates.push('description = ?');
    values.push(description);
  }
  if (address !== undefined) {
    updates.push('address = ?');
    values.push(address);
  }
  if (crossroads !== undefined) {
    updates.push('crossroads = ?');
    values.push(crossroads);
  }
  if (coordinates !== undefined) {
    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      return res.status(400).json({ error: 'Coordinates must be an array with at least 2 points' });
    }
    updates.push('coordinates = ?');
    values.push(JSON.stringify(coordinates));
  }
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
  const { name, description, address, crossroads, coordinates, is_active, expires_at } = req.body;

  const updates = [];
  const values = [];

  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }
  if (description !== undefined) {
    updates.push('description = ?');
    values.push(description);
  }
  if (address !== undefined) {
    updates.push('address = ?');
    values.push(address);
  }
  if (crossroads !== undefined) {
    updates.push('crossroads = ?');
    values.push(crossroads);
  }
  if (coordinates !== undefined) {
    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      return res.status(400).json({ error: 'Coordinates must be an array with at least 2 points' });
    }
    updates.push('coordinates = ?');
    values.push(JSON.stringify(coordinates));
  }
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

// Search and Rescue Operations Routes
app.get('/api/personnel/search-rescue', authenticateToken, (req, res) => {
  db.all(
    `SELECT sr.*, u.name as created_by_name 
     FROM search_rescue_operations sr
     LEFT JOIN users u ON sr.created_by = u.id
     ORDER BY sr.created_at DESC`,
    (err, operations) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch search and rescue operations' });
      }
      const parsedOperations = operations.map(op => ({
        ...op,
        search_area_coordinates: op.search_area_coordinates ? JSON.parse(op.search_area_coordinates) : null
      }));
      res.json(parsedOperations);
    }
  );
});

app.get('/api/public/search-rescue', (req, res) => {
  const now = new Date().toISOString();
  db.all(
    `SELECT sr.* 
     FROM search_rescue_operations sr
     WHERE sr.is_active = 1 
     AND sr.status IN ('active', 'in_progress')
     ORDER BY sr.created_at DESC`,
    (err, operations) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to fetch search and rescue operations' });
      }
      const parsedOperations = operations.map(op => ({
        ...op,
        search_area_coordinates: op.search_area_coordinates ? JSON.parse(op.search_area_coordinates) : null
      }));
      res.json(parsedOperations);
    }
  );
});

app.post('/api/personnel/search-rescue', authenticateToken, (req, res) => {
  const { 
    case_number, 
    title, 
    description, 
    location, 
    latitude, 
    longitude, 
    status, 
    priority,
    missing_person_name,
    missing_person_age,
    missing_person_description,
    last_seen_location,
    last_seen_time,
    contact_name,
    contact_phone,
    assigned_team,
    search_area_coordinates
  } = req.body;

  if (!title || !location) {
    return res.status(400).json({ error: 'Title and location are required' });
  }

  // Generate case number if not provided
  const caseNum = case_number || `SAR-${Date.now()}`;
  
  // Validate coordinates if provided (both must be provided together, or both can be null/empty)
  let lat = null;
  let lng = null;
  // Check if coordinates are provided (not undefined, not null, not empty string)
  const hasLatitude = latitude !== undefined && latitude !== null && latitude !== '';
  const hasLongitude = longitude !== undefined && longitude !== null && longitude !== '';
  
  if (hasLatitude && hasLongitude) {
    lat = parseFloat(latitude);
    lng = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'Latitude and longitude must be valid numbers' });
    }
  } else if (hasLatitude || hasLongitude) {
    // If only one is provided, that's an error
    return res.status(400).json({ error: 'Both latitude and longitude must be provided together, or both can be left empty' });
  }
  // If neither is provided, lat and lng remain null (which is fine)

  // Parse search area coordinates if provided
  let searchAreaJson = null;
  if (search_area_coordinates) {
    if (Array.isArray(search_area_coordinates)) {
      searchAreaJson = JSON.stringify(search_area_coordinates);
    } else {
      return res.status(400).json({ error: 'Search area coordinates must be an array' });
    }
  }

  // Parse last seen time if provided
  let lastSeenTimeValue = null;
  if (last_seen_time) {
    try {
      lastSeenTimeValue = new Date(last_seen_time).toISOString();
    } catch (e) {
      return res.status(400).json({ error: 'Invalid last seen time format' });
    }
  }

  db.run(
    `INSERT INTO search_rescue_operations (
      case_number, title, description, location, crossroads, latitude, longitude, 
      status, priority, missing_person_name, missing_person_age, 
      missing_person_description, last_seen_location, last_seen_time,
      contact_name, contact_phone, assigned_team, search_area_coordinates,
      created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      caseNum, title, description || '', location, req.body.crossroads || '', lat, lng,
      status || 'active', priority || 'medium',
      missing_person_name || '', missing_person_age || '',
      missing_person_description || '', last_seen_location || '', lastSeenTimeValue,
      contact_name || '', contact_phone || '', assigned_team || '', searchAreaJson,
      req.user.id
    ],
    function(err) {
      if (err) {
        console.error('Database error creating SAR operation:', err);
        return res.status(500).json({ error: err.message || 'Failed to create search and rescue operation' });
      }
      res.json({ 
        success: true, 
        message: 'Search and rescue operation created successfully',
        operationId: this.lastID 
      });
    }
  );
});

app.put('/api/personnel/search-rescue/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { 
    title, 
    description, 
    location, 
    crossroads,
    latitude, 
    longitude, 
    status, 
    priority,
    missing_person_name,
    missing_person_age,
    missing_person_description,
    last_seen_location,
    last_seen_time,
    contact_name,
    contact_phone,
    assigned_team,
    search_area_coordinates,
    is_active,
    resolved_at
  } = req.body;

  const updates = [];
  const values = [];

  if (title !== undefined) {
    updates.push('title = ?');
    values.push(title);
  }
  if (description !== undefined) {
    updates.push('description = ?');
    values.push(description);
  }
  if (location !== undefined) {
    updates.push('location = ?');
    values.push(location);
  }
  if (crossroads !== undefined) {
    updates.push('crossroads = ?');
    values.push(crossroads);
  }
  // Handle latitude/longitude updates - both must be provided together or both cleared
  if (latitude !== undefined || longitude !== undefined) {
    const hasLatitude = latitude !== undefined && latitude !== null && latitude !== '';
    const hasLongitude = longitude !== undefined && longitude !== null && longitude !== '';
    
    if (hasLatitude && hasLongitude) {
      // Both provided - validate and update
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ error: 'Latitude and longitude must be valid numbers' });
      }
      updates.push('latitude = ?');
      updates.push('longitude = ?');
      values.push(lat, lng);
    } else if (hasLatitude || hasLongitude) {
      // Only one provided - error
      return res.status(400).json({ error: 'Both latitude and longitude must be provided together, or both can be cleared' });
    } else {
      // Both are null/empty - clear them
      updates.push('latitude = ?');
      updates.push('longitude = ?');
      values.push(null, null);
    }
  }
  if (status !== undefined) {
    updates.push('status = ?');
    values.push(status);
    if (status === 'resolved' || status === 'closed') {
      updates.push('resolved_at = ?');
      values.push(new Date().toISOString());
    }
  }
  if (priority !== undefined) {
    updates.push('priority = ?');
    values.push(priority);
  }
  if (missing_person_name !== undefined) {
    updates.push('missing_person_name = ?');
    values.push(missing_person_name);
  }
  if (missing_person_age !== undefined) {
    updates.push('missing_person_age = ?');
    values.push(missing_person_age);
  }
  if (missing_person_description !== undefined) {
    updates.push('missing_person_description = ?');
    values.push(missing_person_description);
  }
  if (last_seen_location !== undefined) {
    updates.push('last_seen_location = ?');
    values.push(last_seen_location);
  }
  if (last_seen_time !== undefined) {
    if (last_seen_time) {
      try {
        updates.push('last_seen_time = ?');
        values.push(new Date(last_seen_time).toISOString());
      } catch (e) {
        return res.status(400).json({ error: 'Invalid last seen time format' });
      }
    } else {
      updates.push('last_seen_time = ?');
      values.push(null);
    }
  }
  if (contact_name !== undefined) {
    updates.push('contact_name = ?');
    values.push(contact_name);
  }
  if (contact_phone !== undefined) {
    updates.push('contact_phone = ?');
    values.push(contact_phone);
  }
  if (assigned_team !== undefined) {
    updates.push('assigned_team = ?');
    values.push(assigned_team);
  }
  if (search_area_coordinates !== undefined) {
    if (search_area_coordinates && Array.isArray(search_area_coordinates)) {
      updates.push('search_area_coordinates = ?');
      values.push(JSON.stringify(search_area_coordinates));
    } else if (search_area_coordinates === null) {
      updates.push('search_area_coordinates = ?');
      values.push(null);
    } else {
      return res.status(400).json({ error: 'Search area coordinates must be an array or null' });
    }
  }
  if (is_active !== undefined) {
    updates.push('is_active = ?');
    values.push(is_active ? 1 : 0);
  }
  if (resolved_at !== undefined) {
    updates.push('resolved_at = ?');
    values.push(resolved_at ? new Date(resolved_at).toISOString() : null);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No updates provided' });
  }

  updates.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  db.run(
    `UPDATE search_rescue_operations SET ${updates.join(', ')} WHERE id = ?`,
    values,
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to update search and rescue operation' });
      }
      res.json({ success: true, message: 'Search and rescue operation updated successfully' });
    }
  );
});

app.delete('/api/personnel/search-rescue/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM search_rescue_operations WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete search and rescue operation' });
    }
    res.json({ success: true, message: 'Search and rescue operation deleted successfully' });
  });
});

// Health check endpoint to verify database and server are working
app.get('/api/health', (req, res) => {
  // Check if database is accessible
  db.get('SELECT COUNT(*) as count FROM users', [], (err, result) => {
    if (err) {
      console.error('Database health check failed:', err);
      return res.status(500).json({ 
        status: 'error', 
        message: 'Database connection failed',
        error: err.message 
      });
    }
    
    // Check if admin user exists
    db.get('SELECT username, role FROM users WHERE username = ?', ['admin'], (adminErr, adminUser) => {
      res.json({ 
        status: 'ok', 
        message: 'Server and database are operational',
        userCount: result.count,
        adminUserExists: !!adminUser,
        adminUser: adminUser || null,
        databasePath: dbPath,
        environment: process.env.NODE_ENV || 'development',
        defaultCredentials: {
          username: 'admin',
          password: 'admin123',
          note: 'Use these credentials if admin user exists'
        }
      });
    });
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

app.post('/api/public/push/subscribe', async (req, res) => {
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
  try {
    if (isPostgres) {
      // PostgreSQL uses INSERT ... ON CONFLICT
      await run(
        `INSERT INTO push_subscriptions (endpoint, p256dh, auth)
         VALUES (?, ?, ?)
         ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
        [subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]
      );
    } else {
      // SQLite uses INSERT OR REPLACE
      await run(
        `INSERT OR REPLACE INTO push_subscriptions (endpoint, p256dh, auth)
         VALUES (?, ?, ?)`,
        [subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]
      );
    }
    console.log(`✅ Subscription saved successfully. Endpoint: ${subscription.endpoint.substring(0, 50)}...`);
    res.json({ success: true, message: 'Subscription saved successfully' });
  } catch (err) {
    console.error('Error storing push subscription:', err);
    return res.status(500).json({ error: 'Failed to store subscription' });
  }
});

app.post('/api/public/push/unsubscribe', async (req, res) => {
  const { endpoint } = req.body;

  if (!endpoint) {
    return res.status(400).json({ error: 'Endpoint is required' });
  }

  try {
    await run('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint]);
    res.json({ success: true, message: 'Subscription removed successfully' });
  } catch (err) {
    console.error('Error removing push subscription:', err);
    return res.status(500).json({ error: 'Failed to remove subscription' });
  }
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
  
  // Build flag to track if build is in progress
  let isBuilding = false;
  let buildComplete = fs.existsSync(buildPath) && fs.existsSync(indexPath);
  
  // Function to build React app asynchronously
  function buildReactAppAsync() {
    if (isBuilding || buildComplete) return;
    isBuilding = true;
    
    console.log('========================================');
    console.log('Build directory not found. Building React app in background...');
    console.log('========================================');
    
    // Run build asynchronously so server can start
    setImmediate(() => {
      try {
        const clientPath = path.join(__dirname, '../client');
        const originalCwd = process.cwd();
        
        console.log('Changing to client directory:', clientPath);
        if (!fs.existsSync(clientPath)) {
          throw new Error(`Client directory not found at ${clientPath}`);
        }
        process.chdir(clientPath);
        console.log('Current directory after change:', process.cwd());
        
        console.log('Installing client dependencies...');
        execSync('npm install --production=false', { 
          stdio: 'inherit',
          cwd: clientPath
        });
        console.log('✓ Dependencies installed');
        
        console.log('Building React app (this may take 2-5 minutes)...');
        console.log('Please wait, this is a one-time build...');
        execSync('CI=false npm run build', { 
          stdio: 'inherit',
          cwd: clientPath,
          env: { ...process.env, CI: 'false', NODE_ENV: 'production' },
          maxBuffer: 10 * 1024 * 1024
        });
        
        process.chdir(originalCwd);
        
        // Verify build was created
        const absoluteBuildPath = path.resolve(buildPath);
        const absoluteIndexPath = path.resolve(indexPath);
        
        console.log('Verifying build...');
        if (fs.existsSync(absoluteBuildPath) && fs.existsSync(absoluteIndexPath)) {
          console.log('========================================');
          console.log('✓ Build completed successfully!');
          console.log('✓ Build directory:', absoluteBuildPath);
          console.log('✓ index.html found');
          console.log('========================================');
          buildComplete = true;
        } else {
          throw new Error('Build completed but verification failed');
        }
      } catch (error) {
        console.error('========================================');
        console.error('ERROR: Failed to build React app');
        console.error('========================================');
        console.error('Error message:', error.message);
        if (error.stdout) console.error('stdout:', error.stdout.toString().slice(0, 500));
        if (error.stderr) console.error('stderr:', error.stderr.toString().slice(0, 500));
        console.error('========================================');
      } finally {
        isBuilding = false;
      }
    });
  }
  
  // Check if build exists, if not start building
  if (!buildComplete) {
    buildReactAppAsync();
  }
  
  // Always set up static file serving (even if build is in progress)
  if (fs.existsSync(buildPath)) {
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
  } else {
    console.log('Build directory not found - will build in background');
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
  app.get('*', (req, res, next) => {
    // Don't serve React app for API routes
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
    }
    
    // Send index.html for all other routes (React Router will handle routing)
    if (fs.existsSync(indexPath)) {
      res.sendFile(path.resolve(indexPath));
    } else {
      // Build is in progress or failed - show loading message
      if (isBuilding) {
        res.status(503).send(`
          <html>
            <head><title>Building...</title></head>
            <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
              <h1>Building React App</h1>
              <p>The React app is currently being built. This may take 2-5 minutes.</p>
              <p>Please wait and refresh the page in a few minutes.</p>
              <p><small>This is a one-time process that happens on first deployment.</small></p>
            </body>
          </html>
        `);
      } else {
        // Trigger build if not already building
        buildReactAppAsync();
        res.status(503).send(`
          <html>
            <head><title>Building...</title></head>
            <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
              <h1>Starting Build</h1>
              <p>The React app build is starting. This may take 2-5 minutes.</p>
              <p>Please wait and refresh the page in a few minutes.</p>
              <p><small>This is a one-time process that happens on first deployment.</small></p>
            </body>
          </html>
        `);
      }
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

// Diagnostic endpoint to check build status
app.get('/api/debug/build-status', (req, res) => {
  const buildPath = path.join(__dirname, '../client/build');
  const indexPath = path.join(buildPath, 'index.html');
  
  res.json({
    buildPath,
    indexPath,
    buildExists: fs.existsSync(buildPath),
    indexExists: fs.existsSync(indexPath),
    currentDir: process.cwd(),
    __dirname: __dirname,
    nodeEnv: process.env.NODE_ENV,
    buildContents: fs.existsSync(buildPath) ? fs.readdirSync(buildPath) : []
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  if (process.env.NODE_ENV === 'production') {
    const buildPath = path.join(__dirname, '../client/build');
    if (fs.existsSync(buildPath)) {
      console.log(`Serving React app from: ${buildPath}`);
      try {
        const files = fs.readdirSync(buildPath);
        console.log(`Build directory contains ${files.length} items`);
      } catch (e) {
        console.error('Could not read build directory:', e.message);
      }
    } else {
      console.error(`WARNING: Build directory not found at ${buildPath}`);
      console.error('The React app may not be built. Run "npm run build" first.');
    }
  }
  console.log('Available routes:');
  console.log('  POST /api/auth/login');
  console.log('  GET /api/health (health check)');
  console.log('  POST /api/personnel/closed-areas');
  console.log('  GET /api/personnel/closed-areas');
  console.log('  GET /api/debug/build-status (diagnostic)');
  
  // Verify admin user after server starts
  setTimeout(() => {
    db.get('SELECT id, username, role FROM users WHERE username = ?', ['admin'], (err, admin) => {
      if (err) {
        console.error('⚠️ Error checking admin user:', err);
      } else if (admin) {
        console.log(`✅ Admin user verified: ID=${admin.id}, username=${admin.username}, role=${admin.role}`);
        console.log('   Default login: username=admin, password=admin123');
      } else {
        console.log('⚠️ Admin user not found. It should be created automatically.');
      }
    });
  }, 2000);
});

