// Production start script
process.env.NODE_ENV = 'production';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const buildPath = path.join(__dirname, '../client/build');
const indexPath = path.join(buildPath, 'index.html');

console.log('========================================');
console.log('Checking for build before starting server...');
console.log('========================================');
console.log('Build path:', buildPath);
console.log('Current working directory:', process.cwd());
console.log('__dirname:', __dirname);

// Check if build exists
if (!fs.existsSync(buildPath) || !fs.existsSync(indexPath)) {
  console.log('Build directory not found. Attempting to build now...');
  console.log('This may take a few minutes...');
  
  try {
    // Change to client directory and build
    const clientPath = path.join(__dirname, '../client');
    process.chdir(clientPath);
    
    console.log('Installing client dependencies...');
    execSync('npm install --production=false', { stdio: 'inherit' });
    
    console.log('Building React app...');
    execSync('CI=false npm run build', { stdio: 'inherit' });
    
    // Verify build was created
    const newBuildPath = path.join(clientPath, 'build');
    if (fs.existsSync(newBuildPath) && fs.existsSync(path.join(newBuildPath, 'index.html'))) {
      console.log('✓ Build completed successfully!');
    } else {
      console.error('ERROR: Build completed but index.html not found!');
      process.exit(1);
    }
    
    // Change back to server directory
    process.chdir(__dirname);
  } catch (error) {
    console.error('ERROR: Failed to build React app:', error.message);
    console.error('Please check the build logs above for details.');
    process.exit(1);
  }
} else {
  console.log('✓ Build directory found');
  console.log('✓ index.html found');
  console.log('Build is ready, starting server...');
}

console.log('========================================');
require('./index.js');

