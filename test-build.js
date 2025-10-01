const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

console.log('🔄 Testing build process...');

// Ensure public directory exists
if (!fs.existsSync('public')) {
  fs.mkdirSync('public');
  console.log('✅ Created public directory');
}

// Get version from package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = packageJson.version;
console.log('📦 Version:', version);

// Check if release directory exists
if (!fs.existsSync('release')) {
  console.log('❌ Release directory not found. Run npm run build:win first');
  process.exit(1);
}

// Find the portable ZIP file
const releaseFiles = fs.readdirSync('release');
const portableZip = releaseFiles.find(file => file.includes('NovaQ-Portable') && file.endsWith('.zip'));

if (!portableZip) {
  console.log('❌ Portable ZIP not found in release directory');
  console.log('Available files:', releaseFiles);
  process.exit(1);
}

console.log('📦 Found portable ZIP:', portableZip);

// Copy ZIP to public directory with proper naming
const sourceZip = path.join('release', portableZip);
const targetZip = path.join('public', `NovaQ-Portable-${version}.zip`);

try {
  fs.copyFileSync(sourceZip, targetZip);
  console.log('✅ Copied ZIP to public directory');
  
  // Get file size
  const stats = fs.statSync(targetZip);
  console.log('📊 File size:', (stats.size / 1024 / 1024).toFixed(2), 'MB');
  
  // Create latest.json for updater
  const crypto = require('crypto');
  const fileBuffer = fs.readFileSync(targetZip);
  const sha512 = crypto.createHash('sha512').update(fileBuffer).digest('hex');
  
  const latestJson = {
    name: "NovaQ Desktop Portable",
    version: version,
    programVersion: version,
    description: "Шинэчлэлтийн хувилбар",
    url: `https://desktop-f96376.gitlab.io/NovaQ-Portable-${version}.zip`,
    sha512: sha512,
    size: stats.size,
    releaseDate: new Date().toISOString()
  };
  
  fs.writeFileSync('public/latest.json', JSON.stringify(latestJson, null, 2));
  console.log('✅ Created latest.json');
  
  // Create latest.yml for auto-updater
  const latestYml = `version: "${version}"
files:
  - url: "NovaQ-Portable-${version}.zip"
    sha512: "${sha512}"
    size: ${stats.size}
path: "NovaQ-Portable-${version}.zip"
sha512: "${sha512}"
releaseDate: "${new Date().toISOString()}"`;

  fs.writeFileSync('public/latest.yml', latestYml);
  console.log('✅ Created latest.yml');
  
  // Create simple index.html
  const indexHtml = `<!DOCTYPE html>
<html>
<head>
    <title>NovaQ Desktop Downloads</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        ul { list-style-type: none; }
        li { margin: 10px 0; }
        a { text-decoration: none; color: #0066cc; }
        a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <h1>NovaQ Desktop Downloads</h1>
    <ul>
        <li><a href="NovaQ-Portable-${version}.zip">📦 NovaQ-Portable-${version}.zip (Portable)</a></li>
        <li><a href="latest.json">📄 latest.json (Update Info)</a></li>
        <li><a href="latest.yml">📄 latest.yml (Update Info)</a></li>
    </ul>
    <p><small>Generated: ${new Date().toLocaleString()}</small></p>
</body>
</html>`;

  fs.writeFileSync('public/index.html', indexHtml);
  console.log('✅ Created index.html');
  
  console.log('\n🎉 Build test completed successfully!');
  console.log('📁 Public directory contents:');
  const publicFiles = fs.readdirSync('public');
  publicFiles.forEach(file => {
    const filePath = path.join('public', file);
    const fileStats = fs.statSync(filePath);
    console.log(`  - ${file} (${(fileStats.size / 1024).toFixed(1)} KB)`);
  });
  
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
