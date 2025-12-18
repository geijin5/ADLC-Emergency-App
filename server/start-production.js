// Production start script
process.env.NODE_ENV = 'production';

// Verify build exists before starting
const fs = require('fs');
const path = require('path');
const buildPath = path.join(__dirname, '../client/build');
const indexPath = path.join(buildPath, 'index.html');

console.log('Checking for build before starting server...');
console.log('Build path:', buildPath);
console.log('Current working directory:', process.cwd());
console.log('__dirname:', __dirname);

if (!fs.existsSync(buildPath)) {
  console.error('ERROR: Build directory not found!');
  console.error('Expected location:', buildPath);
  console.error('This should have been created during the build phase.');
  console.error('Please check the build logs to ensure the React app was built successfully.');
  process.exit(1);
}

if (!fs.existsSync(indexPath)) {
  console.error('ERROR: index.html not found in build directory!');
  console.error('Expected location:', indexPath);
  process.exit(1);
}

console.log('✓ Build verified, starting server...');
require('./index.js');

