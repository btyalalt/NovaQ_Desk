const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');

const app = express();
const PORT = 3201;

// Serve static files from dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// Mock API endpoints for development
app.get('/api/version/database-status', (req, res) => {
  console.log('📡 Mock API: /api/version/database-status called');
  res.json({
    success: true,
    status: 'connected',
    message: 'Database connection successful (mock)',
    timestamp: new Date().toISOString(),
    version: {
      programVersion: '1.0.4'
    }
  });
});

// Serve the main HTML file for all routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Function to copy assets
function copyAssets() {
  const assetsPath = path.join(__dirname, 'assets');
  const distAssetsPath = path.join(__dirname, 'dist', 'assets');
  
  if (fs.existsSync(assetsPath)) {
    // Create assets directory if it doesn't exist
    if (!fs.existsSync(distAssetsPath)) {
      fs.mkdirSync(distAssetsPath, { recursive: true });
    }
    
    // Copy all files from assets to dist/assets
    const files = fs.readdirSync(assetsPath);
    files.forEach(file => {
      const sourcePath = path.join(assetsPath, file);
      const destPath = path.join(distAssetsPath, file);
      fs.copyFileSync(sourcePath, destPath);
    });
    console.log('📁 Assets copied successfully');
  }
}

// Function to rebuild the project
let isBuilding = false;
function rebuild() {
  if (isBuilding) {
    console.log('🔄 Build already in progress, skipping...');
    return;
  }
  
  isBuilding = true;
  console.log('🔄 Rebuilding project...');
  exec('npm run webpack:build', (error, stdout, stderr) => {
    isBuilding = false;
    if (error) {
      console.error('❌ Build error:', error);
      return;
    }
    console.log('✅ Build completed successfully');
    copyAssets();
  });
}

// Watch for file changes
let debounceTimer = null;
function watchFiles() {
  const srcPath = path.join(__dirname, 'src');
  
  fs.watch(srcPath, { recursive: true }, (eventType, filename) => {
    if (filename && !filename.includes('node_modules') && !filename.includes('.tmp')) {
      console.log(`📝 File changed: ${filename}`);
      
      // Debounce rapid file changes
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        rebuild();
      }, 300); // Wait 300ms before rebuilding
    }
  });
}

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Development server running at http://localhost:${PORT}`);
  console.log(`📁 Serving files from: ${path.join(__dirname, 'dist')}`);
  console.log(`👀 Watching for changes in: ${path.join(__dirname, 'src')}`);
  
  // Initial build
  rebuild();
  
  // Start watching for changes
  watchFiles();
});
