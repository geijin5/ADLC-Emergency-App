// Production start script
// This script ALWAYS builds the React app during startup to ensure it's available
process.env.NODE_ENV = 'production';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const buildPath = path.join(__dirname, '../client/build');
const indexPath = path.join(buildPath, 'index.html');
const clientPath = path.join(__dirname, '../client');

console.log('========================================');
console.log('Production Server Startup');
console.log('========================================');
console.log('Build path:', buildPath);
console.log('Client path:', clientPath);
console.log('Current working directory:', process.cwd());
console.log('__dirname:', __dirname);

// Function to build the React app
function buildReactApp() {
  console.log('========================================');
  console.log('Building React app (this will happen on every start)...');
  console.log('========================================');
  
  try {
    // Verify client directory exists
    if (!fs.existsSync(clientPath)) {
      throw new Error(`Client directory not found at ${clientPath}`);
    }
    
    const originalCwd = process.cwd();
    console.log('Changing to client directory:', clientPath);
    process.chdir(clientPath);
    console.log('Current directory:', process.cwd());
    
    // Always install dependencies to ensure they're up to date
    console.log('Installing/updating client dependencies...');
    try {
      execSync('npm install --production=false', { 
        stdio: 'inherit',
        cwd: clientPath
      });
      console.log('✓ Dependencies installed');
    } catch (installError) {
      console.warn('Warning: npm install had issues, but continuing...', installError.message);
    }
    
    // Build the React app
    console.log('Building React app (this may take 2-5 minutes)...');
    console.log('Please wait...');
    
    execSync('CI=false npm run build', { 
      stdio: 'inherit',
      cwd: clientPath,
      env: { ...process.env, CI: 'false', NODE_ENV: 'production' },
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large output
    });
    
    // Verify build was created
    const newBuildPath = path.join(clientPath, 'build');
    const newIndexPath = path.join(newBuildPath, 'index.html');
    
    console.log('Verifying build...');
    console.log('Checking build path:', newBuildPath);
    console.log('Checking index path:', newIndexPath);
    
    if (!fs.existsSync(newBuildPath)) {
      throw new Error(`Build directory was not created at ${newBuildPath}`);
    }
    
    if (!fs.existsSync(newIndexPath)) {
      // List what's in the build directory
      try {
        const buildFiles = fs.readdirSync(newBuildPath);
        console.error('Build directory exists but index.html is missing!');
        console.error('Files in build directory:', buildFiles);
      } catch (e) {
        console.error('Could not read build directory:', e.message);
      }
      throw new Error(`index.html was not created at ${newIndexPath}`);
    }
    
    console.log('========================================');
    console.log('✓ Build completed successfully!');
    console.log('✓ Build directory:', newBuildPath);
    console.log('✓ index.html found');
    
    // List some build contents
    try {
      const buildFiles = fs.readdirSync(newBuildPath);
      console.log('Build directory contains:', buildFiles.length, 'items');
      if (buildFiles.length > 0) {
        console.log('Sample files:', buildFiles.slice(0, 5).join(', '));
      }
    } catch (e) {
      console.warn('Could not list build directory:', e.message);
    }
    
    console.log('========================================');
    
    // Change back to original directory
    process.chdir(originalCwd);
    return true;
  } catch (error) {
    console.error('========================================');
    console.error('FATAL ERROR: Failed to build React app');
    console.error('========================================');
    console.error('Error message:', error.message);
    if (error.stdout) {
      console.error('stdout:', error.stdout.toString().slice(0, 1000));
    }
    if (error.stderr) {
      console.error('stderr:', error.stderr.toString().slice(0, 1000));
    }
    console.error('Please check the build logs above for details.');
    console.error('========================================');
    return false;
  }
}

// ALWAYS build the React app (don't check if it exists first)
// This ensures the build is always fresh and in the right location
console.log('Building React app...');
const buildSuccess = buildReactApp();

if (!buildSuccess) {
  console.error('========================================');
  console.error('FATAL: Could not build React app');
  console.error('Server cannot start without a built React app');
  console.error('========================================');
  process.exit(1);
}

// Final verification before starting server
if (!fs.existsSync(buildPath) || !fs.existsSync(indexPath)) {
  console.error('========================================');
  console.error('FATAL: Build verification failed');
  console.error('========================================');
  console.error('Build path:', buildPath);
  console.error('Index path:', indexPath);
  console.error('Build exists:', fs.existsSync(buildPath));
  console.error('Index exists:', fs.existsSync(indexPath));
  
  // Try to list what's actually there
  try {
    if (fs.existsSync(clientPath)) {
      const files = fs.readdirSync(clientPath);
      console.error('Files in client directory:', files);
    }
    if (fs.existsSync(buildPath)) {
      const buildFiles = fs.readdirSync(buildPath);
      console.error('Files in build directory:', buildFiles);
    }
  } catch (e) {
    console.error('Could not list directories:', e.message);
  }
  
  process.exit(1);
}

console.log('========================================');
console.log('✓ Build verified successfully');
console.log('✓ Starting Express server...');
console.log('========================================');

require('./index.js');
