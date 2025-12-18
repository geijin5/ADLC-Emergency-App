const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'emergency.db');
const db = new sqlite3.Database(dbPath);

console.log('Testing admin login...\n');

// Test 1: Check if admin user exists
db.get('SELECT * FROM users WHERE username = ?', ['admin'], (err, user) => {
  if (err) {
    console.error('❌ Database error:', err);
    db.close();
    return;
  }
  
  if (!user) {
    console.error('❌ Admin user not found in database!');
    db.close();
    return;
  }
  
  console.log('✅ Admin user found:');
  console.log('   ID:', user.id);
  console.log('   Username:', user.username);
  console.log('   Role:', user.role);
  console.log('   Name:', user.name);
  console.log('   Password hash:', user.password.substring(0, 20) + '...');
  console.log('');
  
  // Test 2: Test password comparison
  console.log('Testing password "admin123"...');
  bcrypt.compare('admin123', user.password, (err, match) => {
    if (err) {
      console.error('❌ Password comparison error:', err);
      db.close();
      return;
    }
    
    if (match) {
      console.log('✅ Password "admin123" matches!');
    } else {
      console.log('❌ Password "admin123" does NOT match!');
      console.log('   This means the password hash is incorrect.');
      console.log('   Resetting password...');
      
      const newPassword = bcrypt.hashSync('admin123', 10);
      db.run('UPDATE users SET password = ? WHERE username = ?', [newPassword, 'admin'], function(err) {
        if (err) {
          console.error('❌ Error resetting password:', err);
        } else {
          console.log('✅ Password reset successfully!');
          console.log('   Try logging in again with: username=admin, password=admin123');
        }
        db.close();
      });
      return;
    }
    
    console.log('');
    console.log('✅ All tests passed! Login should work with:');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    db.close();
  });
});

