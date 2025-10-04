/**
 * Windows Compatibility Utilities
 * Handles compatibility issues across all Windows versions (7, 8, 10, 11)
 * with special focus on Windows 7 compatibility
 */

const { BrowserWindow, session } = require('electron');
const path = require('path');

class WindowsCompatibility {
    constructor() {
        this.windowsVersion = this.detectWindowsVersion();
        this.isWindows7 = this.windowsVersion === '7';
        this.isLegacyWindows = this.windowsVersion === '7' || this.windowsVersion === '8';
        this.retryCount = 0;
        this.maxRetries = 3;
    }

    /**
     * Detect Windows version
     */
    detectWindowsVersion() {
        if (process.platform !== 'win32') return null;
        
        try {
            const systemVersion = process.getSystemVersion();
            if (systemVersion.startsWith('6.1')) return '7';
            if (systemVersion.startsWith('6.2') || systemVersion.startsWith('6.3')) return '8';
            if (systemVersion.startsWith('10.0')) return '10';
            if (systemVersion.startsWith('11.0')) return '11';
            return 'unknown';
        } catch (error) {
            console.warn('⚠️ Could not detect Windows version:', error);
            return 'unknown';
        }
    }

    /**
     * Get Windows compatible web preferences
     */
    getCompatibleWebPreferences() {
        const basePreferences = {
            contextIsolation: false,
            nodeIntegration: true,
            sandbox: false,
            enableRemoteModule: true
        };

        if (this.isLegacyWindows) {
            // Windows 7/8 specific settings - more aggressive compatibility
            return {
                ...basePreferences,
                webSecurity: false, // Disabled for legacy Windows compatibility
                experimentalFeatures: false,
                backgroundThrottling: false,
                offscreen: false,
                nodeIntegrationInWorker: false,
                nodeIntegrationInSubFrames: false,
                allowRunningInsecureContent: true,
                experimentalCanvasFeatures: false,
                webgl: false,
                // Additional Windows 7 fixes
                disableWebSecurity: true,
                allowRunningInsecureContent: true,
                experimentalFeatures: false,
                backgroundThrottling: false,
                // Network and protocol fixes
                partition: 'persist:captcha-session-windows7',
                cache: true
            };
        } else {
            // Modern Windows (10/11) settings
            return {
                ...basePreferences,
                webSecurity: true,
                experimentalFeatures: true,
                backgroundThrottling: true,
                allowRunningInsecureContent: false
            };
        }
    }

    /**
     * Get Windows compatible browser window options
     */
    getCompatibleWindowOptions() {
        if (this.isLegacyWindows) {
            // Windows 7/8 specific settings
            return {
                transparent: false,
                hasShadow: false,
                thickFrame: true,
                skipTaskbar: false,
                alwaysOnTop: false,
                frame: true,
                titleBarStyle: 'default',
                resizable: true,
                maximizable: true,
                minimizable: true
            };
        } else {
            // Modern Windows (10/11) settings
            return {
                transparent: false,
                hasShadow: true,
                thickFrame: false,
                skipTaskbar: false,
                alwaysOnTop: false,
                frame: true,
                titleBarStyle: 'default',
                resizable: true,
                maximizable: true,
                minimizable: true
            };
        }
    }

    /**
     * Get appropriate User Agent for Windows
     */
    getCompatibleUserAgent() {
        const chromeVersion = '120';
        const webkitVersion = '537.36';
        
        switch (this.windowsVersion) {
            case '7':
                return `Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/${webkitVersion} (KHTML, like Gecko) Chrome/${chromeVersion} Safari/${webkitVersion}`;
            case '8':
                return `Mozilla/5.0 (Windows NT 6.2; WOW64) AppleWebKit/${webkitVersion} (KHTML, like Gecko) Chrome/${chromeVersion} Safari/${webkitVersion}`;
            case '10':
                return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/${webkitVersion} (KHTML, like Gecko) Chrome/${chromeVersion} Safari/${webkitVersion}`;
            case '11':
                return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/${webkitVersion} (KHTML, like Gecko) Chrome/${chromeVersion} Safari/${webkitVersion}`;
            default:
                return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/${webkitVersion} (KHTML, like Gecko) Chrome/${chromeVersion} Safari/${webkitVersion}`;
        }
    }

    /**
     * Enhanced loading with Windows retry mechanism
     */
    async loadURLWithRetry(webContents, url, maxRetries = 3) {
        if (!this.isLegacyWindows) {
            return await webContents.loadURL(url);
        }

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🔍 Windows ${this.windowsVersion} CAPTCHA load attempt ${attempt}/${maxRetries}: ${url}`);
                
                // Add delay for legacy Windows
                if (attempt > 1) {
                    const delay = this.isWindows7 ? 3000 * attempt : 2000 * attempt;
                    console.log(`⏰ Waiting ${delay}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }

                // Windows 7 specific: Clear any existing content first
                if (this.isWindows7 && attempt > 1) {
                    try {
                        await webContents.executeJavaScript('document.body.innerHTML = "";');
                        await new Promise(resolve => setTimeout(resolve, 500));
                    } catch (clearError) {
                        console.warn('⚠️ Could not clear content before retry:', clearError);
                    }
                }

                await webContents.loadURL(url);
                console.log(`✅ Windows ${this.windowsVersion} CAPTCHA loaded successfully on attempt ${attempt}`);
                return true;
            } catch (error) {
                console.error(`❌ Windows ${this.windowsVersion} CAPTCHA load attempt ${attempt} failed:`, error);
                
                // Windows 7 specific error handling
                if (this.isWindows7 && error.message && error.message.includes('net::ERR_')) {
                    console.log(`🔧 Windows 7 network error detected: ${error.message}`);
                }
                
                if (attempt === maxRetries) {
                    console.error(`❌ All Windows ${this.windowsVersion} CAPTCHA load attempts failed`);
                    throw error;
                }
            }
        }
    }

    /**
     * Setup Windows specific event listeners
     */
    setupWindowsEventListeners(window) {
        if (!this.isLegacyWindows) return;

        console.log(`🔧 Setting up Windows ${this.windowsVersion} specific event listeners`);

        // Enhanced error handling for legacy Windows
        window.webContents.on('crashed', () => {
            console.error(`❌ Windows ${this.windowsVersion} CAPTCHA window crashed`);
            this.handleWindowsCrash(window);
        });

        window.webContents.on('unresponsive', () => {
            console.warn(`⚠️ Windows ${this.windowsVersion} CAPTCHA window unresponsive`);
            this.handleWindowsUnresponsive(window);
        });

        window.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
            console.error(`❌ Windows ${this.windowsVersion} CAPTCHA load failed:`, errorCode, errorDescription);
            this.handleWindowsLoadFailure(window, errorCode, validatedURL);
        });

        window.webContents.on('did-finish-load', () => {
            console.log(`✅ Windows ${this.windowsVersion} CAPTCHA page finished loading`);
        });
    }

    /**
     * Handle Windows crash recovery
     */
    handleWindowsCrash(window) {
        if (this.retryCount >= this.maxRetries) {
            console.error(`❌ Maximum retry attempts reached for Windows ${this.windowsVersion}`);
            return;
        }

        this.retryCount++;
        console.log(`🔄 Windows ${this.windowsVersion} crash recovery attempt ${this.retryCount}`);

        setTimeout(() => {
            try {
                window.reload();
                console.log(`✅ Windows ${this.windowsVersion} window reloaded after crash`);
            } catch (error) {
                console.error(`❌ Failed to reload Windows ${this.windowsVersion} window:`, error);
            }
        }, 2000);
    }

    /**
     * Handle Windows unresponsive recovery
     */
    handleWindowsUnresponsive(window) {
        console.log(`🔄 Handling Windows ${this.windowsVersion} unresponsive window`);

        setTimeout(() => {
            try {
                window.webContents.stop();
                window.reload();
                console.log(`✅ Windows ${this.windowsVersion} window stopped and reloaded`);
            } catch (error) {
                console.error(`❌ Failed to handle Windows ${this.windowsVersion} unresponsive window:`, error);
            }
        }, 5000);
    }

    /**
     * Handle Windows load failure
     */
    handleWindowsLoadFailure(window, errorCode, url) {
        if (errorCode === -2 || errorCode === -3) { // Network or timeout errors
            console.log(`🔄 Windows ${this.windowsVersion} network error - attempting retry`);
            setTimeout(() => {
                try {
                    window.loadURL(url);
                } catch (error) {
                    console.error(`❌ Windows ${this.windowsVersion} retry failed:`, error);
                }
            }, 3000);
        }
    }

    /**
     * Get Windows compatible session settings
     */
    getCompatibleSessionSettings() {
        if (!this.isLegacyWindows) return {};

        return {
            userAgent: this.getCompatibleUserAgent(),
            // Legacy Windows specific session settings
            cache: true,
            partition: 'persist:captcha-session'
        };
    }

    /**
     * Apply Windows compatibility fixes to session
     */
    applySessionFixes() {
        if (!this.isLegacyWindows) return;

        console.log(`🔧 Applying Windows ${this.windowsVersion} session compatibility fixes`);

        try {
            const defaultSession = session.defaultSession;
            
            // Disable hardware acceleration for legacy Windows
            defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
                if (permission === 'hardware-accelerated-video-decode') {
                    callback(false); // Disable for legacy Windows
                } else {
                    callback(true);
                }
            });

            // Set Windows compatible user agent
            defaultSession.setUserAgent(this.getCompatibleUserAgent());

            // Windows 7 specific: Additional session fixes
            if (this.isWindows7) {
                console.log('🔧 Applying Windows 7 specific session fixes...');
                
                // Disable web security completely for Windows 7
                defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
                    console.log(`🔍 Windows 7: Permission requested: ${permission}`);
                    callback(true); // Allow all permissions for Windows 7
                });

                // Set additional Windows 7 headers
                defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
                    if (details.requestHeaders) {
                        // Add Windows 7 specific headers
                        details.requestHeaders['User-Agent'] = this.getCompatibleUserAgent();
                        details.requestHeaders['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8';
                        details.requestHeaders['Accept-Language'] = 'en-US,en;q=0.5';
                        details.requestHeaders['Accept-Encoding'] = 'gzip, deflate';
                        details.requestHeaders['Connection'] = 'keep-alive';
                        details.requestHeaders['Upgrade-Insecure-Requests'] = '1';
                    }
                    callback({ requestHeaders: details.requestHeaders });
                });

                console.log('✅ Windows 7 specific session fixes applied');
            }

            console.log(`✅ Windows ${this.windowsVersion} session fixes applied`);
        } catch (error) {
            console.error(`❌ Failed to apply Windows ${this.windowsVersion} session fixes:`, error);
        }
    }

    /**
     * Check if Windows compatibility is needed
     */
    needsCompatibility() {
        return this.isLegacyWindows;
    }

    /**
     * Get loading delay for Windows
     */
    getLoadingDelay() {
        if (this.isWindows7) {
            return 8000; // 8 seconds for Windows 7
        } else if (this.isLegacyWindows) {
            return 5000; // 5 seconds for Windows 8
        } else {
            return 3000; // 3 seconds for modern Windows
        }
    }
}

module.exports = WindowsCompatibility;
