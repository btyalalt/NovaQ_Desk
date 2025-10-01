const fs = require('fs');
const path = require('path');

console.log('🧹 Cleaning portable build...');

const releaseDir = path.join(__dirname, '..', 'release');
const winUnpackedDir = path.join(releaseDir, 'win-unpacked');

if (!fs.existsSync(winUnpackedDir)) {
  console.log('⚠️ win-unpacked directory not found');
  process.exit(0);
}

// Files and directories to remove for smaller portable size
const itemsToRemove = [
  // Unnecessary locale files (keep only en-US and a few essential ones)
  'locales/af.pak',
  'locales/am.pak',
  'locales/ar.pak',
  'locales/bg.pak',
  'locales/bn.pak',
  'locales/ca.pak',
  'locales/cs.pak',
  'locales/da.pak',
  'locales/de.pak',
  'locales/el.pak',
  'locales/es-419.pak',
  'locales/es.pak',
  'locales/et.pak',
  'locales/fa.pak',
  'locales/fi.pak',
  'locales/fil.pak',
  'locales/fr.pak',
  'locales/gu.pak',
  'locales/he.pak',
  'locales/hi.pak',
  'locales/hr.pak',
  'locales/hu.pak',
  'locales/id.pak',
  'locales/it.pak',
  'locales/ja.pak',
  'locales/kn.pak',
  'locales/ko.pak',
  'locales/lt.pak',
  'locales/lv.pak',
  'locales/ml.pak',
  'locales/mr.pak',
  'locales/ms.pak',
  'locales/nb.pak',
  'locales/nl.pak',
  'locales/pl.pak',
  'locales/pt-BR.pak',
  'locales/pt-PT.pak',
  'locales/ro.pak',
  'locales/sk.pak',
  'locales/sl.pak',
  'locales/sr.pak',
  'locales/sv.pak',
  'locales/sw.pak',
  'locales/ta.pak',
  'locales/te.pak',
  'locales/th.pak',
  'locales/tr.pak',
  'locales/uk.pak',
  'locales/ur.pak',
  'locales/vi.pak',
  'locales/zh-CN.pak',
  'locales/zh-TW.pak',
  
  // Keep only essential files:
  // - en-US.pak (English)
  // - ru.pak (Russian - for Mongolian users)
  
  // Optional: Remove some development files
  'LICENSES.chromium.html', // Large license file
];

// Keep only essential locales
const keepLocales = ['en-US.pak', 'ru.pak'];

let removedCount = 0;
let savedSize = 0;

itemsToRemove.forEach(item => {
  const fullPath = path.join(winUnpackedDir, item);
  
  if (fs.existsSync(fullPath)) {
    try {
      const stats = fs.statSync(fullPath);
      savedSize += stats.size;
      
      fs.unlinkSync(fullPath);
      console.log(`🗑️ Removed: ${item} (${(stats.size / 1024).toFixed(1)} KB)`);
      removedCount++;
    } catch (error) {
      console.warn(`⚠️ Could not remove ${item}:`, error.message);
    }
  }
});

console.log(`✅ Cleaned ${removedCount} files`);
console.log(`💾 Saved space: ${(savedSize / 1024 / 1024).toFixed(2)} MB`);

// Re-zip the cleaned version
const packageJson = require('../package.json');
const version = packageJson.version;
const AdmZip = require('adm-zip');

try {
  const zip = new AdmZip();
  
  // Add all files from win-unpacked to zip
  const addDirectoryToZip = (dirPath, zipPath = '') => {
    const items = fs.readdirSync(dirPath);
    
    items.forEach(item => {
      const fullPath = path.join(dirPath, item);
      const zipEntryPath = zipPath ? `${zipPath}/${item}` : item;
      
      if (fs.statSync(fullPath).isDirectory()) {
        addDirectoryToZip(fullPath, zipEntryPath);
      } else {
        zip.addLocalFile(fullPath, zipPath, item);
      }
    });
  };
  
  addDirectoryToZip(winUnpackedDir);
  
  const cleanedZipPath = path.join(releaseDir, `NovaQ-Portable-Clean-${version}.zip`);
  zip.writeZip(cleanedZipPath);
  
  const originalZipPath = path.join(releaseDir, `NovaQ-Portable-${version}.zip`);
  const originalSize = fs.existsSync(originalZipPath) ? fs.statSync(originalZipPath).size : 0;
  const cleanedSize = fs.statSync(cleanedZipPath).size;
  
  console.log(`📦 Created cleaned portable ZIP: ${cleanedZipPath}`);
  console.log(`📊 Original size: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`📊 Cleaned size: ${(cleanedSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`💾 Size reduction: ${((originalSize - cleanedSize) / 1024 / 1024).toFixed(2)} MB`);
  
} catch (zipError) {
  console.warn('⚠️ Could not create cleaned ZIP (adm-zip not available):', zipError.message);
  console.log('ℹ️ Manual ZIP creation required or install adm-zip: npm install adm-zip --save-dev');
}

console.log('🎉 Portable build cleaning completed!');
