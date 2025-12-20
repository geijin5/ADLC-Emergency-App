// Database adapter that supports both SQLite (dev) and PostgreSQL (production)
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let db = null;
let dbType = null;

// Initialize database connection
function initDatabase() {
  const DATABASE_URL = process.env.DATABASE_URL;
  
  if (DATABASE_URL) {
    // Use PostgreSQL in production (Render provides DATABASE_URL)
    dbType = 'postgres';
    const { Pool } = require('pg');
    db = new Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      // Connection pool settings to prevent connection termination issues
      max: 10, // Maximum number of clients in the pool
      min: 2, // Minimum number of clients to keep in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 20000, // Increased to 20 seconds for Render
      // Handle connection errors gracefully
      allowExitOnIdle: false,
      // Keep connections alive
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000
    });
    
    // Handle connection errors - suppress transient errors during initialization
    let initializationComplete = false;
    db.on('error', (err) => {
      // Only log errors after initialization is complete
      // Transient connection errors during startup are expected on Render
      if (initializationComplete) {
        console.error('Unexpected PostgreSQL pool error:', err);
      }
      // Don't exit - let the pool handle reconnection
    });
    
    // Test the connection with retry logic
    (async () => {
      const maxRetries = 5;
      const retryDelay = 2000; // 2 seconds between retries
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const result = await db.query('SELECT NOW()');
          console.log('✅ PostgreSQL database connection established');
          initializationComplete = true;
          break;
        } catch (err) {
          // Suppress "Connection terminated unexpectedly" errors during initialization
          // These are common on Render and the connection will be retried
          if (err.message && err.message.includes('Connection terminated')) {
            if (attempt < maxRetries) {
              console.log(`⚠️ PostgreSQL connection attempt ${attempt}/${maxRetries} - retrying...`);
            } else {
              console.log(`⚠️ PostgreSQL connection test completed with transient errors (this is normal on Render)`);
              console.log(`   The connection will be established on first database operation.`);
            }
          } else if (attempt === maxRetries) {
            console.error(`❌ PostgreSQL connection test failed after ${maxRetries} attempts:`, err.message);
          } else {
            console.log(`⚠️ PostgreSQL connection test attempt ${attempt}/${maxRetries} failed, retrying in ${retryDelay}ms...`);
          }
          
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          } else {
            // Mark as complete even if connection test failed
            // The connection will be established on first use
            initializationComplete = true;
          }
        }
      }
    })();
  } else {
    // Use SQLite in development
    dbType = 'sqlite';
    const dbPath = path.join(__dirname, 'emergency.db');
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening SQLite database:', err);
      } else {
        console.log('✅ SQLite database connection established');
      }
    });
  }
  
  return { db, dbType };
}

// Convert SQLite placeholders (?) to PostgreSQL placeholders ($1, $2, etc.)
function convertPlaceholders(sql, params) {
  if (dbType === 'postgres' && sql.includes('?')) {
    let paramIndex = 1;
    sql = sql.replace(/\?/g, () => `$${paramIndex++}`);
  }
  return sql;
}

// Helper function to execute queries that don't return data (INSERT, UPDATE, DELETE)
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    const originalSQL = sql;
    sql = convertPlaceholders(sql, params);
    
    if (dbType === 'postgres') {
      // For INSERT statements, add RETURNING id if not present
      if (sql.trim().toUpperCase().startsWith('INSERT') && !sql.includes('RETURNING')) {
        sql = sql + ' RETURNING id';
      }
      
      // Use promise-based query with better error handling
      db.query(sql, params)
        .then((result) => {
          // PostgreSQL returns different structure
          // For INSERT, get the last inserted ID from RETURNING clause
          let lastID = null;
          if (result.rows && result.rows.length > 0 && result.rows[0].id) {
            lastID = result.rows[0].id;
          }
          resolve({ 
            lastID: lastID,
            changes: result.rowCount || 0 
          });
        })
        .catch((err) => {
          reject(err);
        });
    } else {
      // SQLite
      db.run(originalSQL, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ lastID: this.lastID, changes: this.changes });
        }
      });
    }
  });
}

// Helper function to execute queries that return a single row
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    sql = convertPlaceholders(sql, params);
    
    if (dbType === 'postgres') {
      db.query(sql, params)
        .then((result) => {
          resolve(result.rows[0] || null);
        })
        .catch((err) => {
          reject(err);
        });
    } else {
      // SQLite
      db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    }
  });
}

// Helper function to execute queries that return multiple rows
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    sql = convertPlaceholders(sql, params);
    
    if (dbType === 'postgres') {
      db.query(sql, params)
        .then((result) => {
          resolve(result.rows);
        })
        .catch((err) => {
          reject(err);
        });
    } else {
      // SQLite
      db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    }
  });
}

// Helper function to serialize multiple queries (SQLite only, PostgreSQL doesn't need this)
async function serialize(callback) {
  if (dbType === 'postgres') {
    // PostgreSQL doesn't need serialization, just execute and await the callback
    await callback();
  } else {
    // SQLite serialization - wrap in promise to handle async callback
    return new Promise((resolve, reject) => {
      db.serialize(async () => {
        try {
          await callback();
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    });
  }
}

// Convert SQLite SQL to PostgreSQL-compatible SQL
function convertSQL(sql) {
  if (dbType === 'postgres') {
    // Convert SQLite-specific syntax to PostgreSQL
    sql = sql.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'SERIAL PRIMARY KEY');
    sql = sql.replace(/AUTOINCREMENT/g, '');
    sql = sql.replace(/INTEGER PRIMARY KEY/g, 'SERIAL PRIMARY KEY');
    sql = sql.replace(/DATETIME/g, 'TIMESTAMP');
    sql = sql.replace(/INTEGER DEFAULT 1/g, 'BOOLEAN DEFAULT true');
    sql = sql.replace(/INTEGER DEFAULT 0/g, 'BOOLEAN DEFAULT false');
    sql = sql.replace(/INSERT OR IGNORE INTO/g, 'INSERT INTO');
    sql = sql.replace(/CREATE TABLE IF NOT EXISTS/g, 'CREATE TABLE IF NOT EXISTS');
    
    // Handle INSERT OR IGNORE - need to add ON CONFLICT clause
    // This is handled separately in the code
  }
  return sql;
}

// Execute a query with INSERT OR IGNORE semantics
function insertOrIgnore(table, values, conflictColumn = null) {
  if (dbType === 'postgres') {
    if (conflictColumn) {
      const columns = Object.keys(values);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT (${conflictColumn}) DO NOTHING`;
      return run(sql, Object.values(values));
    } else {
      // Fallback to regular insert
      const columns = Object.keys(values);
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
      return run(sql, Object.values(values));
    }
  } else {
    // SQLite
    const columns = Object.keys(values);
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT OR IGNORE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
    return run(sql, Object.values(values));
  }
}

module.exports = {
  initDatabase,
  run,
  get,
  all,
  serialize,
  convertSQL,
  insertOrIgnore,
  getDb: () => db,
  getDbType: () => dbType
};

