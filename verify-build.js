// Build verification script
const fs = require('fs');
const path = require('path');

const buildPath = path.join(__dirname, 'client/build');
const indexPath = path.join(buildPath, 'index.html');

console.log('========================================');
console.log('Verifying build...');
console.log('========================================');
console.log('Current directory:', __dirname);
console.log('Build path:', buildPath);
console.log('Index path:', indexPath);

// Check if build directory exists
if (!fs.existsSync(buildPath)) {
  console.error('========================================');
  console.error('ERROR: Build directory does not exist!');
  console.error('========================================');
  console.error('Expected path:', buildPath);
  
  // Try to list parent directory to help debug
  const clientPath = path.join(__dirname, 'client');
  if (fs.existsSync(clientPath)) {
    console.error('Contents of client directory:');
    try {
      const files = fs.readdirSync(clientPath);
      files.forEach(file => console.error('  -', file));
    } catch (e) {
      console.error('Could not read client directory:', e.message);
    }
  } else {
    console.error('Client directory does not exist at:', clientPath);
  }
  
  process.exit(1);
}

// Check if index.html exists
if (!fs.existsSync(indexPath)) {
  console.error('========================================');
  console.error('ERROR: index.html not found in build directory!');
  console.error('========================================');
  console.error('Expected path:', indexPath);
  
  // List what's actually in the build directory
  try {
    const files = fs.readdirSync(buildPath);
    console.error('Contents of build directory:');
    files.forEach(file => console.error('  -', file));
  } catch (e) {
    console.error('Could not read build directory:', e.message);
  }
  
  process.exit(1);
}

// Verify static directory exists
const staticPath = path.join(buildPath, 'static');
if (!fs.existsSync(staticPath)) {
  console.warn('WARNING: static directory not found, but continuing...');
} else {
  console.log('✓ static directory found');
}

// List build directory contents
try {
  const files = fs.readdirSync(buildPath);
  console.log('Build directory contents:');
  files.forEach(file => {
    const filePath = path.join(buildPath, file);
    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      console.log('  📁', file, '/');
    } else {
      console.log('  📄', file, `(${stats.size} bytes)`);
    }
  });
} catch (e) {
  console.warn('Could not list build directory:', e.message);
}

console.log('========================================');
console.log('✓ Build verification passed!');
console.log('========================================');
console.log('✓ Build directory exists');
console.log('✓ index.html found');
console.log('Build is ready for deployment!');
console.log('========================================');

