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
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    console.log('✅ PostgreSQL database connection established');
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
      
      db.query(sql, params, (err, result) => {
        if (err) {
          reject(err);
        } else {
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
        }
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
      db.query(sql, params, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result.rows[0] || null);
        }
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
      db.query(sql, params, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result.rows);
        }
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
function serialize(callback) {
  if (dbType === 'postgres') {
    // PostgreSQL doesn't need serialization, just execute the callback
    callback();
  } else {
    // SQLite serialization
    db.serialize(callback);
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

