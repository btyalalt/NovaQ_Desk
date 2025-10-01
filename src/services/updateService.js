class UpdateService {
  constructor() {
    this.updateStatus = null;
    this.listeners = [];
    this.isPortableMode = false;
    this.setupListeners();
    this.detectPortableMode();
  }

  // Detect if running in portable mode
  detectPortableMode() {
    if (window.electron) {
      window.electron.invoke('get-portable-info').then(result => {
        this.isPortableMode = result.isPortable;
        console.log('🔧 UpdateService: Portable mode detected:', this.isPortableMode);
      }).catch(err => {
        console.warn('⚠️ UpdateService: Could not detect portable mode:', err);
      });
    }
  }

  static getInstance() {
    if (!UpdateService.instance) {
      UpdateService.instance = new UpdateService();
    }
    return UpdateService.instance;
  }

  setupListeners() {
    if (window.electron) {
      // Listen for update status from main process
      window.electron.receive('update-status', (data) => {
        this.updateStatus = data;
        this.notifyListeners(data);
        // Only log if there's an actual update or error
        if (data.status === 'available' || data.status === 'error' || data.status === 'downloading') {
          console.log('🔄 Update status:', data.status);
        }
      });
    }
  }

  addListener(callback) {
    this.listeners.push(callback);
  }

  removeListener(callback) {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  notifyListeners(data) {
    this.listeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error('Error in update listener:', error);
      }
    });
  }

  async checkForUpdates() {
    if (window.electron) {
      try {
        const result = await window.electron.invoke('check-for-updates');
        return result;
      } catch (error) {
        console.error('Error checking for updates:', error);
        return { success: false, error: error.message };
      }
    }
    return { success: false, error: 'Electron not available' };
  }

  async downloadUpdate() {
    if (window.electron) {
      try {
        const result = await window.electron.invoke('download-update');
        return result;
      } catch (error) {
        console.error('Error downloading update:', error);
        return { success: false, error: error.message };
      }
    }
    return { success: false, error: 'Electron not available' };
  }

  async installUpdate() {
    if (window.electron) {
      try {
        const result = await window.electron.invoke('install-update');
        return result;
      } catch (error) {
        console.error('Error installing update:', error);
        return { success: false, error: error.message };
      }
    }
    return { success: false, error: 'Electron not available' };
  }

  getUpdateStatus() {
    return this.updateStatus;
  }

  isUpdateAvailable() {
    return this.updateStatus && this.updateStatus.status === 'available';
  }

  isUpdateDownloaded() {
    return this.updateStatus && this.updateStatus.status === 'downloaded';
  }

  isUpdateDownloading() {
    return this.updateStatus && this.updateStatus.status === 'downloading';
  }

  getUpdateProgress() {
    return this.updateStatus && this.updateStatus.progress ? this.updateStatus.progress : 0;
  }

  getUpdateVersion() {
    return this.updateStatus && this.updateStatus.version ? this.updateStatus.version : null;
  }

  // Check version from SysConfigurations when app starts
  async checkVersionFromDatabase() {
    try {
      if (window.electron) {
        const result = await window.electron.invoke('check-version-from-db');
        return result;
      }
      return { success: false, error: 'Electron not available' };
    } catch (error) {
      console.error('Error checking version from database:', error);
      return { success: false, error: error.message };
    }
  }

  // Download update for portable exe (self-update)
  async downloadPortableUpdate() {
    if (window.electron) {
      try {
        console.log('🔧 UpdateService: Portable self-update requested...');
        
        // Prevent infinite loop - use direct download logic
        console.log('📦 UpdateService: Starting direct portable download...');
        
        // Get current app directory for portable mode
        const portableInfo = await window.electron.invoke('get-portable-info');
        if (!portableInfo.isPortable) {
          return { success: false, error: 'Not in portable mode' };
        }
        
        const targetDir = portableInfo.installDir || 'C:\\Novaq\\NovaQ Desktop';
        console.log('📁 UpdateService: Portable target directory:', targetDir);
        
        // Use advanced download with current directory
        const result = await this.downloadUpdateAdvanced(targetDir);
        
        if (result.success) {
          console.log('✅ UpdateService: Portable update completed successfully!');
          console.log('📂 UpdateService: Files updated in:', targetDir);
          console.log('🔄 UpdateService: Please restart the application to use the new version.');
        }
        
        return result;
      } catch (error) {
        console.error('❌ UpdateService: Error downloading portable update:', error);
        return { success: false, error: error.message };
      }
    }
    return { success: false, error: 'Electron not available' };
  }

  // Legacy download to Novaq folder (for compatibility)
  async downloadToNovaq() {
    if (window.electron) {
      try {
        const result = await window.electron.invoke('download-to-novaq');
        return result;
      } catch (error) {
        console.error('Error downloading to Novaq folder:', error);
        return { success: false, error: error.message };
      }
    }
    return { success: false, error: 'Electron not available' };
  }

  // Advanced download with retry mechanism and PowerShell fallback
  async downloadUpdateAdvanced(targetDir = 'C:\\Novaq\\NovaQ Desktop', specificVersion = null) {
    try {
      console.log('🔧 UpdateService: Advanced download to', targetDir, 'requested...');
      
      // Get version to download (specific version or latest from GitLab)
      const versionToDownload = specificVersion || await this.getVersionFromGitLab();
      if (!versionToDownload) {
        return { success: false, error: 'Could not determine version to download' };
      }
      
      console.log('📦 UpdateService: Version to download:', versionToDownload);
      
      // Download zip file from GitLab (32-bit universal build)
      const zipUrl = `https://desktop-f96376.gitlab.io/NovaQ-Portable-${versionToDownload}.zip`;
      console.log('🔧 Using universal 32-bit build (compatible with Windows 7 32/64-bit)');
      
      // Create target directory if it doesn't exist
      if (window.electron) {
        const createDirResult = await window.electron.invoke('create-directory', { path: targetDir });
        if (!createDirResult.success) {
          console.warn('⚠️ UpdateService: Could not create directory:', createDirResult.error);
        }
      }
      
      const zipPath = `${targetDir}\\NovaQ-Portable-${versionToDownload}.zip`;
      
      // Try download with retry mechanism
      console.log(`📥 UpdateService: Downloading from: ${zipUrl}`);
      console.log(`📁 UpdateService: Saving to: ${zipPath}`);
      
      try {
        // Method 1: Try fetch first with retry mechanism
        console.log('🔄 UpdateService: Trying fetch download...');
        
        let retryCount = 0;
        const maxRetries = 3;
        let downloadResult;
        
        while (retryCount < maxRetries) {
          try {
            downloadResult = await window.electron.invoke('download-file', {
              url: zipUrl,
              outputPath: zipPath,
              userAgent: 'NovaQ-Desktop-Updater/1.0',
              timeout: 30000
            });
            
            if (downloadResult.success) {
              break; // Success, exit retry loop
            } else {
              throw new Error(downloadResult.error);
            }
          } catch (fetchError) {
            retryCount++;
            if (retryCount < maxRetries) {
              console.warn(`⚠️ UpdateService: Download attempt ${retryCount} failed, retrying... (${fetchError.message})`);
              await new Promise(resolve => setTimeout(resolve, 2000 * retryCount)); // Exponential backoff
            } else {
              throw fetchError; // Re-throw if all retries failed
            }
          }
        }
        
        if (!downloadResult.success) {
          throw new Error(downloadResult.error);
        }
        
        console.log('✅ UpdateService: Downloaded zip file:', zipPath);
        
        // Continue with extraction
        return await this.extractZipFile(zipPath, targetDir, versionToDownload);
        
      } catch (fetchError) {
        console.warn('⚠️ UpdateService: Fetch download failed, trying PowerShell fallback...', fetchError.message);
        
        // Method 2: Fallback to PowerShell
        const powershellResult = await window.electron.invoke('download-file-powershell', {
          url: zipUrl,
          outputPath: zipPath,
          timeout: 5 * 60 * 1000 // 5 minutes
        });
        
        if (!powershellResult.success) {
          return { success: false, error: powershellResult.error, details: powershellResult.details };
        }
        
        console.log('✅ UpdateService: Downloaded zip file using PowerShell:', zipPath);
        
        // Continue with extraction
        return await this.extractZipFile(zipPath, targetDir, versionToDownload);
      }
      
    } catch (error) {
      console.error('❌ UpdateService: Error in advanced download:', error);
      return { success: false, error: error.message };
    }
  }

  // Extract ZIP file
  async extractZipFile(zipPath, targetDir, version) {
    try {
      console.log('📦 Extracting zip file...');
      
      const extractResult = await window.electron.invoke('extract-zip', {
        zipPath: zipPath,
        targetDir: targetDir
      });
      
      if (!extractResult.success) {
        return { success: false, error: extractResult.error };
      }
      
      console.log('✅ Successfully extracted to:', targetDir);
      
      // Delete zip file after extraction
      try {
        await window.electron.invoke('delete-file', { path: zipPath });
        console.log('🗑️ Deleted zip file after extraction');
      } catch (deleteError) {
        console.warn('⚠️ Could not delete zip file:', deleteError.message);
      }
      
      // Check extracted version
      const versionCheckResult = await this.checkExtractedVersion(targetDir, version);
      
      return { 
        success: true, 
        version: version,
        targetPath: targetDir,
        message: `Шинэчлэл амжилттай татагдлаа: v${version}`,
        extractedVersion: versionCheckResult.extractedVersion
      };
      
    } catch (error) {
      console.error('❌ Extract error:', error);
      return { success: false, error: error.message };
    }
  }

  // Check extracted version from multiple sources
  async checkExtractedVersion(targetDir, gitlabVersion) {
    try {
      console.log('🔍 Системийн хувилбар шалгаж байна...');
      
      const versionCheckResult = await window.electron.invoke('check-extracted-version', {
        targetDir: targetDir,
        gitlabVersion: gitlabVersion
      });
      
      if (versionCheckResult.success && versionCheckResult.extractedVersion) {
        const extractedVersion = versionCheckResult.extractedVersion;
        console.log('📦 Задлагдсан системийн хувилбар:', extractedVersion);
        console.log('🆚 Хувилбарын харьцуулалт:');
        console.log(`   📥 Татсан хувилбар: ${gitlabVersion}`);
        console.log(`   💾 Задлагдсан хувилбар: ${extractedVersion}`);
        console.log(`   ✅ Системд суулгагдсан хувилбар: ${extractedVersion}`);
        
        return { extractedVersion: extractedVersion };
      } else {
        console.log('⚠️ Системийн хувилбар олдсонгүй');
        return { extractedVersion: gitlabVersion }; // Fallback to GitLab version
      }
    } catch (error) {
      console.log('⚠️ Системийн хувилбар шалгахад алдаа:', error.message);
      return { extractedVersion: gitlabVersion }; // Fallback to GitLab version
    }
  }

  // Get version from GitLab
  async getVersionFromGitLab() {
    try {
      if (window.electron) {
        const result = await window.electron.invoke('get-gitlab-version');
        return result.success ? result.version : null;
      }
      return null;
    } catch (error) {
      console.error('Error getting GitLab version:', error);
      return null;
    }
  }

  // Test download functionality
  async testDownload() {
    try {
      console.log('🧪 Testing download functionality...');
      
      if (window.electron) {
        const result = await window.electron.invoke('test-download');
        return result;
      }
      return { success: false, error: 'Electron not available' };
    } catch (error) {
      console.error('❌ Test download error:', error);
      return { success: false, error: error.message, details: 'Network connectivity or DNS issue' };
    }
  }
}

export default UpdateService.getInstance();
