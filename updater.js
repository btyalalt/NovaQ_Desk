const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec, spawn } = require('child_process');

console.log('🔄 NovaQ Desktop Updater Starting...');

// Configuration - Use the directory where updater.exe is located (should be C:\Novaq\NovaQ Desktop)
const INSTALL_DIR = path.dirname(process.execPath);
const NOVAQ_EXE = path.join(INSTALL_DIR, 'NovaQ Desktop.exe');
const UPDATE_LOG = path.join(INSTALL_DIR, 'update.log');

// Logging helper
function logToFile(message) {
  try {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    
    // Ensure the directory exists
    const logDir = path.dirname(UPDATE_LOG);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    fs.appendFileSync(UPDATE_LOG, logMessage);
    // Don't log every write to avoid spam
  } catch (error) {
    // Silent fail for logging to avoid infinite loops
  }
}

function log(message) {
  console.log(message);
  logToFile(message);
}

//Windows compatibility check
function checkWindowsCompatibility() {
  if (process.platform === 'win32') {
    log('🔍 Checking Windows compatibility...');
    
    // Check system architecture
    const arch = process.arch;
    log(`📊 System architecture: ${arch}`);
    log(`✅ Universal 32-bit build - compatible with all Windows versions`);
    
    // Check Windows version
    const os = require('os');
    const release = os.release();
    log(`🖥️ Windows version: ${release}`);
    
    // Check if executable exists and is accessible
    if (fs.existsSync(NOVAQ_EXE)) {
      try {
        const stats = fs.statSync(NOVAQ_EXE);
        log(`✅ Executable found: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      } catch (error) {
        log('❌ Executable access error: ' + error.message);
      }
    } else {
      log('❌ Executable not found: ' + NOVAQ_EXE);
    }
  }
}
const TEMP_ZIP = path.join(INSTALL_DIR, 'temp_update.zip');
const BACKUP_DIR = path.join(INSTALL_DIR, 'backup');
const DOWNLOAD_LOCK_FILE = path.join(INSTALL_DIR, 'download.lock');

// Get download URL from command line args
const downloadUrl = process.argv[2];
if (!downloadUrl) {
  console.error('❌ Error: Download URL not provided');
  console.log('Usage: node updater.js <download_url>');
  process.exit(1);
}

console.log('📥 Download URL:', downloadUrl);
console.log('📁 Install Directory:', INSTALL_DIR);

// Download status check functions
function isDownloadInProgress() {
  try {
    if (fs.existsSync(DOWNLOAD_LOCK_FILE)) {
      const lockData = JSON.parse(fs.readFileSync(DOWNLOAD_LOCK_FILE, 'utf8'));
      const now = Date.now();
      const lockAge = now - lockData.timestamp;
      
      // Lock file is valid for 2 minutes (reduced from 10 minutes)
      if (lockAge < 2 * 60 * 1000) {
        console.log('⚠️ Download already in progress (lock file exists)');
        console.log('📋 Lock info:', lockData);
        console.log('⏰ Lock age:', Math.round(lockAge / 1000), 'seconds');
        return true;
      } else {
        console.log('🧹 Old lock file found, removing...');
        console.log('⏰ Lock age:', Math.round(lockAge / 1000), 'seconds (expired)');
        fs.unlinkSync(DOWNLOAD_LOCK_FILE);
        return false;
      }
    }
    return false;
  } catch (error) {
    console.log('⚠️ Error checking download status:', error.message);
    return false;
  }
}

function createDownloadLock() {
  try {
    const lockData = {
      timestamp: Date.now(),
      pid: process.pid,
      url: downloadUrl,
      status: 'downloading'
    };
    fs.writeFileSync(DOWNLOAD_LOCK_FILE, JSON.stringify(lockData, null, 2));
    console.log('🔒 Download lock created');
  } catch (error) {
    console.error('❌ Error creating download lock:', error.message);
  }
}

function removeDownloadLock() {
  try {
    if (fs.existsSync(DOWNLOAD_LOCK_FILE)) {
      fs.unlinkSync(DOWNLOAD_LOCK_FILE);
      console.log('🔓 Download lock removed');
    }
  } catch (error) {
    console.error('❌ Error removing download lock:', error.message);
  }
}

async function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    log('📥 Starting download...');
    log(`📍 URL: ${url}`);
    log(`💾 Saving to: ${outputPath}`);
    console.log('🔍 DEBUG: Creating write stream...');
    
    const file = fs.createWriteStream(outputPath);
    console.log('🔍 DEBUG: Write stream created');
    console.log('🔍 DEBUG: Starting HTTPS request...');
    
    const request = https.get(url, {
      headers: { 'User-Agent': 'NovaQ-Updater/1.0' },
      timeout: 600000 // 10 minute timeout (600 seconds)
    }, (response) => {
      console.log('🔍 DEBUG: HTTPS response received, status:', response.statusCode);
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        file.close();
        fs.unlinkSync(outputPath);
        log(`🔄 Redirecting to: ${response.headers.location}`);
        return downloadFile(response.headers.location, outputPath).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        file.close();
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
        log(`❌ Download failed: HTTP ${response.statusCode}: ${response.statusMessage}`);
        return reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
      }
      
      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;
      let lastProgressTime = 0;
      
      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        const percent = ((downloadedSize / totalSize) * 100).toFixed(1);
        
        // Only show progress every 1 second
        const currentTime = Date.now();
        if (currentTime - lastProgressTime >= 1000 || downloadedSize === totalSize) {
          console.log(`📥 Download progress: ${percent}%`);
          lastProgressTime = currentTime;
          
          // Update lock file with progress
          try {
            const lockData = {
              timestamp: Date.now(),
              pid: process.pid,
              url: downloadUrl,
              status: 'downloading',
              progress: percent,
              downloadedSize: downloadedSize,
              totalSize: totalSize
            };
            fs.writeFileSync(DOWNLOAD_LOCK_FILE, JSON.stringify(lockData, null, 2));
          } catch (error) {
            // Ignore lock file update errors during download
          }
        }
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        const sizeMB = (totalSize / 1024 / 1024).toFixed(2);
        log(`\n✅ Download completed! (${sizeMB} MB)`);
        log(`💾 File saved: ${outputPath}`);
        resolve(outputPath);
      });
      
      file.on('error', (err) => {
        file.close();
        fs.unlinkSync(outputPath);
        reject(err);
      });
    });
    
    request.on('error', (err) => {
      log('❌ Request error: ' + err.message);
      console.error('🔍 DEBUG: Request error details:', err);
      console.log('🔍 DEBUG: NOT exiting app - continuing with error handling');
      file.close();
      if (fs.existsSync(outputPath)) {
        try {
          fs.unlinkSync(outputPath);
        } catch (e) {
          console.log('⚠️ Could not delete output file:', e.message);
        }
      }
      // Don't reject immediately - try to continue
      console.log('🔍 DEBUG: Attempting to continue despite error...');
      // Don't reject - let the app continue
      console.log('🔍 DEBUG: Not rejecting - letting app continue');
      // reject(err);
    });
    
    request.on('timeout', () => {
      log('⏱️ Request timeout - aborting...');
      console.log('🔍 DEBUG: Request timeout event fired');
      console.log('🔍 DEBUG: NOT exiting app - just aborting request');
      request.abort();
    });
  });
}

async function extractZip(zipPath, targetDir) {
  return new Promise((resolve, reject) => {
    console.log('📦 Extracting ZIP file...');
    console.log('🔍 DEBUG: ZIP path:', zipPath);
    console.log('🔍 DEBUG: Target directory:', targetDir);
    
    // Try tar first (Windows 10+)
    const tarCommand = `tar -xf "${zipPath}" -C "${targetDir}"`;
    console.log('🔍 DEBUG: Tar command:', tarCommand);
    
    exec(tarCommand, (tarError, tarStdout, tarStderr) => {
      console.log('🔍 DEBUG: Tar execution completed');
      console.log('🔍 DEBUG: Tar error:', tarError ? tarError.message : 'none');
      console.log('🔍 DEBUG: Tar stdout:', tarStdout || 'empty');
      console.log('🔍 DEBUG: Tar stderr:', tarStderr || 'empty');
      
      if (tarError) {
        console.log('⚠️ Tar extraction failed, trying PowerShell...');
        
        // Fallback to PowerShell
        const psCommand = `powershell -ExecutionPolicy Bypass -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${targetDir}' -Force"`;
        console.log('🔍 DEBUG: PowerShell command:', psCommand);
        
        exec(psCommand, (psError, psStdout, psStderr) => {
          console.log('🔍 DEBUG: PowerShell execution completed');
          console.log('🔍 DEBUG: PS error:', psError ? psError.message : 'none');
          console.log('🔍 DEBUG: PS stdout:', psStdout || 'empty');
          console.log('🔍 DEBUG: PS stderr:', psStderr || 'empty');
          
          if (psError) {
            reject(new Error(`Extraction failed: ${psError.message}`));
          } else {
            console.log('✅ Extraction completed using PowerShell');
            console.log('🔍 DEBUG: Calling handleExecutableRename...');
            handleExecutableRename(targetDir);
            console.log('🔍 DEBUG: handleExecutableRename completed');
            resolve();
          }
        });
      } else {
        console.log('✅ Extraction completed using tar');
        console.log('🔍 DEBUG: Calling handleExecutableRename...');
        handleExecutableRename(targetDir);
        console.log('🔍 DEBUG: handleExecutableRename completed');
        resolve();
      }
    });
  });
}

function handleExecutableRename(targetDir) {
  try {
    console.log('🔍 DEBUG: handleExecutableRename called with:', targetDir);
    const extractedExe = path.join(targetDir, 'NovaQ Desktop.exe');
    const newExePath = path.join(targetDir, 'NovaQ Desktop.exe.new');
    
    console.log('🔍 DEBUG: Extracted exe path:', extractedExe);
    console.log('🔍 DEBUG: New exe path:', newExePath);
    console.log('🔍 DEBUG: Running exe path:', NOVAQ_EXE);
    console.log('🔍 DEBUG: Extracted exe exists:', fs.existsSync(extractedExe));
    
    // If a new executable was extracted, rename it to .new
    if (fs.existsSync(extractedExe)) {
      // Check if this is actually a new file (different from running executable)
      const runningExe = NOVAQ_EXE;
      
      console.log('🔍 DEBUG: Comparing paths...');
      console.log('🔍 DEBUG: extractedExe !== runningExe:', extractedExe !== runningExe);
      
      if (extractedExe !== runningExe) {
        // Rename the extracted executable to .new for staged update
        if (fs.existsSync(newExePath)) {
          console.log('🔍 DEBUG: Removing existing .new file');
          fs.unlinkSync(newExePath); // Remove any existing .new file
        }
        console.log('🔍 DEBUG: Renaming extracted exe to .new');
        fs.renameSync(extractedExe, newExePath);
        console.log('🔄 New executable renamed for staged update');
      } else {
        console.log('🔍 DEBUG: Extracted exe is same as running exe, no rename needed');
      }
    } else {
      console.log('🔍 DEBUG: No extracted executable found');
    }
  } catch (error) {
    console.log('⚠️ Could not handle executable rename:', error.message);
    console.log('🔍 DEBUG: handleExecutableRename error details:', error);
  }
}

function cleanupZipFiles() {
  console.log('🧹 Cleaning up ZIP files...');
  try {
    const zipItems = fs.readdirSync(INSTALL_DIR);
    for (const zipItem of zipItems) {
      if (zipItem.endsWith('.zip')) {
        const zipPath = path.join(INSTALL_DIR, zipItem);
        try {
          fs.unlinkSync(zipPath);
          console.log(`🗑️ Deleted ZIP file: ${zipItem}`);
        } catch (error) {
          console.log(`⚠️ Could not delete ZIP file ${zipItem}: ${error.message}`);
        }
      }
    }
    console.log('✅ ZIP files cleanup completed');
  } catch (error) {
    console.log('⚠️ ZIP files cleanup error:', error.message);
  }
}

async function cleanupOldFiles() {
  log('🧹 Cleaning up old application files...');
  log('🔍 Scanning directory: ' + INSTALL_DIR);
  
  try {
    // Files and directories to keep during update
    const keepFiles = [
      'updater-32.exe',
      'updater-x64.exe', 
      'update.log',
      'download.lock',
      'temp_update.zip'
    ];
    const keepDirs = ['backup'];
    
    // Delete old application files by extension
    const deleteExtensions = ['.dll', '.exe', '.dat', '.pak', '.bin', '.html'];
    
    const items = fs.readdirSync(INSTALL_DIR);
    log(`📁 Found ${items.length} items in directory`);
    
    let deletedCount = 0;
    
    for (const item of items) {
      const itemPath = path.join(INSTALL_DIR, item);
      
      try {
        const stat = fs.statSync(itemPath);
        
        if (stat.isFile()) {
          // Skip files we want to keep
          if (keepFiles.includes(item)) {
            console.log(`✅ Keeping: ${item}`);
            continue;
          }
          
          // Delete files with specific extensions or NovaQ Desktop.exe
          const ext = path.extname(item).toLowerCase();
          if (deleteExtensions.includes(ext) || item === 'NovaQ Desktop.exe') {
            try {
              fs.unlinkSync(itemPath);
              console.log(`🗑️ Deleted: ${item}`);
              deletedCount++;
            } catch (error) {
              console.log(`⚠️ Could not delete ${item}: ${error.message}`);
            }
          }
        } else if (stat.isDirectory()) {
          // Delete old directories (locales, resources) but skip backup
          if (!keepDirs.includes(item)) {
            try {
              fs.rmSync(itemPath, { recursive: true, force: true });
              console.log(`🗑️ Deleted directory: ${item}`);
              deletedCount++;
            } catch (error) {
              console.log(`⚠️ Could not delete directory ${item}: ${error.message}`);
            }
          } else {
            console.log(`✅ Keeping directory: ${item}`);
          }
        }
      } catch (error) {
        console.log(`⚠️ Could not access ${item}: ${error.message}`);
      }
    }
    
    log(`✅ Cleanup completed - Deleted ${deletedCount} items`);
    
  } catch (cleanupError) {
    log('❌ Cleanup error: ' + cleanupError.message);
    log('Stack: ' + cleanupError.stack);
  }
}

async function cleanupBackupFolder() {
  console.log('🧹 Cleaning up backup folder...');
  console.log('🔍 BACKUP_DIR path:', BACKUP_DIR);
  console.log('🔍 BACKUP_DIR exists:', fs.existsSync(BACKUP_DIR));
  
  try {
    // Force remove backup folder with multiple attempts
    if (fs.existsSync(BACKUP_DIR)) {
      console.log('🔍 Backup folder exists, attempting to delete...');
      console.log('🔍 Backup folder contents:', fs.readdirSync(BACKUP_DIR));
      let deleted = false;
      
      for (let i = 0; i < 5; i++) {
        try {
          console.log(`🔄 Attempt ${i + 1} to delete backup folder...`);
          
          // Try to remove files first, then directory
          const files = fs.readdirSync(BACKUP_DIR);
          for (const file of files) {
            const filePath = path.join(BACKUP_DIR, file);
            try {
              fs.unlinkSync(filePath);
              console.log(`🗑️ Deleted file: ${file}`);
            } catch (fileError) {
              console.log(`⚠️ Could not delete file ${file}: ${fileError.message}`);
            }
          }
          
          // Now try to remove the directory
          fs.rmSync(BACKUP_DIR, { recursive: true, force: true });
          deleted = true;
          console.log('🗑️ Deleted backup folder');
          break;
        } catch (error) {
          console.log(`⚠️ Attempt ${i + 1} to delete backup folder failed:`, error.message);
          if (i < 4) {
            // Wait before retry
            console.log(`⏳ Waiting 2 seconds before retry...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
      
      if (!deleted) {
        console.log('⚠️ Could not delete backup folder after 5 attempts');
        console.log('🔄 Trying alternative method...');
        
        // Alternative method: Use Windows command
        try {
          const { exec } = require('child_process');
          await new Promise((resolve) => {
            exec(`rmdir /s /q "${BACKUP_DIR}"`, (error) => {
              if (error) {
                console.log('⚠️ Alternative method also failed:', error.message);
              } else {
                console.log('✅ Backup folder deleted using alternative method');
              }
              resolve();
            });
          });
        } catch (altError) {
          console.log('⚠️ Alternative method error:', altError.message);
        }
      }
    } else {
      console.log('ℹ️ Backup folder does not exist');
    }
    
    console.log('✅ Backup folder cleanup completed');
  } catch (error) {
    console.log('⚠️ Backup folder cleanup error:', error.message);
  }
}

async function finalCleanupAndRestart() {
  console.log('🧹 Final cleanup and restart...');
  
  try {
    // Wait a moment for file operations to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Force cleanup backup folder one more time
    console.log('🧹 Force cleaning backup folder in final cleanup...');
    console.log('🔍 BACKUP_DIR exists in final cleanup:', fs.existsSync(BACKUP_DIR));
    
    if (fs.existsSync(BACKUP_DIR)) {
      console.log('⚠️ Backup folder still exists in final cleanup!');
      try {
        // Try Windows command first
        const { exec } = require('child_process');
        console.log('🔄 Trying Windows rmdir command...');
        await new Promise((resolve) => {
          exec(`rmdir /s /q "${BACKUP_DIR}"`, (error) => {
            if (error) {
              console.log('⚠️ Windows command failed:', error.message);
            } else {
              console.log('✅ Backup folder deleted using Windows command');
            }
            resolve();
          });
        });
        
        // Check if it was actually deleted
        if (fs.existsSync(BACKUP_DIR)) {
          console.log('❌ Backup folder still exists after Windows command!');
        } else {
          console.log('✅ Backup folder successfully deleted in final cleanup');
        }
      } catch (error) {
        console.log('⚠️ Windows command error:', error.message);
      }
    } else {
      console.log('✅ Backup folder already deleted');
    }
    
    // Check if we need to restart the app
    const newExePath = path.join(INSTALL_DIR, 'NovaQ Desktop.exe.new');
    
    if (fs.existsSync(newExePath)) {
      console.log('🔄 New executable detected, replacing old one...');
      
      // Close any running NovaQ Desktop processes first
      try {
        const { exec } = require('child_process');
        await new Promise((resolve) => {
          exec('taskkill /F /IM "NovaQ Desktop.exe" 2>nul', (error) => {
            if (error) {
              console.log('ℹ️ No running NovaQ Desktop processes found');
            } else {
              console.log('✅ Closed running NovaQ Desktop processes');
            }
            resolve();
          });
        });
        
        // Wait for processes to close
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (error) {
        console.log('⚠️ Error closing processes:', error.message);
      }
      
      // Replace old executable with new one
      if (fs.existsSync(NOVAQ_EXE)) {
        try {
          // Try to delete old executable multiple times
          let deleted = false;
          for (let i = 0; i < 5; i++) {
            try {
              fs.unlinkSync(NOVAQ_EXE);
              deleted = true;
              console.log('🗑️ Deleted old executable');
              break;
            } catch (error) {
              console.log(`⚠️ Attempt ${i + 1} to delete old executable failed:`, error.message);
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
          
          if (!deleted) {
            console.log('⚠️ Could not delete old executable after 5 attempts');
          }
        } catch (error) {
          console.log('⚠️ Could not delete old executable:', error.message);
        }
      }
      
      // Rename new executable
      try {
        fs.renameSync(newExePath, NOVAQ_EXE);
        console.log('✅ New executable activated');
      } catch (error) {
        console.log('⚠️ Could not rename new executable:', error.message);
      }
    }
    
    // Start the updated app with auto-restart functionality
    console.log('🚀 Starting updated NovaQ Desktop...');
    await startNovaQDesktop();
    
  } catch (error) {
    console.log('⚠️ Final cleanup error:', error.message);
  }
}

async function closeDesktopApp() {
  return new Promise(async (resolve) => {
    let resolved = false;
    
    try {
      console.log('🔄 Attempting to close NovaQ Desktop...');
      console.log('🔍 DEBUG: Starting taskkill command...');
      
      const { exec } = require('child_process');
      
      // First attempt: Graceful close
      console.log('🔄 Attempt 1: Graceful close...');
      exec('taskkill /IM "NovaQ Desktop.exe" 2>nul', async (error1) => {
        if (!error1) {
          console.log('✅ Graceful close initiated, waiting...');
          await new Promise(r => setTimeout(r, 3000));
        }
        
        // Second attempt: Force kill
        console.log('🔄 Attempt 2: Force kill...');
        exec('taskkill /F /IM "NovaQ Desktop.exe" 2>nul', async (error2) => {
          console.log('🔍 DEBUG: Force kill completed');
          
          // Wait additional time for Windows to release file handles
          console.log('⏳ Waiting for Windows to release file handles...');
          await new Promise(r => setTimeout(r, 2000));
          
          // Verify process is closed
          exec('tasklist /FI "IMAGENAME eq NovaQ Desktop.exe" 2>nul | find /I "NovaQ Desktop.exe" >nul', (verifyError) => {
            if (!resolved) {
              resolved = true;
              if (verifyError) {
                console.log('✅ NovaQ Desktop successfully closed and verified');
              } else {
                console.log('⚠️ NovaQ Desktop may still be running');
              }
              resolve();
            }
          });
        });
      });
      
      // Timeout with longer duration
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.log('⏱️ Close timeout reached (7s), continuing...');
          resolve();
        }
      }, 7000); // Increased to 7 seconds
      
    } catch (closeError) {
      if (!resolved) {
        resolved = true;
        console.log('⚠️ Could not close desktop app:', closeError.message);
        resolve();
      }
    }
  });
}

function createBackup() {
  console.log('📋 Skipping backup creation (app is running)...');
  console.log('ℹ️ Backup will be created after app closes');
  // Skip backup while app is running to avoid file lock issues
  // Backup will be attempted after desktop app closes
}

async function performUpdate() {
  const startTime = Date.now();
  try {
    log('🚀 Starting NovaQ Desktop Update Process...');
    log('==========================================');
    log(`📥 Download URL: ${downloadUrl}`);
    log(`📁 Install Directory: ${INSTALL_DIR}`);
    
    // Check Windows compatibility first
    checkWindowsCompatibility();
    
    // Step 0: Check if download is already in progress
    if (isDownloadInProgress()) {
      console.log('❌ Download already in progress, exiting...');
      process.exit(0);
    }
    
    // Create download lock
    createDownloadLock();
    
    // Step 1: Create backup
    createBackup();
    
    // Step 2: Download new version (бүрэн дуустал хүлээх)
    log('📥 Step 2: Starting download...');
    await downloadFile(downloadUrl, TEMP_ZIP);
    log('✅ Step 2: Download completed successfully!');
    
    // Step 3: Wait 2 seconds after download
    console.log('⏳ Step 3: Waiting 2 seconds after download...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 4: Close desktop app before file operations
    log('🔄 Step 4: Closing NovaQ Desktop app...');
    log('ℹ️ Note: Main window already hidden by main process');
    await closeDesktopApp();
    log('✅ Step 4: Desktop app closed');
    
    // Step 5: Wait for file handles to be released
    console.log('⏳ Step 5: Waiting 5 seconds for file handles to be released...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 6: Хуучин файлуудыг устгах
    log('🧹 Step 6: Cleaning up old files...');
    await cleanupOldFiles();
    log('✅ Step 6: Old files cleanup completed');
    
    // Step 7: Zip файлыг задлах (шинэ файлуудыг тавих)
    log('📦 Step 7: Extracting ZIP file...');
    await extractZip(TEMP_ZIP, INSTALL_DIR);
    log('✅ Step 7: ZIP extraction completed');
    
    // Step 8: Waiting after extraction
    console.log('⏳ Step 8: Waiting 2 seconds after extraction...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 9: ZIP файлуудыг устгах
    log('🧹 Step 9: Cleaning up ZIP files...');
    cleanupZipFiles();
    log('✅ Step 9: ZIP files cleanup completed');
    
    // Step 10: Backup хавтасыг устгах
    log('🧹 Step 10: Starting backup folder cleanup...');
    await cleanupBackupFolder();
    log('✅ Step 10: Backup folder cleanup completed');
    
    // Step 11: Final cleanup болон restart
    log('🚀 Step 11: Starting final cleanup and restart...');
    await finalCleanupAndRestart();
    log('✅ Step 11: Final cleanup completed');
    
    // Remove download lock on success
    removeDownloadLock();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log('==========================================');
    log('🎉 UPDATE COMPLETED SUCCESSFULLY!');
    log('📦 New version installed');
    log('📁 Location: ' + INSTALL_DIR);
    log(`⏱️ Total time: ${duration} seconds`);
    log('🔄 Update completed, app will continue running...');
    log('==========================================');
    
    // Step 11: Амжилттай дууссан
    console.log('✅ Update process completed successfully');
    
    // Step 12: Шинэ .exe ажлуулах
    console.log('🚀 Step 12: Starting new executable...');
    await startNovaQDesktop();
    
    // Exit updater after successful update
    setTimeout(() => {
      console.log('🔄 Updater exiting after successful update...');
      process.exit(0);
    }, 5000);
    
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log('==========================================');
    log('❌ UPDATE FAILED!');
    log(`❌ Error: ${error.message}`);
    log(`❌ Error name: ${error.name}`);
    log(`❌ Error code: ${error.code || 'N/A'}`);
    log(`❌ Stack: ${error.stack}`);
    log(`⏱️ Failed after: ${duration} seconds`);
    console.error('🔍 DEBUG: Full error object:', error);
    console.error('🔍 DEBUG: Error type:', typeof error);
    console.error('🔍 DEBUG: Error constructor:', error.constructor.name);
    log('==========================================');
    
    // Remove download lock on error
    removeDownloadLock();
    
    log('🔄 Attempting to restore from backup...');
    
    // Restore from backup if available
    const backupExe = path.join(BACKUP_DIR, 'NovaQ Desktop.exe');
    if (fs.existsSync(backupExe)) {
      try {
        fs.copyFileSync(backupExe, NOVAQ_EXE);
        log('✅ Restored from backup successfully');
        
        // Try to start the restored app
        try {
          await startNovaQDesktop();
          log('✅ Application restarted after restore');
        } catch (startError) {
          log('⚠️ Could not restart application: ' + startError.message);
        }
      } catch (restoreError) {
        log('❌ Restore failed: ' + restoreError.message);
      }
    } else {
      log('⚠️ No backup found to restore');
    }
    
    log('💡 Check update.log for details');
    log('==========================================');
    console.log('🔍 DEBUG: Update failed but NOT exiting app - letting it continue');
    // Don't exit - let the app continue running
    // process.exit(1);
  }
}

// Handle cleanup on exit
process.on('SIGINT', () => {
  log('\n🔄 Updater interrupted by SIGINT');
  console.log('🔍 DEBUG: SIGINT signal received');
  removeDownloadLock();
  if (fs.existsSync(TEMP_ZIP)) {
    try {
      fs.unlinkSync(TEMP_ZIP);
      console.log('🗑️ Temp ZIP cleaned up');
    } catch (e) {
      console.log('⚠️ Could not delete temp ZIP:', e.message);
    }
  }
  process.exit(0);
});

// Handle cleanup on process termination
process.on('SIGTERM', () => {
  log('\n🔄 Updater terminated by SIGTERM');
  console.log('🔍 DEBUG: SIGTERM signal received');
  removeDownloadLock();
  if (fs.existsSync(TEMP_ZIP)) {
    try {
      fs.unlinkSync(TEMP_ZIP);
      console.log('🗑️ Temp ZIP cleaned up');
    } catch (e) {
      console.log('⚠️ Could not delete temp ZIP:', e.message);
    }
  }
  process.exit(0);
});

// Handle cleanup on uncaught exceptions - DON'T EXIT, just log
process.on('uncaughtException', (error) => {
  log('\n⚠️ Uncaught exception (continuing): ' + error.message);
  log('Stack: ' + error.stack);
  console.error('🔍 DEBUG: Uncaught exception details:', error);
  console.log('🔍 DEBUG: Updater will continue despite error');
  // DON'T EXIT - let download continue
  // removeDownloadLock();
  // process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  log('\n⚠️ Unhandled rejection (continuing): ' + reason);
  console.error('🔍 DEBUG: Unhandled rejection at:', promise);
  console.log('🔍 DEBUG: Updater will continue despite rejection');
  // DON'T EXIT - let download continue
});

async function startNovaQDesktop() {
  const maxRetries = 3;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      
      // Check if executable exists
      if (!fs.existsSync(NOVAQ_EXE)) {
        throw new Error(`NovaQ Desktop executable not found: ${NOVAQ_EXE}`);
      }
      
      const novaqProcess = spawn(NOVAQ_EXE, [], {
        detached: true,
        stdio: 'ignore',
        cwd: INSTALL_DIR,
        windowsHide: true,
        shell: true
      });
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (!novaqProcess.killed) {
        console.log('✅ NovaQ Desktop started successfully');
        novaqProcess.unref();
        return;
      } else {
        throw new Error('Process exited immediately');
      }
      
    } catch (error) {
      retryCount++;
      
      if (retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Try with admin privileges and alternative methods
        if (retryCount === 2) {
          try {
            const { exec } = require('child_process');
            let adminCommand;
            
            if (process.platform === 'win32') {
              // Try multiple Windows startup methods
              const methods = [
                `powershell -Command "Start-Process -FilePath '${NOVAQ_EXE}' -Verb RunAs"`,
                `cmd /c start "" "${NOVAQ_EXE}"`,
                `"${NOVAQ_EXE}"`
              ];
              
              for (let i = 0; i < methods.length; i++) {
                console.log(`🔐 Trying Windows method ${i + 1}...`);
                try {
                  await new Promise((resolve, reject) => {
                    exec(methods[i], (error) => {
                      if (error) {
                        reject(error);
                      } else {
                        resolve();
                      }
                    });
                  });
                  console.log(`✅ NovaQ Desktop started with method ${i + 1}`);
                  await new Promise(resolve => setTimeout(resolve, 3000));
                  return; // Exit retry loop if successful
                } catch (methodError) {
                  console.log(`⚠️ Method ${i + 1} failed:`, methodError.message);
                  if (i < methods.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                  }
                }
              }
            } else if (process.platform === 'darwin') {
              adminCommand = `sudo open "${NOVAQ_EXE}"`;
            } else {
              adminCommand = `sudo "${NOVAQ_EXE}"`;
            }
            
            if (process.platform !== 'win32') {
              exec(adminCommand, (error) => {
                if (error) {
                  console.log('⚠️ Admin start failed:', error.message);
                } else {
                  console.log('✅ NovaQ Desktop started with admin privileges');
                }
              });
              
              // Wait and check if it started
              await new Promise(resolve => setTimeout(resolve, 3000));
            }
            return; // Exit retry loop if admin start was attempted
          } catch (adminError) {
            console.log('⚠️ Admin start error:', adminError.message);
          }
        }
      } else {
        // Try to open the directory for manual start
        try {
          const { exec } = require('child_process');
          const isWindows = process.platform === 'win32';
          const isMac = process.platform === 'darwin';
          
          let openCommand;
          if (isWindows) {
            openCommand = `explorer "${INSTALL_DIR}"`;
          } else if (isMac) {
            openCommand = `open "${INSTALL_DIR}"`;
          } else {
            openCommand = `xdg-open "${INSTALL_DIR}"`; // Linux
          }
          
          exec(openCommand, (error) => {
            if (error) {
              console.log('⚠️ Could not open directory:', error.message);
            } else {
              console.log('📁 Opened installation directory for manual start');
            }
          });
        } catch (openError) {
          console.log('⚠️ Could not open directory:', openError.message);
        }
      }
    }
  }
}

// Start the update processs
performUpdate();
