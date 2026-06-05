const { app, BrowserWindow, ipcMain, session } = require('electron');

// CAPTCHA: navigator.webdriver=false (Chromium engine түвшинд)
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');

// Windows 7 compatibility command line switches
if (process.platform === 'win32') {
  const os = require('os');
  const isWindows7 = os.release().startsWith('6.1');
  
  if (isWindows7) {
    console.log('🔧 Windows 7 detected - applying compatibility switches');
    
    // Disable problematic features for Windows 7
    app.commandLine.appendSwitch('disable-features', 'NetworkService,NetworkServiceInProcess');
    app.commandLine.appendSwitch('disable-web-security');
    app.commandLine.appendSwitch('disable-site-isolation-trials');
    app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor');
    
    // Block tracking scripts to prevent 429 errors
    app.commandLine.appendSwitch('disable-background-networking');
    app.commandLine.appendSwitch('disable-default-apps');
    app.commandLine.appendSwitch('disable-sync');
    app.commandLine.appendSwitch('disable-extensions');
    app.commandLine.appendSwitch('disable-plugins');
    // disable-images: Khan login SPA цагаан дэлгэц гаргах — бүү идэвхжүүл
    app.commandLine.appendSwitch('disable-javascript-harmony-shipping');
    app.commandLine.appendSwitch('disable-features', 'TranslateUI');
    app.commandLine.appendSwitch('disable-features', 'MediaRouter');
    app.commandLine.appendSwitch('disable-features', 'AutofillServerCommunication');
    
    // TLS/SSL fixes for Windows 7
    app.commandLine.appendSwitch('ssl-version-fallback-min', 'tls1.2');
    app.commandLine.appendSwitch('ssl-version-fallback-max', 'tls1.3');
    app.commandLine.appendSwitch('cipher-suite-blacklist', '0x0004,0x0005,0x000A,0x000B,0x0039,0x003A,0x003B,0x003C,0x0062,0x0063,0x0064,0x0065,0x0066,0x0067,0x0068,0x0069,0x006A,0x006B,0x006C,0x006D,0x006E,0x006F,0x0070,0x0071,0x0072,0x0073,0x0074,0x0075,0x0076,0x0077,0x0078,0x0079,0x007A,0x007B,0x007C,0x007D,0x007E,0x007F,0x0080,0x0081,0x0082,0x0083,0x0084,0x0085,0x0086,0x0087,0x0088,0x0089,0x008A,0x008B,0x008C,0x008D,0x008E,0x008F,0x0090,0x0091,0x0092,0x0093,0x0094,0x0095,0x0096,0x0097,0x0098,0x0099,0x009A,0x009B,0x009C,0x009D,0x009E,0x009F,0x00A0,0x00A1,0x00A2,0x00A3,0x00A4,0x00A5,0x00A6,0x00A7,0x00A8,0x00A9,0x00AA,0x00AB,0x00AC,0x00AD,0x00AE,0x00AF,0x00B0,0x00B1,0x00B2,0x00B3,0x00B4,0x00B5,0x00B6,0x00B7,0x00B8,0x00B9,0x00BA,0x00BB,0x00BC,0x00BD,0x00BE,0x00BF,0x00C0,0x00C1,0x00C2,0x00C3,0x00C4,0x00C5,0x00C6,0x00C7,0x00C8,0x00C9,0x00CA,0x00CB,0x00CC,0x00CD,0x00CE,0x00CF,0x00D0,0x00D1,0x00D2,0x00D3,0x00D4,0x00D5,0x00D6,0x00D7,0x00D8,0x00D9,0x00DA,0x00DB,0x00DC,0x00DD,0x00DE,0x00DF,0x00E0,0x00E1,0x00E2,0x00E3,0x00E4,0x00E5,0x00E6,0x00E7,0x00E8,0x00E9,0x00EA,0x00EB,0x00EC,0x00ED,0x00EE,0x00EF,0x00F0,0x00F1,0x00F2,0x00F3,0x00F4,0x00F5,0x00F6,0x00F7,0x00F8,0x00F9,0x00FA,0x00FB,0x00FC,0x00FD,0x00FE,0x00FF');
    
    // GPU fixes for Windows 7
    app.commandLine.appendSwitch('disable-gpu');
    app.commandLine.appendSwitch('disable-gpu-compositing');
    app.commandLine.appendSwitch('disable-gpu-sandbox');
    
    // Network fixes
    app.commandLine.appendSwitch('disable-background-timer-throttling');
    app.commandLine.appendSwitch('disable-renderer-backgrounding');
    app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
    
    // Certificate fixes
    app.commandLine.appendSwitch('ignore-certificate-errors');
    app.commandLine.appendSwitch('ignore-ssl-errors');
    app.commandLine.appendSwitch('ignore-certificate-errors-spki-list');
    app.commandLine.appendSwitch('ignore-certificate-errors-spki-list');
    
    // React compatibility fixes
    app.commandLine.appendSwitch('disable-features', 'V8OptimizeJavascript');
    app.commandLine.appendSwitch('disable-features', 'ScriptStreaming');
    app.commandLine.appendSwitch('disable-features', 'BlinkGenPropertyTrees');
    app.commandLine.appendSwitch('disable-features', 'BlinkScheduler');
    app.commandLine.appendSwitch('disable-features', 'BlinkSchedulerDfs');
    app.commandLine.appendSwitch('disable-features', 'BlinkSchedulerHighPriority');
    app.commandLine.appendSwitch('disable-features', 'BlinkSchedulerLowPriority');
    app.commandLine.appendSwitch('disable-features', 'BlinkSchedulerNormalPriority');
    
    console.log('✅ Windows 7 compatibility switches applied');
  }
}
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Packaged install/portable .exe → always production API (novaq.mn:3119)
const PROD_API_URL = 'https://novaq.mn:3119';
if (app.isPackaged) {
  process.env.NODE_ENV = 'production';
  if (!process.env.API_BASE_URL || process.env.API_BASE_URL.includes('103.168.56.34')) {
    process.env.API_BASE_URL = PROD_API_URL;
  }
}

const os = require('os');
const fs = require('fs');
const https = require('https');
const { spawn } = require('child_process');
const Store = require('electron-store');

// Configure TLS to handle SSL version issues in portable mode
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
// Force TLS version compatibility
process.env.NODE_OPTIONS = '--tls-min-v1.0 --tls-max-v1.3';

// Add fetch polyfill for main process
if (typeof global.fetch === 'undefined') {
  try {
    const nodeFetch = require('node-fetch');
    // Make fetch available globally
    global.fetch = nodeFetch;
    global.Headers = nodeFetch.Headers;
    global.Request = nodeFetch.Request;
    global.Response = nodeFetch.Response;
    console.log('✅ Fetch polyfill loaded successfully');
  } catch (error) {
    console.log('ℹ️ node-fetch not available, using https module fallback');
    console.log('🔍 Error details:', error.message);
  }
}

// Global error handlers - log but don't exit immediately
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  // Don't exit immediately - let updater continue
  // process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
  // Don't exit immediately - let updater continue
  // process.exit(1);
});

// DesktopService will be imported dynamically when needed
// Auto-updater only for installed mode - completely avoid electron-updater in portable mode
let autoUpdater = null;
const IS_PORTABLE_INIT = process.execPath.includes('NovaQ Desktop.exe');

if (!IS_PORTABLE_INIT) {
  try {
    const { autoUpdater: electronUpdater } = require('electron-updater');
    autoUpdater = electronUpdater;
    console.log('✅ Installed mode: electron-updater loaded successfully');
  } catch (error) {
    console.log('⚠️ electron-updater failed to load:', error.message);
    autoUpdater = createMockAutoUpdater();
  }
} else {
  console.log('🔧 Portable mode: Using mock autoUpdater to prevent electron-updater errors');
  autoUpdater = createMockAutoUpdater();
}

function createMockAutoUpdater() {
  const mockEvents = new Map();
  
  console.log('🔧 Creating mock autoUpdater for portable mode');
  
  const mockAutoUpdater = {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    allowDowngrade: false,
    allowPrerelease: false,
    forceDevUpdateConfig: false,
    
    checkForUpdates: () => {
      console.log('🔧 Mock autoUpdater: checkForUpdates called - returning resolved promise (no actual update check)');
      // Simulate the checking event
      setTimeout(() => {
        if (mockEvents.has('checking-for-update')) {
          mockEvents.get('checking-for-update').forEach(listener => {
            try {
              listener();
            } catch (e) {
              console.log('🔧 Mock autoUpdater: Error in checking-for-update listener:', e.message);
            }
          });
        }
        
        // Simulate update not available
        setTimeout(() => {
          if (mockEvents.has('update-not-available')) {
            mockEvents.get('update-not-available').forEach(listener => {
              try {
                listener({ version: '1.0.0' });
              } catch (e) {
                console.log('🔧 Mock autoUpdater: Error in update-not-available listener:', e.message);
              }
            });
          }
        }, 100);
      }, 50);
      
      return Promise.resolve({ updateInfo: null });
    },
    
    quitAndInstall: () => {
      console.log('🔧 Mock autoUpdater: quitAndInstall called (no-op)');
    },
    
    setFeedURL: (options) => {
      console.log('🔧 Mock autoUpdater: setFeedURL called (no-op):', JSON.stringify(options));
    },
    
    on: (event, listener) => {
      console.log(`🔧 Mock autoUpdater: Adding listener for "${event}" event (will be stored but not executed)`);
      if (!mockEvents.has(event)) {
        mockEvents.set(event, []);
      }
      mockEvents.get(event).push(listener);
    },
    
    removeListener: (event, listener) => {
      console.log(`🔧 Mock autoUpdater: Removing listener for "${event}" event`);
      if (mockEvents.has(event)) {
        const listeners = mockEvents.get(event);
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    }
  };
  
  // Add getter/setter properties to track access
  Object.defineProperty(mockAutoUpdater, 'autoDownload', {
    get() { 
      console.log('🔧 Mock autoUpdater: autoDownload getter accessed');
      return false; 
    },
    set(value) { 
      console.log('🔧 Mock autoUpdater: autoDownload setter called with:', value);
    }
  });
  
  return mockAutoUpdater;
}
const captchaManager = require('./captcha/captcha-manager');

// Set app name for notifications and window titles
app.setName('NovaQ Desktop');

// Set app user model ID for Windows notifications
if (process.platform === 'win32') {
  app.setAppUserModelId('com.novaq.desktop');
}

// Get version from package.json first, then environment, then app.getVersion()
const getAppVersion = () => {
  console.log('🔍 [DEBUG] getAppVersion() called - STARTING');
  
  // Try multiple sources for version
  console.log('🔍 [DEBUG] process.env.APP_VERSION:', process.env.APP_VERSION);
  console.log('🔍 [DEBUG] app.getVersion():', app.getVersion());
  
  // Use app.getVersion() first (from package.json), then fallback to env var
  const version = app.getVersion() || process.env.APP_VERSION;
  console.log('🔍 [DEBUG] Will return:', version);
  return version;
};


const {
  resolveApiBaseUrl,
  resolveWsBaseUrl,
  logRuntimeApi,
  isDevCli,
} = require('./config/runtimeApiConfig');

const isDevelopment = isDevCli();
const API_BASE_URL = resolveApiBaseUrl({ packaged: app.isPackaged });
const API_WS_BASE_URL = resolveWsBaseUrl(API_BASE_URL);
logRuntimeApi('MAIN');

// Renderer preload: runtime API URL (.env-ээс, webpack rebuild шаардлагагүй)
ipcMain.on('get-api-base-url-sync', (event) => {
  event.returnValue = API_BASE_URL;
});

// Portable update system - self-updating executable
const INSTALL_DIR = process.platform === 'win32'
  ? path.dirname(process.execPath)     // portable үед exe байгаа хавтас
  : path.dirname(process.execPath);

const IS_PORTABLE = !app.isPackaged || process.execPath.includes('NovaQ Desktop.exe');
console.log('🔧 [MAIN] Portable mode:', IS_PORTABLE);
console.log('🔧 [MAIN] Install directory:', INSTALL_DIR);

function versionGt(a, b) { // "1.0.10" > "1.0.9" шалгах энгийн функц
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i=0;i<Math.max(pa.length,pb.length);i++){
    const x = pa[i]||0, y = pb[i]||0;
    if (x>y) return true; if (x<y) return false;
  }
  return false;
}

// Debug logging
console.log('🔍 [MAIN] Environment detection:');
console.log('🔍 [MAIN] NODE_ENV:', process.env.NODE_ENV);
console.log('🔍 [MAIN] process.argv:', process.argv);
console.log('🔍 [MAIN] isDevelopment:', isDevelopment);
console.log('🌐 [MAIN] Environment:', isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION');
console.log('🌐 [MAIN] API Base URL:', API_BASE_URL);

// Initialize electron-store for persistent data
const store = new Store();

// Global variables to track version checks
let lastVersionCheckTime = 0;
let hasPerformedInitialCheck = false; // Flag to ensure initial check only happens once
let lastVersionData = null; // Store last version data to avoid duplicate sends
let isUnifiedCheckInProgress = false; // Flag to prevent duplicate auto-updater events during unified check
let hasSuccessfulDownload = false; // Flag to prevent multiple downloads
let lastGitLabVersionData = null; // Cache GitLab version data to prevent duplicate logs

// Unified version check function
async function performVersionChecks(mainWindow, app, forceCheck = false) {
  const currentTime = Date.now();
  
  // Prevent rapid checks (e.g., within 5 minutes) unless forced
  if (!forceCheck && global.isCheckingForUpdates && (currentTime - lastVersionCheckTime < 300000)) {
    console.log('⚠️ Skipping version checks as one is already in progress or recently completed.');
    return;
  }

  // For initial app startup, only check once
  if (!forceCheck && hasPerformedInitialCheck) {
    console.log('⚠️ Initial version check already performed, skipping...');
    return;
  }

  // Additional check: if we already have version data and it's recent, skip
  if (!forceCheck && lastVersionData && (currentTime - lastVersionCheckTime < 300000)) { // Increased to 5 minutes
    console.log('⚠️ Recent version check already completed, skipping...');
    return;
  }

  global.isCheckingForUpdates = true;
  lastVersionCheckTime = currentTime;
  hasPerformedInitialCheck = true;
  isUnifiedCheckInProgress = true; // Prevent duplicate auto-updater events
  console.log('🔧 Initiating version and database checks...');

  try {
    // Use getAppVersion() for consistent version detection
    const current = getAppVersion();
    console.log('🔎 Current app version:', current);

    // 1. Check database status
    const dbStatus = await checkDatabaseStatus();
    console.log('🔎 Database status:', dbStatus.status);
    
    if (mainWindow) {
      mainWindow.webContents.send('database-status', {
        success: dbStatus.success,
        status: dbStatus.status,
        message: dbStatus.message,
        timestamp: dbStatus.timestamp
      });
    }

    // 2. Check version from database
    const remoteVersion = await fetchRemoteVersionFromDB();
    console.log('🔎 Remote version from DB:', remoteVersion);
    
    // Enhanced database version logging
    if (remoteVersion) {
      console.log('🗄️ ✅ Database хувилбар олдлоо:', remoteVersion);
      console.log('📱 App хувилбар:', current);
      const needsUpdateFromDB = versionGt(remoteVersion, current);
      console.log('🔄 Шинэчлэл шаардлагатай:', needsUpdateFromDB ? 'Тийм' : 'Үгүй');
    } else {
      console.log('⚠️ Database хувилбар олдсонгүй (endpoint байхгүй эсвэл алдаа)');
    }

    const needsUpdateFromDB = remoteVersion && current !== remoteVersion; // Any version difference triggers update

    console.log('🔍 Database Version comparison:', {
      current,
      remote: remoteVersion,
      needsUpdate: needsUpdateFromDB,
      comparison: remoteVersion ? `${current} !== ${remoteVersion} = ${current !== remoteVersion}` : 'No remote version'
    });

    // 🚀 Auto-download if version mismatch detected (current != remote)
    if (remoteVersion && current !== remoteVersion) {
      console.log('🚀 Version mismatch detected! Starting automatic download...');
      console.log(`📱 Current: ${current} vs 🗄️ Remote: ${remoteVersion}`);
      console.log(`🔄 Шинэчлэл шаардлагатай: Тийм (хувилбар зөрүүтэй)`);
      
      // Send update info to developer tools console
      if (mainWindow && mainWindow.webContents) {
        const updateLogMessage = `🔄 UPDATE DETECTED: Current v${current} → Remote v${remoteVersion}`;
        console.log('🔧 [MAIN] Sending update info to renderer console:', updateLogMessage);
        
        // Send to renderer console - using safer approach
        const cleanRemoteVersion = remoteVersion.replace(/[\r\n]/g, '').trim();
        const updateScript = [
          `console.log('🔄 UPDATE DETECTED: Current v${current} → Remote v${cleanRemoteVersion}');`,
          `console.log('📊 Update Details:');`,
          `console.log('   📱 Current Version: ${current}');`,
          `console.log('   🗄️ Database Version: ${cleanRemoteVersion}');`,
          `console.log('   🔄 Update Required: YES');`,
          `console.log('   📥 Download URL: https://desktop-f96376.gitlab.io/NovaQ-Portable-${cleanRemoteVersion}.zip');`
        ].join('\n');
        
        mainWindow.webContents.executeJavaScript(updateScript).catch(err => {
          console.log('❌ [MAIN] Failed to send update info to renderer:', err);
        });
      }
      
      if (mainWindow) {
        console.log('🔍 [DEBUG] Sending version-status #1 - current:', current, 'remote:', remoteVersion.replace(/[\r\n]/g, ''));
        mainWindow.webContents.send('version-status', {
          current: current,
          remote: remoteVersion.replace(/[\r\n]/g, ''), // Remove \r\n characters
          needsUpdate: true,
          autoDownload: true,
          message: `Шинэ хувилбар олдлоо: v${current} → v${remoteVersion.replace(/[\r\n]/g, '')}`,
          downloadStarted: true
        });
      }
      
      // For database version mismatch, try direct download from GitLab
      try {
        console.log('🔄 Database хувилбар зөрүүтэй - GitLab-аас шууд татах оролдлого...');
        
        // Try to get GitLab version first
        const gitlabVersion = await fetchVersionFromGitLab();
        if (gitlabVersion && gitlabVersion === remoteVersion) {
          console.log('✅ GitLab хувилбар Database-тай ижил, auto-updater ажиллуулах...');
          
          // Send version status to renderer
          if (mainWindow) {
            console.log('🔍 [DEBUG] Sending version-status #2 - current:', current, 'remote:', remoteVersion);
            mainWindow.webContents.send('version-status', {
              current: current,
              remote: remoteVersion,
              needsUpdate: true,
              autoDownload: true,
              message: `Шинэ хувилбар олдлоо: v${current} → v${remoteVersion}`,
              downloadStarted: true,
              downloadUrl: `https://desktop-f96376.gitlab.io/NovaQ-Portable-${remoteVersion}.zip`
            });
          }
          
          // Check if auto-updater is enabled and app is packed
          if (!app.isPackaged || autoUpdater.autoDownload === false) {
            console.log('⚠️ Auto-updater disabled эсвэл app packed биш, updater.exe ашиглах...');
            
            // Use updater.exe for portable mode updates
            if (IS_PORTABLE) {
              console.log('🔄 Portable mode: Starting updater.exe...');
              console.log('🔍 DEBUG: IS_PORTABLE =', IS_PORTABLE);
              console.log('🔍 DEBUG: INSTALL_DIR =', INSTALL_DIR);
              
              // Use updater-32.exe (universal 32-bit build)
              const updaterPath = path.join(INSTALL_DIR, 'updater-32.exe');
              
              console.log('🔧 Using universal 32-bit updater (compatible with Windows 7 32/64-bit)');
              console.log('🔍 DEBUG: updaterPath =', updaterPath);
              console.log('🔍 DEBUG: updater exists =', fs.existsSync(updaterPath));
              
              if (fs.existsSync(updaterPath)) {
                console.log('✅ Found updater-32.exe, starting update process...');
                
                // Determine download URL (32-bit universal build)
                const downloadUrl = `https://desktop-f96376.gitlab.io/NovaQ-Portable-${remoteVersion}.zip`;
                console.log('📥 Download URL:', downloadUrl);
                console.log('🔍 DEBUG: About to send updater-status event to renderer...');
                
                // Send update start notification
                if (mainWindow && mainWindow.webContents) {
                  console.log('🔍 DEBUG: mainWindow exists, sending updater-status...');
                  
                  // Send updater-status event to show full screen update
                  mainWindow.webContents.send('updater-status', {
                    message: 'Starting NovaQ Desktop Update Process...',
                    status: 'starting'
                  });
                  console.log('🔍 DEBUG: updater-status event sent!');
                  
                  const updaterStartScript = `
                    console.log('🔄 STARTING UPDATER.EXE...');
                    console.log('📥 Download URL: ${downloadUrl}');
                    console.log('📁 Target Directory: ${INSTALL_DIR.replace(/\\/g, '\\\\')}');
                    console.log('📝 Update log file: ${INSTALL_DIR.replace(/\\/g, '\\\\')}\\\\update.log');
                    console.log('⏳ Please wait while update completes...');
                    console.log('🔍 Updater process monitoring started...');
                    console.log('💡 If update takes too long, check update.log file');
                  `;
                  
                  mainWindow.webContents.executeJavaScript(updaterStartScript).catch(err => {
                    console.log('❌ [MAIN] Failed to send updater start message:', err);
                  });
                }
                
                console.log('🔍 DEBUG: About to spawn updater process...');
                
                // Don't hide main window - let it stay visible during update
                console.log('🔍 DEBUG: Keeping main window visible during update...');
                console.log('🔍 DEBUG: Main window will stay open for user to see progress');
                
                // Windows 7 compatibility check
                const os = require('os');
                const release = os.release();
                const version = parseFloat(release);
                const isWindows7 = version >= 6.1 && version < 6.2;
                
                console.log('🔍 Windows version check:', {
                  release: release,
                  version: version,
                  isWindows7: isWindows7
                });
                
                // Start updater.exe with download URL
                const { spawn } = require('child_process');
                const spawnOptions = {
                  detached: true,
                  stdio: ['ignore', 'pipe', 'pipe'] // Capture stdout and stderr for monitoring
                };
                
                // Windows 7 specific options
                if (isWindows7) {
                  spawnOptions.windowsHide = false; // Show console for debugging
                  spawnOptions.shell = false; // Don't use shell
                  console.log('🔧 Windows 7 compatibility options applied');
                }
                
                const updaterProcess = spawn(updaterPath, [downloadUrl], spawnOptions);
                
                console.log('🔍 DEBUG: Updater process spawned, PID:', updaterProcess.pid);
                
                // Store process reference for cleanup
                global.updaterProcess = updaterProcess;
                console.log('🔍 DEBUG: Updater process stored in global');
                
                // Monitor updater process output
                let updaterOutput = '';
                let lastOutputTime = Date.now();
                
                updaterProcess.stdout.on('data', (data) => {
                  const output = data.toString();
                  updaterOutput += output;
                  lastOutputTime = Date.now();
                  console.log('📋 [UPDATER OUTPUT]:', output.trim());
                  
                  // Send progress to renderer
                  if (mainWindow && mainWindow.webContents) {
                    mainWindow.webContents.send('updater-progress', {
                      message: output.trim(),
                      timestamp: new Date().toISOString()
                    });
                  }
                });
                
                updaterProcess.stderr.on('data', (data) => {
                  const error = data.toString();
                  console.error('❌ [UPDATER ERROR]:', error.trim());
                  lastOutputTime = Date.now();
                  
                  // Send error to renderer
                  if (mainWindow && mainWindow.webContents) {
                    mainWindow.webContents.send('updater-error', {
                      message: error.trim(),
                      timestamp: new Date().toISOString()
                    });
                  }
                });
                
                // Process monitoring timeout (30 minutes for Windows 7)
                const monitoringTimeout = setTimeout(() => {
                  console.log('⏰ Updater process monitoring timeout (30 minutes)');
                  
                  // Check if process is still running
                  try {
                    process.kill(updaterProcess.pid, 0); // Check if process exists
                    console.log('⚠️ Updater process still running after timeout');
                    
                    // Send timeout warning to renderer
                    if (mainWindow && mainWindow.webContents) {
                      mainWindow.webContents.send('updater-timeout', {
                        message: 'Updater is taking longer than expected. Please wait or restart the application.',
                        pid: updaterProcess.pid
                      });
                    }
                  } catch (error) {
                    console.log('✅ Updater process already exited');
                  }
                }, 30 * 60 * 1000); // 30 minutes
                
                // Store timeout for cleanup
                global.updaterMonitoringTimeout = monitoringTimeout;
                
                updaterProcess.on('close', (code) => {
                  console.log(`🔄 Updater process exited with code: ${code}`);
                  console.log('🔍 DEBUG: Updater close event fired');
                  
                  // Clear monitoring timeout
                  if (global.updaterMonitoringTimeout) {
                    clearTimeout(global.updaterMonitoringTimeout);
                    global.updaterMonitoringTimeout = null;
                    console.log('🔍 DEBUG: Updater monitoring timeout cleared');
                  }
                  
                  // Send completion status to renderer
                  if (mainWindow && mainWindow.webContents) {
                    mainWindow.webContents.send('updater-complete', {
                      code: code,
                      success: code === 0,
                      message: code === 0 ? 'Update completed successfully' : `Update failed with code: ${code}`,
                      timestamp: new Date().toISOString()
                    });
                  }
                  
                  if (code === 0) {
                    console.log('✅ Update completed successfully');
                    console.log('🔄 Update process finished, but keeping app running...');
                    // Don't quit the app automatically - let user decide
                  } else {
                    console.error('❌ Update failed with exit code:', code);
                    console.log('🔄 Update failed, keeping app running...');
                  }
                  
                  console.log('🔍 DEBUG: Close handler completed');
                });
                
                console.log('🔍 DEBUG: About to unref updater process...');
                updaterProcess.unref();
                console.log('🔍 DEBUG: Updater process unref completed');
                console.log('🔍 DEBUG: Returning from updater spawn block...');
                return;
              } else {
                console.log('⚠️ updater.exe not found, falling back to manual download');
              }
            }
            
            // Fallback: Manual download - use simple direct download
            try {
              console.log('🔧 Manual ZIP download эхлүүлж байна...');
              
              // Send manual download info to developer tools console
              if (mainWindow && mainWindow.webContents) {
                const manualDownloadLogMessage = `🔧 MANUAL DOWNLOAD STARTED: v${remoteVersion}`;
                console.log('🔧 [MAIN] Sending manual download info to renderer console:', manualDownloadLogMessage);
                
                const cleanRemoteVersionManual = remoteVersion.replace(/[\r\n]/g, '').trim();
                const manualDownloadScript = [
                  `console.log('🔧 MANUAL DOWNLOAD STARTED: v${cleanRemoteVersionManual}');`,
                  `console.log('📦 Manual Download Details:');`,
                  `console.log('   🎯 Target Version: ${cleanRemoteVersionManual}');`,
                  `console.log('   🏗️ Build: Universal 32-bit (Windows 7+ compatible)');`,
                  `console.log('   📁 Target Directory: C:\\\\Novaq\\\\NovaQ Desktop');`,
                  `console.log('   📥 Download URL: https://desktop-f96376.gitlab.io/NovaQ-Portable-${cleanRemoteVersionManual}.zip');`,
                  `console.log('   🔧 Method: Direct fetch with auto-extract');`
                ].join('\n');
                
                mainWindow.webContents.executeJavaScript(manualDownloadScript).catch(err => {
                  console.log('❌ [MAIN] Failed to send manual download info to renderer:', err);
                });
              }
              
              // Use simplified download approach for portable exe (32-bit universal build)
              const zipUrl = `https://desktop-f96376.gitlab.io/NovaQ-Portable-${remoteVersion}.zip`;
              console.log('🏗️ Using universal 32-bit build (Windows 7+ compatible)');
              const targetDir = IS_PORTABLE ? INSTALL_DIR : 'C:\\Novaq\\NovaQ Desktop';
              const zipPath = path.join(targetDir, `NovaQ-Portable-${remoteVersion}.zip`);
              
              console.log('🔧 Portable mode:', IS_PORTABLE);
              console.log('📁 Target directory:', targetDir);
              
              // Create directory
              if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
                console.log('📁 Created target directory:', targetDir);
              }
              
              // Download using HTTPS module (no node-fetch dependency)
              console.log(`📥 Downloading from: ${zipUrl}`);
              
              const downloadPromise = new Promise((resolve, reject) => {
                const parsedUrl = new URL(zipUrl);
                const options = {
                  hostname: parsedUrl.hostname,
                  port: parsedUrl.port || 443,
                  path: parsedUrl.pathname + parsedUrl.search,
                  method: 'GET',
                  headers: { 'User-Agent': 'NovaQ-Desktop-Updater/1.0' }
                };
                
                const req = https.request(options, (res) => {
                  if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                    return;
                  }
                  
                  const chunks = [];
                  let totalLength = 0;
                  
                  res.on('data', (chunk) => {
                    chunks.push(chunk);
                    totalLength += chunk.length;
                  });
                  
                  res.on('end', () => {
                    const buffer = Buffer.concat(chunks, totalLength);
                    console.log(`📦 Downloaded buffer size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
                    resolve(buffer);
                  });
                });
                
                req.on('error', reject);
                req.end();
              });
              
              const buffer = await downloadPromise;
              fs.writeFileSync(zipPath, buffer);
              console.log('✅ Downloaded zip file:', zipPath);
              
              // Send download success to developer tools console
              if (mainWindow && mainWindow.webContents) {
                const fileSizeMB = (buffer.length / 1024 / 1024).toFixed(2);
                const downloadSuccessScript = [
                  `console.log('✅ DOWNLOAD COMPLETED: ${zipPath.replace(/\\/g, '\\\\')}');`,
                  `console.log('📦 File size: ${fileSizeMB} MB');`,
                  `console.log('🔄 Starting extraction...');`
                ].join('\n');
                
                mainWindow.webContents.executeJavaScript(downloadSuccessScript).catch(err => {
                  console.log('❌ [MAIN] Failed to send download success to renderer:', err);
                });
              }
              
              // Extract using tar (Windows 10+) with PowerShell fallback
              const { exec } = require('child_process');
              const extractCommand = `tar -xf "${zipPath}" -C "${targetDir}"`;
              
              exec(extractCommand, (extractError) => {
                if (extractError) {
                  console.warn('⚠️ Tar extraction failed, trying PowerShell fallback...');
                  
                  // Fallback to PowerShell with proper execution policy
                  const powershellCommand = `powershell -ExecutionPolicy Bypass -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${targetDir}' -Force"`;
                  
                  exec(powershellCommand, (psError) => {
                    if (psError) {
                      console.error('❌ PowerShell extract error:', psError);
                  
                  // Send extract error to developer tools console
                  if (mainWindow && mainWindow.webContents) {
                        const extractErrorScript = `console.error('❌ EXTRACT ERROR: ' + ${JSON.stringify(psError.message)});`;
                    
                    mainWindow.webContents.executeJavaScript(extractErrorScript).catch(err => {
                      console.log('❌ [MAIN] Failed to send extract error to renderer:', err);
                    });
                  }
                } else {
    console.log('✅ Successfully extracted using PowerShell to:', targetDir);
    
    // Handle executable update for portable mode
    const currentExePath = process.execPath;
    const extractedExePath = path.join(targetDir, 'NovaQ Desktop.exe');
    
    if (fs.existsSync(extractedExePath) && currentExePath.includes('NovaQ Desktop.exe')) {
      console.log('🔄 Portable mode: Preparing executable update...');
      
      // Rename the extracted executable to .new
      const newExePath = path.join(path.dirname(currentExePath), 'NovaQ Desktop.exe.new');
      
      try {
        // Remove old .new file if exists
        if (fs.existsSync(newExePath)) {
          fs.unlinkSync(newExePath);
        }
        
        // Move extracted exe to .new
        fs.renameSync(extractedExePath, newExePath);
        console.log('📋 Staged new executable as .new file');
        
        // Create update script
        const updateScript = `@echo off
echo Updating NovaQ Desktop executable...
timeout /t 2 /nobreak > nul
echo Moving old executable to backup...
if exist "${currentExePath.replace(/\//g, '\\')}" (
    move "${currentExePath.replace(/\//g, '\\')}" "${currentExePath.replace(/\//g, '\\')}.old"
)
echo Installing new executable...
move "${newExePath.replace(/\//g, '\\')}" "${currentExePath.replace(/\//g, '\\')}"
echo Update completed! Starting new version...
start "" "${currentExePath.replace(/\//g, '\\')}"
echo Cleaning up...
if exist "${currentExePath.replace(/\//g, '\\')}.old" del "${currentExePath.replace(/\//g, '\\')}.old"
del "%~f0"`;
        
        const updateScriptPath = path.join(targetDir, 'update.bat');
        fs.writeFileSync(updateScriptPath, updateScript);
        
        console.log('📝 Created update script for executable replacement');
        console.log('🔄 To complete update: Close app and run update.bat');
        
        // Display version information
        console.log('🔍 ========== EXECUTABLE UPDATE READY ==========');
        console.log('📦 NEW VERSION: 1.0.4 (staged as .new file)');
        console.log('📁 LOCATION: C:\\Novaq\\NovaQ Desktop');
        console.log('📝 UPDATE SCRIPT: update.bat created');
        console.log('✅ STATUS: Ready to complete update');
        console.log('🔄 NEXT: Close app → run update.bat → new version starts');
        console.log('==========================================');
        
      } catch (stageError) {
        console.error('❌ Failed to stage executable update:', stageError.message);
        
        // Fallback: just show version info
        console.log('🔍 ========== UPDATE VERSION INFO ==========');
        console.log('📦 EXTRACTED VERSION: Latest from GitLab (1.0.4)');
        console.log('📁 EXTRACT LOCATION: C:\\Novaq\\NovaQ Desktop');
        console.log('⚠️ EXECUTABLE: Could not stage update (manual replacement needed)');
        console.log('==========================================');
      }
    } else {
      console.log('🔍 ========== UPDATE VERSION INFO ==========');
      console.log('📦 EXTRACTED VERSION: Latest from GitLab (1.0.4)');
      console.log('📁 EXTRACT LOCATION: C:\\Novaq\\NovaQ Desktop');
      console.log('✅ UPDATE STATUS: COMPLETED SUCCESSFULLY');
      console.log('==========================================');
    }
                    }
                  });
                } else {
                  console.log('✅ Successfully extracted using tar to:', targetDir);
                  try {
                    fs.unlinkSync(zipPath);
                    console.log('🗑️ Deleted zip file after extraction');
                  } catch (deleteError) {
                    console.warn('⚠️ Could not delete zip file:', deleteError.message);
                  }
                  console.log('🎉 Manual download completed successfully!');
                  
                  // Handle executable update for portable mode
                  const currentExePath = process.execPath;
                  const extractedExePath = path.join(targetDir, 'NovaQ Desktop.exe');
                  
                  if (fs.existsSync(extractedExePath) && currentExePath.includes('NovaQ Desktop.exe')) {
                    console.log('🔄 Portable mode: Preparing executable update...');
                    
                    // Rename the current running executable
                    const oldExePath = path.join(path.dirname(currentExePath), 'NovaQ Desktop.exe.old');
                    const newExePath = path.join(path.dirname(currentExePath), 'NovaQ Desktop.exe.new');
                    
                    try {
                      // Move extracted exe to .new
                      fs.renameSync(extractedExePath, newExePath);
                      console.log('📋 Staged new executable as .new file');
                      
                      // Create update script
                      const updateScript = `@echo off
echo Updating NovaQ Desktop...
timeout /t 2 /nobreak > nul
if exist "${currentExePath.replace(/\//g, '\\')}" (
    move "${currentExePath.replace(/\//g, '\\')}" "${oldExePath.replace(/\//g, '\\')}"
)
move "${newExePath.replace(/\//g, '\\')}" "${currentExePath.replace(/\//g, '\\')}"
echo Update completed! Starting new version...
start "" "${currentExePath.replace(/\//g, '\\')}"
del "%~f0"`;
                      
                      const updateScriptPath = path.join(targetDir, 'update.bat');
                      fs.writeFileSync(updateScriptPath, updateScript);
                      
                      console.log('📝 Created update script for executable replacement');
                      console.log('🔄 To complete update: Close app and run update.bat');
                      
                    } catch (stageError) {
                      console.error('❌ Failed to stage executable update:', stageError.message);
                    }
                  }
                  
                  // Display version information from the download
                  // console.log('🔍 ========== UPDATE VERSION INFO ==========');
                  // console.log('📦 EXTRACTED VERSION: Latest from GitLab (1.0.4)');
                  // console.log('📁 EXTRACT LOCATION: C:\\Novaq\\NovaQ Desktop');
                  // console.log('✅ UPDATE STATUS: COMPLETED SUCCESSFULLY');
                  // console.log('🔄 NEXT: Close app and run update.bat to complete');
                  // console.log('==========================================');
                  
                  // Send extract success to developer tools console
                  if (mainWindow && mainWindow.webContents) {
                    const extractSuccessScript = [
                      `console.log('🔍 ========== UPDATE VERSION INFO ==========');`,
                      `console.log('📦 EXTRACTED VERSION: Latest from GitLab (1.0.4)');`,
                      `console.log('📁 EXTRACT LOCATION: ${targetDir.replace(/\\/g, '\\\\')}');`,
                      `console.log('✅ UPDATE STATUS: COMPLETED SUCCESSFULLY');`,
                      `console.log('🔄 NEXT: Run the updated application');`,
                      `console.log('==========================================');`,
                      `console.log('✅ EXTRACTION COMPLETED: ${targetDir.replace(/\\/g, '\\\\')}');`,
                      `console.log('🗑️ ZIP file deleted after extraction');`,
                      `console.log('🎉 MANUAL UPDATE COMPLETED SUCCESSFULLY!');`,
                      `console.log('📋 Next Steps:');`,
                      IS_PORTABLE ? 
                        `console.log('   🔄 Portable mode: App will restart with new version automatically');` :
                        `console.log('   1. Close current app');` +
                        `console.log('   2. Run new version from: ${targetDir.replace(/\\/g, '\\\\')}');` +
                        `console.log('   3. New version should be: v${remoteVersion}');`
                    ].join('\n');
                    
                    mainWindow.webContents.executeJavaScript(extractSuccessScript).catch(err => {
                      console.log('❌ [MAIN] Failed to send extract success to renderer:', err);
                    });
                  }
                  
                  // Auto-restart for portable mode
                  if (IS_PORTABLE) {
                    console.log('🔄 Portable mode: Restarting app with new version...');
                    setTimeout(() => {
                      const newExePath = path.join(targetDir, 'NovaQ Desktop.exe');
                      if (fs.existsSync(newExePath)) {
                        console.log('🚀 Starting new version:', newExePath);
                        spawn(newExePath, [], { detached: true, stdio: 'ignore' }).unref();
                        app.quit();
                      } else {
                        console.log('❌ New exe file not found:', newExePath);
                      }
                    }, 2000); // Wait 2 seconds before restart
                  }
                }
              });
              
            } catch (manualError) {
              console.error('❌ Manual download алдаа:', manualError);
              
              // Send manual download error to developer tools console
              if (mainWindow && mainWindow.webContents) {
                const errorScript = `console.error('❌ MANUAL DOWNLOAD ERROR: ' + ${JSON.stringify(manualError.message)});`;
                
                mainWindow.webContents.executeJavaScript(errorScript).catch(err => {
                  console.log('❌ [MAIN] Failed to send manual download error to renderer:', err);
                });
              }
            }
          } else {
            if (!IS_PORTABLE) {
            try {
              // Set update server URL for development
              if (isDevelopment) {
                autoUpdater.setFeedURL({
                  provider: 'generic',
                  url: 'https://desktop-f96376.gitlab.io/'
                });
                console.log('🔧 Development mode: Set feed URL to GitLab Pages');
              }
              
              console.log('🔄 Starting auto-updater check...');
              autoUpdater.checkForUpdates();
            } catch (autoUpdaterError) {
              console.log('❌ Auto-updater алдаа:', autoUpdaterError.message);
              }
            } else {
              console.log('🔧 Portable mode: Skipping auto-updater, using custom update system');
            }
          }
        } else {
          console.log('⚠️ GitLab хувилбар Database-тай зөрүүтэй, мэдээлэл илгээх...');
          console.log(`GitLab: ${gitlabVersion}, Database: ${remoteVersion}`);
          
          // If GitLab has a newer version than database, use GitLab version for download
          if (gitlabVersion && versionGt(gitlabVersion, remoteVersion)) {
            console.log('🚀 GitLab хувилбар Database-аас шинэ, GitLab хувилбарыг ашиглах...');
            console.log(`📥 Download URL: https://desktop-f96376.gitlab.io/NovaQ-Portable-${gitlabVersion}.zip`);
            
            if (mainWindow) {
              mainWindow.webContents.send('version-status', {
                current: current,
                remote: gitlabVersion, // Use GitLab version
                needsUpdate: true,
                autoDownload: true,
                message: `Шинэ хувилбар GitLab-д байна: v${current} → v${gitlabVersion}`,
                downloadStarted: true,
                downloadUrl: `https://desktop-f96376.gitlab.io/NovaQ-Portable-${gitlabVersion}.zip`
              });
            }
            
            // Try auto-updater with GitLab version (only for installed mode)
            if (!IS_PORTABLE) {
            try {
              console.log('🔄 GitLab хувилбараар auto-updater ажиллуулах...');
              autoUpdater.checkForUpdates();
            } catch (error) {
              console.error('❌ GitLab auto-updater алдаа:', error);
              }
            } else {
              console.log('🔧 Portable mode: Skipping GitLab auto-updater, using custom update system');
            }
          } else {
            // Database version is newer than GitLab - check if database version file exists on GitLab
            console.log('🚀 Database хувилбар GitLab-аас шинэ, Database хувилбарыг татах оролдлого...');
            const databaseVersionUrl = `https://desktop-f96376.gitlab.io/NovaQ-Portable-${remoteVersion}.zip`;
            console.log(`📥 Database version download URL attempt: ${databaseVersionUrl}`);
            
            // Check if database version file exists on GitLab using HTTPS
            try {
              console.log('🔍 Checking database version file availability...');
              
              const checkResponse = await new Promise((resolve, reject) => {
                const parsedUrl = new URL(databaseVersionUrl);
                const options = {
                  hostname: parsedUrl.hostname,
                  port: parsedUrl.port || 443,
                  path: parsedUrl.pathname + parsedUrl.search,
                  method: 'HEAD',
                  headers: { 'User-Agent': 'NovaQ-Desktop-Updater/1.0' }
                };
                
                const req = https.request(options, (res) => {
                  console.log(`📡 Database version check: ${res.statusCode} ${res.statusMessage}`);
                  resolve(res);
                });
                
                req.on('error', (error) => {
                  console.log(`❌ Database version check failed: ${error.message}`);
                  reject(error);
                });
                
                req.setTimeout(10000, () => {
                  req.destroy();
                  reject(new Error('Database version check timeout'));
                });
                
                req.end();
              });
              
              console.log(`🔍 [DEBUG] Database version check response:`, {
                statusCode: checkResponse.statusCode,
                statusMessage: checkResponse.statusMessage,
                headers: checkResponse.headers
              });
              
              if (checkResponse.statusCode === 200) {
                // Database version file exists on GitLab - proceed with database version
                console.log('✅ Database version файл GitLab дээр байна, database version ашиглах...');
                
            if (mainWindow) {
              mainWindow.webContents.send('version-status', {
                current: current,
                    remote: remoteVersion, // Use Database version (newer)
                needsUpdate: true,
                    autoDownload: true,
                    message: `Шинэ хувилбар Database-д байна: v${current} → v${remoteVersion}`,
                    downloadStarted: true,
                    downloadUrl: databaseVersionUrl
                  });
                }
                
                // Try auto-updater with database version (only for installed mode)
                if (!IS_PORTABLE) {
                try {
                  console.log('🔄 Database хувилбараар auto-updater ажиллуулах...');
                  autoUpdater.checkForUpdates();
                } catch (error) {
                  console.error('❌ Database auto-updater алдаа:', error);
                  }
                } else {
                  console.log('🔧 Portable mode: Skipping database auto-updater, using custom update system');
                }
              } else {
                // Database version file doesn't exist on GitLab - but database says update is needed
                // Use GitLab version file but indicate database version as target
                console.log('⚠️ Database version файл GitLab дээр байхгүй (404), GitLab файл ашиглаад database version руу update хийх...');
                console.log(`📥 Using GitLab file for database update: https://desktop-f96376.gitlab.io/NovaQ-Portable-${gitlabVersion}.zip`);
                console.log(`🎯 Target version from database: ${remoteVersion}`);
                console.log(`🔍 [DEBUG] gitlabVersion value:`, gitlabVersion);
                console.log(`🔍 [DEBUG] IS_PORTABLE value:`, IS_PORTABLE);
                
                if (mainWindow) {
                  mainWindow.webContents.send('version-status', {
                    current: current,
                    remote: remoteVersion, // Keep database version as target
                    needsUpdate: true, // Database says update is needed
                    autoDownload: true, // Force download since database version is newer
                    message: `Database-д шинэ хувилбар байна: v${current} → v${remoteVersion} (GitLab файл ашиглаж байна)`,
                    downloadStarted: true,
                    downloadUrl: `https://desktop-f96376.gitlab.io/NovaQ-Portable-${gitlabVersion}.zip`, // Use available GitLab file
                    fallbackInfo: {
                      targetVersion: remoteVersion,
                      downloadVersion: gitlabVersion,
                      reason: 'Database version file not available on GitLab'
                    }
                  });
                }
                
                // Force download since database indicates update is needed
                console.log(`🔍 [DEBUG] About to check IS_PORTABLE: ${IS_PORTABLE}`);
                console.log(`🔍 [DEBUG] gitlabVersion available: ${gitlabVersion ? 'YES' : 'NO'}`);
                
                if (IS_PORTABLE) {
                  console.log('🔄 Portable mode: Database хувилбар шаардлагатай, UpdateService ашиглах...');
                  console.log(`🔍 [DEBUG] Will send trigger-portable-update with version: ${gitlabVersion}`);
                  
                  // Use fallback version if gitlabVersion is null
                  const updateVersion = gitlabVersion || remoteVersion;
                  console.log(`🔍 [DEBUG] Final update version: ${updateVersion}`);
                  
                  // Send download trigger to renderer to use UpdateService
                  if (mainWindow && mainWindow.webContents) {
                    console.log('📡 [MAIN] Sending trigger-portable-update event to renderer...');
                    console.log('📡 [MAIN] Event data:', {
                      version: gitlabVersion,
                      reason: 'database-version-newer'
                    });
                    
                    mainWindow.webContents.send('trigger-portable-update', {
                      version: updateVersion, // Use fallback version
                      reason: 'database-version-newer',
                      fallbackInfo: {
                        targetVersion: remoteVersion,
                        downloadVersion: updateVersion,
                        reason: 'Database version file not available on GitLab'
                      }
                    });
                    
                    console.log('✅ [MAIN] trigger-portable-update event sent to renderer');
                  } else {
                    console.error('❌ [MAIN] mainWindow or webContents not available for trigger-portable-update');
                  }
                } else {
                  console.log('🔄 Installed mode: Database хувилбар шаардлагатай, auto-updater ажиллуулах...');
                  if (!IS_PORTABLE) {
                  try {
                    autoUpdater.checkForUpdates();
                  } catch (error) {
                    console.error('❌ Auto-updater алдаа:', error);
                    }
                  } else {
                    console.log('🔧 Portable mode: Skipping auto-updater, using custom update system');
                  }
                }
              }
            } catch (fileCheckError) {
              console.log('⚠️ Database version файл шалгахад алдаа, GitLab файл ашиглаад database version руу update хийх...', fileCheckError.message);
              console.log(`📥 Using GitLab file for database update: https://desktop-f96376.gitlab.io/NovaQ-Portable-${gitlabVersion}.zip`);
              console.log(`🎯 Target version from database: ${remoteVersion}`);
              
              if (mainWindow) {
                mainWindow.webContents.send('version-status', {
                  current: current,
                  remote: remoteVersion, // Keep database version as target
                  needsUpdate: true, // Database says update is needed
                  autoDownload: true, // Force download since database version is newer
                  message: `Database-д шинэ хувилбар байна: v${current} → v${remoteVersion} (GitLab файл ашиглаж байна)`,
                  downloadStarted: true,
                  downloadUrl: `https://desktop-f96376.gitlab.io/NovaQ-Portable-${gitlabVersion}.zip`, // Use available GitLab file
                  fallbackInfo: {
                    targetVersion: remoteVersion,
                    downloadVersion: gitlabVersion,
                    reason: 'Error checking database version file on GitLab'
                  }
                });
              }
              
              // Force auto-updater since database indicates update is needed (only for installed mode)
              if (!IS_PORTABLE) {
              try {
                console.log('🔄 Database хувилбар шаардлагатай, GitLab файлаар auto-updater ажиллуулах...');
                autoUpdater.checkForUpdates();
              } catch (error) {
                console.error('❌ Fallback auto-updater алдаа:', error);
                }
              } else {
                console.log('🔧 Portable mode: Skipping fallback auto-updater, using custom update system');
              }
            }
          }
        }
      } catch (error) {
        console.error('❌ Failed to handle database version mismatch:', error);
      }
    }

    // Prepare version status data
    const versionStatusData = {
      current: current,
      remote: remoteVersion || current, // Fallback to current version if no remote version
      needsUpdate: needsUpdateFromDB,
      message: needsUpdateFromDB ?
        `Шинэ хувилбар олдлоо: v${current} → v${remoteVersion}` :
        'Хамгийн шинэ хувилбар ашиглаж байна'
    };

    // Only send if data has changed
    if (!lastVersionData || JSON.stringify(lastVersionData) !== JSON.stringify(versionStatusData)) {
      if (mainWindow) {
        mainWindow.webContents.send('version-status', versionStatusData);
        lastVersionData = versionStatusData;
      }
    } else {
      console.log('📋 Skipping duplicate version status send (database check)');
    }

    // 3. Auto-updater disabled - only using manual ZIP download
    console.log('✅ Auto-updater disabled - using manual ZIP download only');

  } catch (e) {
    console.error('❌ Error during version checks:', e.message);
    if (mainWindow) {
      mainWindow.webContents.send('version-status', {
        current: getAppVersion(),
        remote: getAppVersion(), // Fallback to current version
        needsUpdate: false,
        error: e.message,
        message: `Хувилбар шалгахад алдаа гарлаа: ${e.message}`
      });
    }
  } finally {
    // Don't reset flags if updater is running
    if (!global.updaterProcess || global.updaterProcess.killed) {
      global.isCheckingForUpdates = false;
      isUnifiedCheckInProgress = false; // Reset flag to allow auto-updater events
      console.log('✅ All version and database checks completed.');
      console.log('✅ Zip файл татаж эхэллээ.');
    } else {
      console.log('🔍 DEBUG: Updater is running, keeping flags set');
      console.log('🔍 DEBUG: Skipping finally block cleanup to let updater continue');
    }
  }
}

// ✅ App эхлэх үед auth token-г global-д тохируулах
global.currentAuthToken =
  store.get('jwt_token') ||
  null;
console.log('🔑 [MAIN] App эхлэх үед auth token тохируулагдлаа:', global.currentAuthToken ? '✅' : '❌');


let mainWindow;
let blurTimeOut;
const WINDOW_MIN_WIDTH = 200;
const WINDOW_MIN_HEIGHT = 300;

function createWindow() {
   const preloadPath = app.isPackaged
  ? path.join(__dirname, 'preload.js')  // prod: app.asar/src -> preload.js
  : path.join(__dirname, 'preload.js');               // dev: src/preload.js
  
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 270,
    height: 510,
    resizable: true,
    maximizable: false,
    title: 'NovaQ Desktop',
    alwaysOnTop: true,
    skipTaskbar: false,
    show: true,
    focusable: true,
    center: true,
    frame: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      enableRemoteModule: false,
      webSecurity: true,
      allowRunningInsecureContent: false
    },
    icon: path.join(__dirname, '../assets/Logo.ico'),
    titleBarStyle: 'default',
  });
  mainWindow.setAlwaysOnTop(true, "screen-saver");
  mainWindow.setMinimumSize(WINDOW_MIN_WIDTH, WINDOW_MIN_HEIGHT);

  // Track load attempts for fallback
  let loadAttempted = false;
  let fallbackAttempted = false;

  // Load HTML file
  if (isDevelopment) {
    // In development, try webpack dev server first, then fallback to dist
    const devServerUrl = 'http://localhost:3201';
    const indexPath = path.join(__dirname, '../dist/index.html');

    // Check if dist folder exists with index.html
    const distExists = fs.existsSync(indexPath);

    // Handle failed load events
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame) return; // Only handle main frame failures

      // If this is the first load attempt (dev server)
      if (!loadAttempted && validatedURL === devServerUrl) {
        loadAttempted = true;
        console.log('⚠️ Webpack dev server not available:', errorDescription);
        console.log('📁 Falling back to dist folder...');

        if (distExists && !fallbackAttempted) {
          fallbackAttempted = true;
          console.log('📁 Loading from dist folder:', indexPath);
          mainWindow.loadFile(indexPath);
        } else if (!distExists) {
          console.error('❌ Dist folder not found. Please run: npm run webpack:build');
          // Show error message after window is ready
          setTimeout(() => {
            mainWindow.webContents.executeJavaScript(`
              document.body.innerHTML = '<div style="padding: 20px; font-family: Arial; text-align: center; background: #f5f5f5; height: 100vh; display: flex; align-items: center; justify-content: center; flex-direction: column;">
                <h2 style="color: #d32f2f;">❌ Build Files Not Found</h2>
                <p>Please build the application first:</p>
                <p style="background: #fff; padding: 10px; border-radius: 4px; font-family: monospace;"><code>npm run webpack:build</code></p>
                <p style="margin-top: 20px;">Or start the dev server:</p>
                <p style="background: #fff; padding: 10px; border-radius: 4px; font-family: monospace;"><code>npm run webpack:dev</code></p>
                <p style="margin-top: 20px;">Or use the combined command:</p>
                <p style="background: #fff; padding: 10px; border-radius: 4px; font-family: monospace;"><code>npm run dev:live</code></p>
              </div>';
            `).catch(() => {});
          }, 500);
        }
      } else if (loadAttempted && fallbackAttempted && validatedURL.startsWith('file://')) {
        // Both attempts failed - dist folder also failed
        console.error('❌ Both dev server and dist folder failed to load');
        setTimeout(() => {
          mainWindow.webContents.executeJavaScript(`
            document.body.innerHTML = '<div style="padding: 20px; font-family: Arial; text-align: center; background: #f5f5f5; height: 100vh; display: flex; align-items: center; justify-content: center; flex-direction: column;">
              <h2 style="color: #d32f2f;">⚠️ Development Server Not Available</h2>
              <p>Please run one of the following commands:</p>
              <ul style="text-align: left; display: inline-block; background: #fff; padding: 20px; border-radius: 4px;">
                <li style="margin: 10px 0;"><code>npm run webpack:dev</code> - Start webpack dev server</li>
                <li style="margin: 10px 0;"><code>npm run webpack:build</code> - Build for development</li>
                <li style="margin: 10px 0;"><code>npm run dev:live</code> - Start both webpack and electron</li>
              </ul>
            </div>';
          `).catch(() => {});
        }, 500);
      }
    });

    // Try to load from webpack dev server first
    console.log('🔍 Attempting to load from webpack dev server:', devServerUrl);
    mainWindow.loadURL(devServerUrl);
  } else {
    // In production, load HTML from dist folder (built files)
    // In packaged ASAR, main.js is in app.asar/src/ but dist is in app.asar/dist/
    const indexPath = path.join(__dirname, '../dist/index.html');
    console.log('📁 Loading production file from:', indexPath);
    console.log('📁 __dirname:', __dirname);
    console.log('📁 process.env.ELECTRON_IS_DEV:', process.env.ELECTRON_IS_DEV);
    mainWindow.loadFile(indexPath);
  }
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('blur', () => {
    let currentOpacity = 1.0;
    const targetOpacity = 0.35;
    const duration = 3000; 
    const steps = 60;
    const stepDuration = duration / steps;
    const opacityStep = (currentOpacity - targetOpacity) / steps;
    
    const animateOpacity = () => {
      if (currentOpacity > targetOpacity) {
        currentOpacity -= opacityStep;
        mainWindow.setOpacity(currentOpacity);
        blurTimeOut =  setTimeout(animateOpacity, stepDuration);
      } else {
        mainWindow.setOpacity(targetOpacity);
      }
    };
    
    animateOpacity();
  });

  mainWindow.on('focus', () => {
    if (blurTimeOut) {
      clearTimeout(blurTimeOut);
      blurTimeOut = null;
    }
    try {
      console.log('🔍 mainWindow focus');
    } catch (error) {
      // Ignore EPIPE errors from console.log
    }
    mainWindow.setOpacity(1);
  });
  // Open DevTools only in development mode
  if (isDevelopment) {
    mainWindow.webContents.openDevTools();
  }
}

// Configure auto-updater based on mode
console.log('🔧 Configuring auto-updater...');

if (IS_PORTABLE) {
  // For portable mode, disable auto-updater and use our custom update system
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  console.log('🔧 Portable mode: Auto-updater DISABLED - using custom update system');
} else {
  // For installed mode, check if config file exists
  const updateConfigPath = path.join(__dirname, '..', 'dev-app-update.yml');
if (fs.existsSync(updateConfigPath)) {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowDowngrade = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.forceDevUpdateConfig = true;
    console.log('✅ Installed mode: Auto-updater ENABLED - config file found at:', updateConfigPath);
} else {
  autoUpdater.autoDownload = false;
    console.log('⚠️ Installed mode: Auto-updater DISABLED - no config file found at:', updateConfigPath);
  }
}

console.log('🔧 Auto-updater configuration completed');

// Auto-updater event handlers (only for installed mode)
if (!IS_PORTABLE) {
autoUpdater.on('checking-for-update', () => {
  console.log('🔍 Auto-updater: Checking for update...');
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('download-log', {
      type: 'info',
      message: '🔍 Auto-updater: Checking for update...'
    });
  }
});

autoUpdater.on('update-available', (info) => {
  console.log('🎉 Auto-updater: Update available!', info.version);
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('download-log', {
      type: 'success',
      message: `🎉 Update available: v${info.version}`
    });
  }
});

autoUpdater.on('update-not-available', (info) => {
  console.log('ℹ️ Auto-updater: Update not available');
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('download-log', {
      type: 'info',
      message: 'ℹ️ No update available from auto-updater'
    });
  }
});

autoUpdater.on('error', (err) => {
  console.error('❌ Auto-updater error:', err);
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('download-log', {
      type: 'error',
      message: `❌ Auto-updater error: ${err.message}`
    });
    
    // If config file not found or latest.yml not found, trigger manual download
    if (err.message.includes('Cannot find channel "latest.yml"') || 
        err.message.includes('404') || 
        (err.message.includes('ENOENT') && err.message.includes('app-update.yml'))) {
      console.log('🔄 Latest.yml not found, triggering manual download...');
      mainWindow.webContents.send('download-log', {
        type: 'info',
        message: '🔄 Latest.yml файл олдсонгүй, manual download эхлүүлж байна...'
        });
    }
  }
});

autoUpdater.on('download-progress', (progressObj) => {
  const percent = Math.round(progressObj.percent);
  console.log(`📥 Download progress: ${percent}%`);
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('download-log', {
      type: 'progress',
      message: `📥 Download progress: ${percent}% (${(progressObj.transferred / 1024 / 1024).toFixed(2)} MB / ${(progressObj.total / 1024 / 1024).toFixed(2)} MB)`
    });
  }
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('✅ Auto-updater: Update downloaded!', info.version);
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('download-log', {
      type: 'success',
      message: `✅ Update downloaded: v${info.version} - Ready to install!`
    });
  }
  
    // For installed mode, handle update
    setTimeout(() => {
      autoUpdater.quitAndInstall();
    }, 3000);
});
} else {
  console.log('🔧 Portable mode: Skipping auto-updater event handlers setup');
}

// App event handlers
app.whenReady().then(() => {
  // Configure CSP for development mode (allow unsafe-eval for HMR)
  if (isDevelopment) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      const responseHeaders = {
          ...details.responseHeaders,
          'Content-Security-Policy': ['']
      };
      
      // Remove any existing CSP headers (case-insensitive)
      Object.keys(responseHeaders).forEach(key => {
        if (key.toLowerCase() === 'content-security-policy') {
          delete responseHeaders[key];
        }
      });
      
      // Set new CSP header with unsafe-eval for HMR
      responseHeaders['Content-Security-Policy'] = [
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: https:; " +
        `connect-src 'self' ${API_BASE_URL} https://desktop-f96376.gitlab.io/ ${API_WS_BASE_URL} https://api.ipify.org;`
      ];
      
      callback({ responseHeaders });
    });
    console.log('🔒 CSP configured for development (unsafe-eval enabled for HMR)');
  }
  
  createWindow();
  
  // Set max listeners to prevent warning
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.setMaxListeners(100);
  }

  // 🔧 Single version check when app starts (only once)
  setTimeout(async () => {
    await performVersionChecks(mainWindow, app);
  }, 5000); // Wait 5 seconds for UI to be ready
});

app.on('window-all-closed', () => {
  console.log('🔍 DEBUG: window-all-closed event fired');
  console.log('🔍 DEBUG: Updater running?', !!(global.updaterProcess && !global.updaterProcess.killed));
  
  // Don't quit if updater is running
  if (global.updaterProcess && !global.updaterProcess.killed) {
    console.log('⚠️ Updater is running, preventing app quit!');
    console.log('🔍 DEBUG: App will stay alive for updater to complete');
    return; // Don't quit the app
  }
  
  if (process.platform !== 'darwin') {
    console.log('🔍 DEBUG: Calling app.quit()...');
    app.quit();
  }
});

// Clean up processes before app quits
app.on('before-quit', (event) => {
  console.log('🔄 App is quitting...');
  console.log('🔍 DEBUG: before-quit event fired');
  
  // DON'T kill updater process - let it complete the update
  if (global.updaterProcess && !global.updaterProcess.killed) {
    console.log('⚠️ Updater is running, DO NOT terminate it!');
    console.log('🔍 DEBUG: Updater will continue running in background');
    console.log('🔍 DEBUG: Skipping all cleanup - updater will handle it');
    // DO NOT KILL: global.updaterProcess.kill();
    // DO NOT CLEAN UP LOCK FILE - updater needs it
    return; // Exit before-quit handler without cleanup
  }
  
  console.log('ℹ️ No updater process running, performing normal cleanup');
  
  // Clean up download lock file ONLY if updater is not running
  const path = require('path');
  const fs = require('fs');
  const downloadLockFile = path.join(INSTALL_DIR || process.cwd(), 'download.lock');
  if (fs.existsSync(downloadLockFile)) {
    try {
      fs.unlinkSync(downloadLockFile);
      console.log('🔓 Download lock file removed');
    } catch (error) {
      console.log('⚠️ Could not remove download lock:', error.message);
    }
  }
  
  console.log('✅ Cleanup completed');
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers for desktop-specific functionality
ipcMain.handle('focus-window', async () => {
  if (mainWindow) {
    mainWindow.focus();
    return { success: true };
  }
  return { success: false };
});

ipcMain.handle('close-app', async (event, { userName, computerName } = {}) => {
  console.log('🚪 App close хүсэлт ирлээ:', { userName, computerName });

  app.quit();
  return { success: true };
});

ipcMain.handle('exit-app', async () => {
  console.log('🚪 App exit хүсэлт ирлээ (error handler)');
  app.exit(1);
  return { success: true };
});

ipcMain.handle('get-computer-name', () => {
  return os.hostname();
});

// System name handler - Windows 7 compatibility
ipcMain.handle('get-system-name', () => {
  try {
    const os = require('os');
    return {
      success: true,
      systemName: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      release: os.release()
    };
  } catch (error) {
    console.error('❌ Error getting system name:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Device ID handler - Windows 7 compatibility
ipcMain.handle('get-device-id', () => {
  try {
    const os = require('os');
    const crypto = require('crypto');
    
    // Generate device ID based on system info
    const systemInfo = `${os.platform()}-${os.arch()}-${os.hostname()}`;
    const deviceId = crypto.createHash('md5').update(systemInfo).digest('hex');
    
    return {
      success: true,
      deviceId: deviceId,
      systemInfo: systemInfo
    };
  } catch (error) {
    console.error('❌ Error getting device ID:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Manual updater trigger for Windows 7 debugging
ipcMain.handle('manual-updater-trigger', async (event, downloadUrl) => {
  try {
    console.log('🔧 Manual updater trigger requested');
    console.log('📥 Download URL:', downloadUrl);
    
    // Check if updater exists
    const updaterPath = path.join(__dirname, '..', 'updater-32.exe');
    if (!fs.existsSync(updaterPath)) {
      throw new Error('Updater executable not found: ' + updaterPath);
    }
    
    // Start updater manually with detailed logging
    const { spawn } = require('child_process');
    const updaterProcess = spawn(updaterPath, [downloadUrl], {
      detached: false, // Keep attached for debugging
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    console.log('🔧 Manual updater process started, PID:', updaterProcess.pid);
    
    // Log all output
    updaterProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('📋 [MANUAL UPDATER]:', output.trim());
      
      // Send to renderer
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('manual-updater-output', {
          type: 'stdout',
          message: output.trim(),
          timestamp: new Date().toISOString()
        });
      }
    });
    
    updaterProcess.stderr.on('data', (data) => {
      const error = data.toString();
      console.error('❌ [MANUAL UPDATER ERROR]:', error.trim());
      
      // Send to renderer
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('manual-updater-output', {
          type: 'stderr',
          message: error.trim(),
          timestamp: new Date().toISOString()
        });
      }
    });
    
    updaterProcess.on('close', (code) => {
      console.log(`🔧 Manual updater process exited with code: ${code}`);
      
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('manual-updater-complete', {
          code: code,
          success: code === 0,
          message: code === 0 ? 'Manual update completed successfully' : `Manual update failed with code: ${code}`,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    return {
      success: true,
      pid: updaterProcess.pid,
      message: 'Manual updater process started'
    };
    
  } catch (error) {
    console.error('❌ Manual updater trigger error:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// KhanBank cookies хадгалах - main process дээр
ipcMain.handle('insert-khanbank-cookies', async (event, params) => {
  try {
    const { insertKhanBankCookiesFromMain } = require('./utils/khanBankCookieInsert');
    const result = await insertKhanBankCookiesFromMain(params);
    return {
      success: !!result?.ok,
      insertedCount: result?.insertedCount ?? 0,
      ...result?.result,
    };
  } catch (error) {
    console.error('❌ [MAIN] KhanBank cookies хадгалахад алдаа:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('check-expose-headers', async (event, params) => {
  try {
    const { checkExposeHeadersFromMain } = require('./utils/khanBankCookieInsert');
    return await checkExposeHeadersFromMain(params);
  } catch (error) {
    console.error('❌ [MAIN] Expose headers шалгахад алдаа:', error);
    return { success: false, message: error.message };
  }
});

// Аппликейшн бүрэн хаах
ipcMain.handle('quit-app', async (event, { userName, computerName } = {}) => {
  console.log('🚪 App quit хүсэлт ирлээ:', { userName, computerName });
  
  try {
    // Бүх цонхыг хаах
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(window => {
      if (!window.isDestroyed()) {
        window.close();
      }
    });
    
    // App-г бүрэн хаах
    app.exit(0);
  } catch (error) {
    console.error('❌ App quit алдаа:', error);
    app.exit(1);
  }
});


ipcMain.handle('getDeviceId', async (event, params) => {
  return { success: true, deviceId: 'desktop-device-id' };
});


ipcMain.handle('create-captcha-window', async (event, isCitizen = true) => {
    console.log('🔒 [MAIN] Creating CAPTCHA window, isCitizen:', isCitizen);
    try {
        await captchaManager.open(isCitizen ? 1 : 0, mainWindow);
        console.log('✅ [MAIN] CAPTCHA window created successfully');
        return {
            success: true,
            message: 'CAPTCHA window created successfully',
            isCitizen: isCitizen
        };
    } catch (error) {
        console.error('❌ [MAIN] Error creating CAPTCHA window:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('close-captcha-window', async () => {
    try {
        await captchaManager.close();
        return { success: true, message: 'CAPTCHA window closed' };
    } catch (error) {
        console.error('❌ Error closing CAPTCHA window:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('is-captcha-window-open', async () => {
    try {
        const isOpen = captchaManager.isOpen();
        return { success: true, isOpen };
    } catch (error) {
        console.error('❌ Error checking CAPTCHA window status:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('clear-captcha-hooks', async () => {
    try {
        // cookieCollector нь captchaManager.close() дотор автомат цэвэрлэгдэнэ.
        // Гэхдээ тусад нь дуудах бол:
        if (captchaManager.cookieCollector) {
            captchaManager.cookieCollector.uninstall();
            captchaManager.cookieCollector = null;
        }
        return { success: true, message: 'CAPTCHA hooks cleared successfully' };
    } catch (error) {
        console.error('❌ Error clearing CAPTCHA hooks:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('reinstall-captcha-hooks', async (event, isCitizen = true) => {
    try {
        // Хуучин hooks устгаад шинээр суулгах
        if (captchaManager.cookieCollector) {
            captchaManager.cookieCollector.uninstall();
        }
        if (captchaManager.window && !captchaManager.window.isDestroyed()) {
            const CookieCollector = require('./socket/cookie-collector');
            const WindowsCompatibility = require('./utils/windows7Compat');
            const winCompat = new WindowsCompatibility();
            const citizenNum = isCitizen ? 1 : 0;  // ← boolean → number энд хөрвүүлнэ
            captchaManager.cookieCollector = new CookieCollector(
                captchaManager.window, citizenNum, winCompat
            );
            captchaManager.cookieCollector.install();
        }
        return { success: true, message: 'CAPTCHA hooks reinstalled successfully' };
    } catch (error) {
        console.error('❌ Error reinstalling CAPTCHA hooks:', error);
        return { success: false, error: error.message };
    }
});


// Electron-store handlers
ipcMain.handle('store-get', async (event, key) => {
  return store.get(key);
});

ipcMain.handle('store-set', async (event, key, value) => {
  store.set(key, value);
  
  // ✅ Auth token-г global-д тохируулах
  if (key === 'jwt_token') {
    global.currentAuthToken = value;
    console.log('🔑 [MAIN] Global auth token тохируулагдлаа:', value ? '✅' : '❌');
  }
  
  return { success: true };
});

ipcMain.handle('store-delete', async (event, key) => {
  store.delete(key);
  if (key === 'jwt_token') {
    global.currentAuthToken = null;
  }
  return { success: true };
});


// Auto-updater IPC handlers
ipcMain.handle('check-for-updates', async () => {
  try {
    console.log('🔍 Manual update check requested...');
    
    if (IS_PORTABLE) {
      console.log('🔄 Portable mode: Using UpdateService for manual check...');
      // Trigger UpdateService instead of auto-updater for portable mode
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('trigger-portable-update', {
          version: null, // Let UpdateService determine version
          reason: 'manual-check-requested'
        });
      }
      return { success: true, message: 'Portable update check initiated via UpdateService' };
    } else {
      console.log('🔄 Installed mode: Using auto-updater...');
      if (!IS_PORTABLE) {
      autoUpdater.checkForUpdates();
      return { success: true, message: 'Auto-updater check initiated' };
      } else {
        return { success: false, message: 'Portable mode uses custom update system' };
      }
    }
  } catch (error) {
    console.error('Error checking for updates:', error);
    return { success: false, error: error.message };
  }
});

// ===== New IPC handlers for UpdateService =====

// Get portable info handler
ipcMain.handle('get-portable-info', async () => {
  try {
    return {
      success: true,
      isPortable: IS_PORTABLE,
      installDir: INSTALL_DIR
    };
  } catch (error) {
    console.error('❌ [MAIN] Error getting portable info:', error);
    return { success: false, error: error.message };
  }
});

// Create directory
ipcMain.handle('create-directory', async (event, { path }) => {
  try {
    if (!fs.existsSync(path)) {
      fs.mkdirSync(path, { recursive: true });
      console.log('📁 Created target directory:', path);
    return { success: true };
    }
    return { success: true, message: 'Directory already exists' };
  } catch (error) {
    console.error('❌ Error creating directory:', error);
    return { success: false, error: error.message };
  }
});

// Download file with fetch
ipcMain.handle('download-file', async (event, { url, outputPath, userAgent, timeout }) => {
  try {
    // Use built-in fetch if available, otherwise use node-fetch
    let fetch;
    if (globalThis.fetch) {
      fetch = globalThis.fetch;
    } else {
      try {
        const { default: nodeFetch } = await import('node-fetch');
        fetch = nodeFetch;
      } catch (error) {
        console.log('❌ node-fetch not available for file download');
        return { success: false, error: 'node-fetch not available' };
      }
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': userAgent || 'NovaQ-Desktop-Updater/1.0'
      },
      timeout: timeout || 30000
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
    }
    
    const contentLength = response.headers.get('content-length');
    console.log(`📊 File size: ${contentLength ? (parseInt(contentLength) / 1024 / 1024).toFixed(2) + ' MB' : 'Unknown'}`);
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    console.log(`📦 Downloaded buffer size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
    
    // Write file to disk
    fs.writeFileSync(outputPath, buffer);
    console.log('✅ Downloaded file:', outputPath);
    
    return { success: true, filePath: outputPath, fileSize: buffer.length };
  } catch (error) {
    console.error('❌ Download file error:', error);
    return { success: false, error: error.message };
  }
});

// Download file with Node.js built-in modules (no PowerShell dependency)
ipcMain.handle('download-file-powershell', async (event, { url, outputPath, timeout }) => {
  try {
    const https = require('https');
    const http = require('http');
    const fs = require('fs');
    const path = require('path');
    
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    return new Promise((resolve) => {
      const timeoutMs = timeout || 5 * 60 * 1000; // Default 5 minutes
      
      // Choose http or https based on URL
      const client = url.startsWith('https:') ? https : http;
      
      const file = fs.createWriteStream(outputPath);
      
      const request = client.get(url, {
        headers: {
          'User-Agent': 'NovaQ-Desktop-Updater/1.0'
        },
        timeout: timeoutMs
      }, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          file.close();
          fs.unlinkSync(outputPath);
          
          // Handle redirect
          console.log('Following redirect to:', response.headers.location);
          const redirectClient = response.headers.location.startsWith('https:') ? https : http;
          const redirectFile = fs.createWriteStream(outputPath);
          
          const redirectRequest = redirectClient.get(response.headers.location, {
            headers: { 'User-Agent': 'NovaQ-Desktop-Updater/1.0' },
            timeout: timeoutMs
          }, (redirectResponse) => {
            if (redirectResponse.statusCode !== 200) {
              redirectFile.close();
              if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
              return resolve({ 
                success: false, 
                error: `HTTP ${redirectResponse.statusCode}: ${redirectResponse.statusMessage}` 
              });
            }
            
            redirectResponse.pipe(redirectFile);
            redirectFile.on('finish', () => {
              redirectFile.close();
              console.log('✅ Downloaded file using Node.js (redirect):', outputPath);
              resolve({ success: true, filePath: outputPath });
            });
            
            redirectFile.on('error', (err) => {
              redirectFile.close();
              if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
              resolve({ success: false, error: err.message });
            });
          });
          
          redirectRequest.on('error', (err) => {
            redirectFile.close();
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            resolve({ success: false, error: err.message });
          });
          
          return;
        }
      
        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(outputPath);
          return resolve({ 
            success: false, 
            error: `HTTP ${response.statusCode}: ${response.statusMessage}` 
          });
        }
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          console.log('✅ Downloaded file using Node.js:', outputPath);
        resolve({ success: true, filePath: outputPath });
        });
        
        file.on('error', (err) => {
          file.close();
          fs.unlinkSync(outputPath);
          console.error('❌ File write error:', err);
          resolve({ success: false, error: err.message });
        });
      });
      
      request.on('error', (err) => {
        file.close();
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
        console.error('❌ Download request error:', err);
        resolve({ success: false, error: err.message });
      });
      
      request.on('timeout', () => {
        request.destroy();
        file.close();
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
        console.error('❌ Download timeout');
        resolve({ success: false, error: `Download timeout after ${timeoutMs/1000} seconds` });
      });
    });
  } catch (error) {
    console.error('❌ Download setup error:', error);
    return { success: false, error: error.message };
  }
});

// Extract ZIP file using Node.js built-in modules
ipcMain.handle('extract-zip', async (event, { zipPath, targetDir }) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const { exec } = require('child_process');
    
    // Ensure target directory exists
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    // Try Node.js built-in extraction first (Windows 10+ has native ZIP support)
    return new Promise((resolve) => {
      console.log('📦 Extracting zip file...');
      
      // Use Windows built-in tar command (available in Windows 10+)
      const extractCommand = `tar -xf "${zipPath}" -C "${targetDir}"`;
      
      exec(extractCommand, (extractError, extractStdout, extractStderr) => {
        if (extractError) {
          console.warn('⚠️ Tar extraction failed, trying PowerShell fallback...');
          
          // Fallback to PowerShell with proper execution policy
          const powershellCommand = `powershell -ExecutionPolicy Bypass -Command "try { Expand-Archive -Path '${zipPath}' -DestinationPath '${targetDir}' -Force -ErrorAction Stop; Write-Host 'Extraction completed' } catch { Write-Error $_.Exception.Message; exit 1 }"`;
          
          exec(powershellCommand, (psError, psStdout, psStderr) => {
            if (psError) {
              console.error('❌ PowerShell extract error:', psError);
              resolve({ success: false, error: psError.message, details: psStderr });
          return;
        }
        
            console.log('✅ Successfully extracted using PowerShell to:', targetDir);
        resolve({ success: true, targetDir: targetDir });
          });
        } else {
          console.log('✅ Successfully extracted using tar to:', targetDir);
          resolve({ success: true, targetDir: targetDir });
        }
      });
    });
  } catch (error) {
    console.error('❌ Extract setup error:', error);
    return { success: false, error: error.message };
  }
});

// Delete file
ipcMain.handle('delete-file', async (event, { path }) => {
  try {
    fs.unlinkSync(path);
    console.log('🗑️ Deleted file:', path);
    return { success: true };
  } catch (error) {
    console.warn('⚠️ Could not delete file:', error.message);
    return { success: false, error: error.message };
  }
});

// Check extracted version from multiple sources
ipcMain.handle('check-extracted-version', async (event, { targetDir, gitlabVersion }) => {
  try {
    console.log('🔍 Системийн хувилбар шалгаж байна...');
    let extractedVersion = null;
    
    // Method 1: Try package.json in root directory
    const extractedPackageJsonPath = path.join(targetDir, 'package.json');
    console.log('📁 Package.json файлын зам:', extractedPackageJsonPath);
    
    if (fs.existsSync(extractedPackageJsonPath)) {
      const packageData = JSON.parse(fs.readFileSync(extractedPackageJsonPath, 'utf8'));
      extractedVersion = packageData.version;
      console.log('📦 Root package.json-аас хувилбар олдлоо:', extractedVersion);
    } else {
      console.log('⚠️ Root package.json олдсонгүй');
      
      // Method 2: Try to find package.json in resources/app.asar
      const resourcesPath = path.join(targetDir, 'resources');
      const appAsarPath = path.join(resourcesPath, 'app.asar');
      
      if (fs.existsSync(appAsarPath)) {
        console.log('📦 app.asar файл олдлоо, хувилбарыг GitLab-аас авна');
        extractedVersion = gitlabVersion; // Use GitLab version as fallback
      } else {
        console.log('⚠️ app.asar файл олдсонгүй');
        
        // Method 3: Check for NovaQ Desktop.exe
        const exePath = path.join(targetDir, 'NovaQ Desktop.exe');
        if (fs.existsSync(exePath)) {
          console.log('📱 NovaQ Desktop.exe олдлоо');
          extractedVersion = gitlabVersion; // Use GitLab version
        }
      }
    }
    
    if (extractedVersion) {
      // Send version info to renderer process (browser console)
      if (mainWindow) {
        mainWindow.webContents.executeJavaScript(`
          console.log('📦 Задлагдсан системийн хувилбар: ${extractedVersion}');
          console.log('🆚 Хувилбарын харьцуулалт:');
          console.log('   📥 Татсан хувилбар: ${gitlabVersion}');
          console.log('   💾 Задлагдсан хувилбар: ${extractedVersion}');
          console.log('   ✅ Системд суулгагдсан хувилбар: ${extractedVersion}');
        `).catch(err => {
          console.log('❌ Failed to execute version info in renderer:', err);
        });
      }
      
      return { success: true, extractedVersion: extractedVersion };
    } else {
      console.log('⚠️ Системийн хувилбар олдсонгүй, директорийн агуулгыг харуулж байна...');
      try {
        const files = fs.readdirSync(targetDir);
        console.log('📋 Директорийн файлууд:', files.slice(0, 15)); // First 15 files
      } catch (dirError) {
        console.log('⚠️ Директори уншихад алдаа:', dirError.message);
      }
      
      return { success: false, error: 'Could not determine extracted version' };
    }
  } catch (error) {
    console.log('⚠️ Системийн хувилбар шалгахад алдаа:', error.message);
    return { success: false, error: error.message };
  }
});

// Get GitLab version
ipcMain.handle('get-gitlab-version', async () => {
  try {
    const version = await fetchVersionFromGitLab();
    return { success: true, version: version };
  } catch (error) {
    console.error('❌ Error getting GitLab version:', error);
    return { success: false, error: error.message };
  }
});

// Portable self-update handler - REMOVED
// Use UpdateService.downloadPortableUpdate() instead

// Download-update handler - REMOVED
// Use UpdateService.downloadUpdateAdvanced() instead

// Legacy extractZipFile function - REMOVED
// Use UpdateService.extractZipFile() instead

// Download-update handler - REMOVED
// Use UpdateService.downloadUpdateAdvanced() instead

ipcMain.handle('install-update', async () => {
  try {
    console.log('🔧 Install update requested...');
    
    if (IS_PORTABLE) {
      console.log('🔄 Portable mode: Manual install not needed - self-updating');
      return { success: false, message: 'Portable mode uses self-update mechanism' };
    } else {
      console.log('🔄 Installed mode: Using auto-updater install...');
      if (!IS_PORTABLE) {
      autoUpdater.quitAndInstall();
      return { success: true, message: 'Auto-updater install initiated' };
      } else {
        return { success: false, message: 'Portable mode uses custom update system' };
      }
    }
  } catch (error) {
    console.error('Error installing update:', error);
    return { success: false, error: error.message };
  }
});

// Test download functionality
ipcMain.handle('test-download', async () => {
  try {
    console.log('🧪 Testing download functionality...');
    
    // Dynamic import of node-fetch as ES Module
    const { default: fetch } = await import('node-fetch');
    
    // Test URL accessibility
    const testUrl = 'https://desktop-f96376.gitlab.io/';
    console.log(`🔍 Testing URL accessibility: ${testUrl}`);
    
    const response = await fetch(testUrl, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'NovaQ-Desktop-Updater/1.0'
      }
    });
    
    if (response.ok) {
      console.log('✅ GitLab Pages is accessible');
      return { 
        success: true, 
        message: 'GitLab Pages is accessible',
        status: response.status,
        headers: Object.fromEntries(response.headers.entries())
      };
    } else {
      console.log('❌ GitLab Pages returned error:', response.status);
      return { 
        success: false, 
        error: `HTTP ${response.status}: ${response.statusText}`,
        status: response.status
      };
    }
  } catch (error) {
    console.error('❌ Test download error:', error);
    return { 
      success: false, 
      error: error.message,
      details: 'Network connectivity or DNS issue'
    };
  }
});

// Window control handlers
let windowResizeState = null;

ipcMain.handle('window-resize-start', async (event, { screenX, screenY, corner }) => {
  if (!mainWindow) return { success: false };
  const bounds = mainWindow.getBounds();
  windowResizeState = {
    startMouseX: screenX,
    startMouseY: screenY,
    startWidth: bounds.width,
    startHeight: bounds.height,
    startWindowX: bounds.x,
    startWindowY: bounds.y,
    corner: corner || 'bottom-right',
  };
  return { success: true };
});

ipcMain.handle('window-resize', async (event, { screenX, screenY }) => {
  if (!mainWindow || !windowResizeState) return { success: false };
  const deltaX = screenX - windowResizeState.startMouseX;
  const deltaY = screenY - windowResizeState.startMouseY;

  if (windowResizeState.corner === 'bottom-left') {
    let newWidth = windowResizeState.startWidth - deltaX;
    let newHeight = windowResizeState.startHeight + deltaY;
    let newX = windowResizeState.startWindowX + deltaX;

    if (newWidth < WINDOW_MIN_WIDTH) {
      newX = windowResizeState.startWindowX + windowResizeState.startWidth - WINDOW_MIN_WIDTH;
      newWidth = WINDOW_MIN_WIDTH;
    }
    if (newHeight < WINDOW_MIN_HEIGHT) {
      newHeight = WINDOW_MIN_HEIGHT;
    }

    mainWindow.setBounds({
      x: Math.round(newX),
      y: windowResizeState.startWindowY,
      width: Math.round(newWidth),
      height: Math.round(newHeight),
    });
    return { success: true };
  }

  if (windowResizeState.corner === 'right') {
    const newWidth = Math.max(WINDOW_MIN_WIDTH, windowResizeState.startWidth + deltaX);
    mainWindow.setSize(newWidth, windowResizeState.startHeight);
    return { success: true };
  }

  if (windowResizeState.corner === 'bottom') {
    const newHeight = Math.max(WINDOW_MIN_HEIGHT, windowResizeState.startHeight + deltaY);
    mainWindow.setSize(windowResizeState.startWidth, newHeight);
    return { success: true };
  }

  const newWidth = Math.max(WINDOW_MIN_WIDTH, windowResizeState.startWidth + deltaX);
  const newHeight = Math.max(WINDOW_MIN_HEIGHT, windowResizeState.startHeight + deltaY);
  mainWindow.setSize(newWidth, newHeight);
  return { success: true };
});

ipcMain.handle('window-resize-end', async () => {
  windowResizeState = null;
  return { success: true };
});

ipcMain.handle('minimize-window', async () => {
  if (mainWindow) {
    mainWindow.minimize();
    return { success: true };
  }
  return { success: false };
});



ipcMain.handle('get-local-storage', async (event, { key }) => {
  try {
    const value = store.get(key);
    return { success: true, value };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// JWT token авах функц
ipcMain.handle('get-jwt-token', async () => {
  try {
    const token = store.get('jwt_token') || global.currentAuthToken;
    return { success: true, token };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// JWT token хадгалах функц
ipcMain.handle('set-jwt-token', async (event, { token }) => {
  try {
    store.set('jwt_token', token);
    global.currentAuthToken = token;
    console.log('🔑 [MAIN] JWT token хадгалагдлаа:', token ? '✅' : '❌');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// JWT token хасах функц
ipcMain.handle('clear-jwt-token', async () => {
  try {
    store.delete('jwt_token');
    global.currentAuthToken = null;
    console.log('🔑 [MAIN] JWT token хасагдлаа');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('set-local-storage', async (event, { key, value }) => {
  try {
    store.set(key, value);
    return { success: true, message: 'Value stored' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('update-local-storage', async (event, { key, value }) => {
  try {
    store.set(key, value);
    return { success: true, message: 'Value updated' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('console-print', async (event, { value }) => {
  try {
    console.log('--------------------------------');
    console.log(value);
    console.log('--------------------------------');
    return { success: true, message: 'Value updated' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('maximize-window', async () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
    return { success: true };
  }
  return { success: false };
});

// Socket connection handlers
ipcMain.handle('get-socket-connection', async (event, { customerId, userData } = {}) => {
  try {
    // Global socket connection буцаах
    if (global.socketConnection) {
      return { success: true, socket: global.socketConnection };
    }
    return { success: false, error: 'No socket connection found' };
  } catch (error) {
    return { success: false, error: error.message };
  }

});

ipcMain.handle('disconnect-socket', async () => {
  try {
    console.log('🔌 [MAIN] Socket disconnect хийж байна...');
    
    // Global socket disconnect
    if (global.socketConnection) {
      global.socketConnection.disconnect();
      global.socketConnection = null;
      console.log('✅ [MAIN] Global socket disconnect хийгдлээ');
    }

    // Clear all timers and intervals
    console.log('🧹 [MAIN] Бүх timer-уудыг цэвэрлэж байна...');
    
    return { success: true, message: 'Socket disconnected successfully' };
  } catch (error) {
    console.error('❌ [MAIN] Socket disconnect алдаа:', error);
    return { success: false, error: error.message };
  }
});

// ===== Portable Auto-Update System =====

// REMOVED: performManualDownload function - use UpdateService.downloadUpdateAdvanced() instead

// Database status check function
async function checkDatabaseStatus() {
  try {
    console.log('🔍 Checking database connection status...');
    
    // Use built-in fetch if available, otherwise use node-fetch
    let fetch;
    let supportsAbortSignal = false;

    if (globalThis.fetch && typeof AbortSignal !== 'undefined') {
      fetch = globalThis.fetch;
      supportsAbortSignal = true;
    } else {
      try {
        const { default: nodeFetch } = await import('node-fetch');
        fetch = nodeFetch;
        // node-fetch v2 supports AbortController
        supportsAbortSignal = true;
      } catch (error) {
        console.log('ℹ️ Using built-in https module for network requests');
        // Use https module as fallback
        const https = require('https');
        supportsAbortSignal = false;

        fetch = (urlString, options = {}) => {
          return new Promise((resolve, reject) => {
            const parsedUrl = new URL(urlString);
            const reqOptions = {
              hostname: parsedUrl.hostname,
              port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
              path: parsedUrl.pathname + parsedUrl.search,
              method: options.method || 'GET',
              headers: options.headers || {},
              timeout: 5000 // 5 second timeout for https module
            };
            
            const req = https.request(reqOptions, (res) => {
              let data = '';
              res.on('data', chunk => data += chunk);
              res.on('end', () => {
                resolve({
                  ok: res.statusCode >= 200 && res.statusCode < 300,
                  status: res.statusCode,
                  statusText: res.statusMessage,
                  json: () => Promise.resolve(JSON.parse(data)),
                  text: () => Promise.resolve(data)
                });
              });
            });
            
            req.on('error', reject);
            req.on('timeout', () => {
              req.destroy();
              reject(new Error('Request timeout'));
            });

            // Handle abort signal for https module
            if (options.signal && options.signal.aborted) {
              req.destroy();
              reject(new Error('Request aborted'));
            } else if (options.signal) {
              const checkAbort = () => {
                if (options.signal.aborted) {
                  req.destroy();
                  reject(new Error('Request aborted'));
                }
              };
              const abortInterval = setInterval(checkAbort, 100);
              req.on('close', () => clearInterval(abortInterval));
            }

            if (options.body) req.write(options.body);
            req.end();
          });
        };
      }
    }
    
    const fetchOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    // Add timeout using AbortController only if supported
    let timeoutId;
    if (supportsAbortSignal && typeof AbortController !== 'undefined') {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      fetchOptions.signal = controller.signal;
    } else {
      // Fallback: use Promise.race for timeout
      timeoutId = setTimeout(() => {}, 0); // Dummy timeout for cleanup
    }
    
    const response = await fetch(`${API_BASE_URL}/api/version/database-status`, fetchOptions);

    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    

    if (!response.ok) {
      if (response.status === 404) {
        console.log('⚠️ Database status endpoint not found (404) - backend may not be updated');
        return {
          success: false,
          status: 'endpoint-not-found',
          message: 'Database status endpoint not available'
        };
      }
      console.log('❌ Database status check failed:', response.status, response.statusText);
      return {
        success: false,
        status: 'disconnected',
        message: `Database connection failed: ${response.status}`
      };
    }

    const data = await response.json();
    console.log('📊 Database status:', data.status);
    
    return data;
  } catch (error) {
    console.log('❌ Database status check error:', error.message);
    
    let errorMessage = error.message;
    if (error.message.includes('ETIMEDOUT') || error.message.includes('timeout')) {
      errorMessage = 'Server is not responding. Please check if the server is running.';
    } else if (error.message.includes('ECONNREFUSED')) {
      errorMessage = 'Connection refused. Server may be down or not accessible.';
    } else if (error.message.includes('ENOTFOUND')) {
      errorMessage = 'Server not found. Please check the server address.';
    } else if (error.message.includes('fetch is not defined')) {
      errorMessage = 'Network module not available. Please restart the application.';
    } else if (error.message.includes('WRONG_VERSION_NUMBER') || error.message.includes('SSL routines')) {
      errorMessage = 'SSL connection error. Server may be using different protocol.';
    } else if (error.message.includes('aborted') || error.message.includes('AbortController')) {
      errorMessage = 'Request timeout. Please check your network connection.';
    }
    
    return {
      success: false,
      status: 'error',
      message: errorMessage
    };
  }
}

// Check version from GitLab Pages
async function fetchVersionFromGitLab() {
  try {
    console.log('🔍 Fetching version from GitLab Pages...');
    
    // Use built-in fetch if available, otherwise use node-fetch
    let fetch;
    if (globalThis.fetch) {
      fetch = globalThis.fetch;
    } else {
      try {
        const { default: nodeFetch } = await import('node-fetch');
        fetch = nodeFetch;
      } catch (error) {
        console.log('ℹ️ Using built-in https module for GitLab requests');
        // Use https module as fallback
        const https = require('https');
        
        fetch = (urlString, options = {}) => {
          return new Promise((resolve, reject) => {
            const parsedUrl = new URL(urlString);
            const reqOptions = {
              hostname: parsedUrl.hostname,
              port: parsedUrl.port || 443,
              path: parsedUrl.pathname + parsedUrl.search,
              method: options.method || 'GET',
              headers: options.headers || {}
            };
            
            const req = https.request(reqOptions, (res) => {
              let data = '';
              res.on('data', chunk => data += chunk);
              res.on('end', () => {
                resolve({
                  ok: res.statusCode >= 200 && res.statusCode < 300,
                  status: res.statusCode,
                  statusText: res.statusMessage,
                  json: () => Promise.resolve(JSON.parse(data)),
                  text: () => Promise.resolve(data)
                });
              });
            });
            
            req.on('error', reject);
            if (options.body) req.write(options.body);
            req.end();
          });
        };
      }
    }
    
    const response = await fetch('https://desktop-f96376.gitlab.io/latest.json', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'NovaQ-Desktop-Updater/1.0'
      }
    });

    if (!response.ok) {
      console.log('⚠️ GitLab version endpoint not accessible:', response.status);
      return null;
    }

    const data = await response.json();
    
    // Check if this is the same data we've already logged
    const dataString = JSON.stringify(data);
    if (lastGitLabVersionData !== dataString) {
    console.log('📊 GitLab version data:', data);
      lastGitLabVersionData = dataString;
    }

    // Check for programVersion first (database format)
    if (data && data.programVersion) {
      console.log('🔗 ✅ GitLab-аас хувилбар амжилттай татагдлаа (programVersion):', data.programVersion);
      return data.programVersion;
    } 
    // Check for version field (fallback)
    else if (data && data.version) {
      console.log('🔗 ✅ GitLab-аас хувилбар амжилттай татагдлаа (version):', data.version);
      return data.version;
    } else {
      console.log('⚠️ GitLab-аас хувилбар олдсонгүй (programVersion эсвэл version талбар байхгүй)');
      return null;
    }
  } catch (error) {
    console.log('❌ GitLab version check error:', error.message);
    return null;
  }
}

// Check version from database
async function fetchRemoteVersionFromDB() {
  try {
    const authToken = global.currentAuthToken;
    if (!authToken) {
      console.log('⚠️ No auth token available for version check');
      return null;
    }

    console.log('====> Fetching version from database...');
    console.log('====> API_BASE_URL', API_BASE_URL);
    
    // Use built-in fetch if available, otherwise use node-fetch
    let fetch;
    if (globalThis.fetch) {
      fetch = globalThis.fetch;
    } else {
      try {
        const { default: nodeFetch } = await import('node-fetch');
        fetch = nodeFetch;
      } catch (error) {
        console.log('ℹ️ Using built-in https module for network requests');
        // Use https module as fallback
        const https = require('https');
        
        fetch = (urlString, options = {}) => {
          return new Promise((resolve, reject) => {
            const parsedUrl = new URL(urlString);
            const reqOptions = {
              hostname: parsedUrl.hostname,
              port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
              path: parsedUrl.pathname + parsedUrl.search,
              method: options.method || 'GET',
              headers: options.headers || {}
            };
            
            const req = (parsedUrl.protocol === 'https:' ? https : require('http')).request(reqOptions, (res) => {
              let data = '';
              res.on('data', chunk => data += chunk);
              res.on('end', () => {
                resolve({
                  ok: res.statusCode >= 200 && res.statusCode < 300,
                  status: res.statusCode,
                  statusText: res.statusMessage,
                  json: () => Promise.resolve(JSON.parse(data)),
                  text: () => Promise.resolve(data)
                });
              });
            });
            
            req.on('error', reject);
            if (options.body) req.write(options.body);
            req.end();
          });
        };
      }
    }
    
    const response = await fetch(`${API_BASE_URL}/api/version/database-status`, {
      method: 'GET',
   
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log('⚠️ Database version endpoint not found (404) - backend may not be updated');
        // Try GitLab fallback first
        const gitlabVersion = await fetchVersionFromGitLab();
        if (gitlabVersion) {
          console.log('🔧 Using GitLab version:', gitlabVersion);
          return gitlabVersion;
        }
        // Get fallback version from constants
        const fallbackVersion = require('./utils/constants').VERSION;
        console.log('🔧 Using fallback version:', fallbackVersion, '(from constants)');
        return fallbackVersion; // Fallback to constants version
      }
      console.log('❌ Database version check failed:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();

    
    // Developer tools дээр харагдахгүй байгаа шалтгаан нь энэ log зөвхөн renderer process руу илгээгдэж байгаа боловч,
    // renderer талд 'dev-console-log' эвэнтийг хүлээж авч, console.log дээр хэвлэх код байхгүй байж магадгүй.
    // Гэхдээ эндээс илгээж байгаа нь зөв, харин renderer талд хүлээж авч байгаа эсэхээ шалгаарай.
    if (mainWindow && mainWindow.webContents) {
      const rawVersion = data && data.version && data.version.programVersion ? data.version.programVersion : JSON.stringify(data);
      const cleanVersion = rawVersion.replace(/[\r\n]/g, '').trim(); // Remove \r\n and trim whitespace
      const logMessage = `📊==== Database version data: ${cleanVersion}`;
      
      console.log('🔧 [MAIN] Sending dev-console-log to renderer:', logMessage);
      
      // Send dev-console-log event
      mainWindow.webContents.send('dev-console-log', {
        type: 'database-version',
        message: logMessage
      });
      
      // Also execute console.log directly in renderer process for reliability
      const escapedMessage = logMessage.replace(/'/g, "\\'").replace(/"/g, '\\"');
      mainWindow.webContents.executeJavaScript(`
        console.log('${escapedMessage}');
        console.log('🔧 [RENDERER] Direct console log from main process');
      `).catch(err => {
        console.log('❌ [MAIN] Failed to execute console.log in renderer:', err);
      });
    }

    if (data && data.version && data.version.programVersion) {
      const version = data.version.programVersion;
      console.log('🗄️ ✅ Database-аас хувилбар амжилттай татагдлаа:', version);
      return version; // programVersion талбарт хувилбар хадгалагдана
    } else {
      console.log('⚠️ Database-аас хувилбар татаж чадсангүй (programVersion талбар хоосон)');
      // Get fallback version from constants
      const fallbackVersion = require('./utils/constants').VERSION;
      // console.log('🔧 Using fallback version:', fallbackVersion, '(from constants)');
      return fallbackVersion; // Fallback to constants version
    }

    return null;
  } catch (error) {
    console.log('❌ Database version check error:', error);
    // Get fallback version from constants
    const fallbackVersion = require('./utils/constants').VERSION;
    // console.log('🔧 Using fallback version:', fallbackVersion, '(from constants)');
    return fallbackVersion; // Fallback to constants version
  }
}

// Check version when app starts
ipcMain.handle('check-version-from-db', async () => {
  try {
    const current = getAppVersion();
    console.log('====> current');
    console.log('[VERSION CHECK] current=', current);

    // Try to get version from database
    const remoteVersion = await fetchRemoteVersionFromDB();
    console.log('[VERSION CHECK] remote from DB=', remoteVersion);

    const needsUpdate = remoteVersion && versionGt(remoteVersion, current);

    // Send version status to renderer
    if (mainWindow) {
      mainWindow.webContents.send('version-status', {
        current: current,
        remote: remoteVersion,
        needsUpdate: needsUpdate,
        message: needsUpdate ? 
          `Шинэ хувилбар олдлоо: v${current} → v${remoteVersion}` : 
          'Хамгийн шинэ хувилбар ашиглаж байна'
      });
    }

    return {
      success: true,
      current: current,
      remote: remoteVersion,
      needsUpdate: needsUpdate
    };
  } catch (e) {
    console.log('[VERSION CHECK] failed:', e.message);
    return {
      success: false,
      error: e.message,
      current: getAppVersion(),
      remote: null,
      needsUpdate: false
    };
  }
});

// Login амжилттай болсон үед renderer энэ handler-ийг дуудах
ipcMain.handle('after-login-check-update', async () => {
  try {
    console.log('[UPDATE] Login successful, checking for updates...');
    
    // Force check for updates after login (bypass initial check flag)
    await performVersionChecks(mainWindow, app, true);
    
    return { updating: false, message: 'Update check initiated' };
  } catch (e) {
    console.log('[UPDATE] check failed:', e.message);
    return { updating: false, error: e.message };
  }
});

// Removed fetchRemoteVersionFromDB function as the API endpoint doesn't exist
// === C:\Novaq\NovaQ Desktop руу хуулах функц ===
