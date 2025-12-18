// Build verification script
const fs = require('fs');
const path = require('path');

const buildPath = path.join(__dirname, 'client/build');
const indexPath = path.join(buildPath, 'index.html');

console.log('Verifying build...');
console.log('Build path:', buildPath);
console.log('Index path:', indexPath);

if (!fs.existsSync(buildPath)) {
  console.error('ERROR: Build directory does not exist!');
  process.exit(1);
}

if (!fs.existsSync(indexPath)) {
  console.error('ERROR: index.html not found in build directory!');
  process.exit(1);
}

console.log('✓ Build verification passed!');
console.log('Build directory exists');
console.log('index.html found');

