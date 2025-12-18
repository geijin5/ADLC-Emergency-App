// Production start script
process.env.NODE_ENV = 'production';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const buildPath = path.join(__dirname, '../client/build');
const indexPath = path.join(buildPath, 'index.html');

console.log('========================================');
console.log('Production Server Startup');
console.log('========================================');
console.log('Build path:', buildPath);
console.log('Index path:', indexPath);
console.log('Current working directory:', process.cwd());
console.log('__dirname:', __dirname);

// Function to build the React app
function buildReactApp() {
  console.log('========================================');
  console.log('Building React app...');
  console.log('========================================');
  
  try {
    const clientPath = path.join(__dirname, '../client');
    const originalCwd = process.cwd();
    
    console.log('Changing to client directory:', clientPath);
    
    // Check if client directory exists
    if (!fs.existsSync(clientPath)) {
      throw new Error(`Client directory not found at ${clientPath}`);
    }
    
    process.chdir(clientPath);
    console.log('Current directory after change:', process.cwd());
    
    // Check if node_modules exists, if not install
    const nodeModulesPath = path.join(clientPath, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
      console.log('Installing client dependencies...');
      execSync('npm install --production=false', { 
        stdio: 'inherit',
        cwd: clientPath
      });
      console.log('✓ Dependencies installed');
    } else {
      console.log('✓ Dependencies already installed');
    }
    
    // Build the React app
    console.log('Building React app (this may take a few minutes)...');
    execSync('CI=false npm run build', { 
      stdio: 'inherit',
      cwd: clientPath,
      env: { ...process.env, CI: 'false' }
    });
    
    // Verify build was created
    const newBuildPath = path.join(clientPath, 'build');
    const newIndexPath = path.join(newBuildPath, 'index.html');
    
    console.log('Verifying build...');
    console.log('Build path:', newBuildPath);
    console.log('Index path:', newIndexPath);
    console.log('Build exists:', fs.existsSync(newBuildPath));
    console.log('Index exists:', fs.existsSync(newIndexPath));
    
    if (fs.existsSync(newBuildPath) && fs.existsSync(newIndexPath)) {
      console.log('========================================');
      console.log('✓ Build completed successfully!');
      console.log('✓ Build directory:', newBuildPath);
      console.log('✓ index.html found');
      console.log('========================================');
      
      // List build contents
      try {
        const buildFiles = fs.readdirSync(newBuildPath);
        console.log('Build directory contents:', buildFiles.slice(0, 10));
      } catch (e) {
        console.warn('Could not list build directory:', e.message);
      }
    } else {
      throw new Error('Build completed but index.html not found');
    }
    
    // Change back to original directory
    process.chdir(originalCwd);
    return true;
  } catch (error) {
    console.error('========================================');
    console.error('ERROR: Failed to build React app');
    console.error('========================================');
    console.error('Error message:', error.message);
    if (error.stdout) console.error('stdout:', error.stdout.toString());
    if (error.stderr) console.error('stderr:', error.stderr.toString());
    console.error('Please check the build logs above for details.');
    return false;
  }
}

// Check if build exists
if (!fs.existsSync(buildPath) || !fs.existsSync(indexPath)) {
  console.log('Build directory not found or incomplete.');
  console.log('Attempting to build now...');
  
  const buildSuccess = buildReactApp();
  
  if (!buildSuccess) {
    console.error('========================================');
    console.error('FATAL: Could not build React app');
    console.error('========================================');
    process.exit(1);
  }
  
  // Double-check build exists after building
  if (!fs.existsSync(buildPath) || !fs.existsSync(indexPath)) {
    console.error('========================================');
    console.error('FATAL: Build directory still not found after build attempt');
    console.error('========================================');
    console.error('Build path:', buildPath);
    console.error('Index path:', indexPath);
    console.error('Build exists:', fs.existsSync(buildPath));
    console.error('Index exists:', fs.existsSync(indexPath));
    
    // Try to list what's actually there
    try {
      const clientPath = path.join(__dirname, '../client');
      if (fs.existsSync(clientPath)) {
        const files = fs.readdirSync(clientPath);
        console.error('Files in client directory:', files);
      }
    } catch (e) {
      console.error('Could not list client directory:', e.message);
    }
    
    process.exit(1);
  }
} else {
  console.log('========================================');
  console.log('✓ Build directory found');
  console.log('✓ index.html found');
  console.log('Build is ready, starting server...');
  console.log('========================================');
}

console.log('Starting Express server...');
require('./index.js');
