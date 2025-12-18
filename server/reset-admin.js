const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'emergency.db');
const db = new sqlite3.Database(dbPath);

console.log('Resetting admin user...');

const defaultPassword = bcrypt.hashSync('admin123', 10);

// First, try to delete existing admin user if it exists
db.run('DELETE FROM users WHERE username = ?', ['admin'], function(err) {
  if (err) {
    console.error('Error deleting existing admin:', err);
  } else {
    console.log('Deleted existing admin user (if it existed)');
  }

  // Now create the admin user
  db.run(
    `INSERT INTO users (username, password, role, name) 
     VALUES (?, ?, ?, ?)`,
    ['admin', defaultPassword, 'admin', 'Administrator'],
    function(err) {
      if (err) {
        console.error('Error creating admin user:', err);
      } else {
        console.log('✅ Admin user created successfully!');
        console.log('   Username: admin');
        console.log('   Password: admin123');
      }
      db.close();
    }
  );
});

