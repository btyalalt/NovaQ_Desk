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
        this.isWindows8 = this.windowsVersion === '8';
        this.isWindows10 = this.windowsVersion === '10';
        this.isWindows11 = this.windowsVersion === '11';
        this.isLegacyWindows = this.isWindows7 || this.isWindows8;
        this.isModernWindows = this.isWindows10 || this.isWindows11;
        this.retryCount = 0;
        this.maxRetries = 3;
    }

    /**
     * Win7=6.1 | Win8=6.2/6.3 | Win10=10.0 build<22000 | Win11=10.0 build>=22000
     * (Win11 kernel нь 10.0 гэж буцаадаг тул build-ээр ялгана)
     */
    detectWindowsVersion() {
        if (process.platform !== 'win32') return null;

        try {
            const os = require('os');
            const release = os.release() || '';
            const systemVersion = process.getSystemVersion() || release;
            const build = parseInt(String(release.split('.')[2] || '0'), 10);

            if (systemVersion.startsWith('6.1') || release.startsWith('6.1')) return '7';
            if (
                systemVersion.startsWith('6.2') ||
                systemVersion.startsWith('6.3') ||
                release.startsWith('6.2') ||
                release.startsWith('6.3')
            ) {
                return '8';
            }
            if (systemVersion.startsWith('11.0')) return '11';
            if (build >= 22000) return '11';
            if (systemVersion.startsWith('10.0') || release.startsWith('10.0')) return '10';
            return 'unknown';
        } catch (error) {
            console.warn('⚠️ Could not detect Windows version:', error);
            return 'unknown';
        }
    }

    /** CAPTCHA цонх нээхээс өмнөх хүлээлт (ms) */
    getCaptchaOpenDelayMs() {
        switch (this.windowsVersion) {
            case '7': return 8000;
            case '8': return 1500;
            case '10': return 500;
            case '11': return 400;
            default: return 500;
        }
    }

    /** Хоосон хуудас шалгах хугацаа (ms) — SPA ачаалахад OS бүр өөр */
    getCaptchaBlankCheckDelaysMs() {
        switch (this.windowsVersion) {
            case '7': return [2500, 5000, 9000];
            case '8': return [2000, 4500, 8000];
            case '10': return [2000, 4500, 8000];
            case '11': return [1500, 4000, 7000];
            default: return [2000, 4500, 8000];
        }
    }

    /** URL ачаалах retry тоо */
    getCaptchaLoadMaxRetries() {
        if (this.isWindows7) return 3;
        if (this.isWindows8) return 3;
        if (this.isModernWindows) return 2;
        return 2;
    }

    /**
     * CAPTCHA цонхны webPreferences — main app-аас тусдаа, Chrome шиг fingerprint.
     * Electron 11: preload shim page-тай нэг world-д ажиллахын тулд contextIsolation: false.
     */
    getCaptchaWebPreferences(preloadPath) {
        const base = {
            preload: preloadPath,
            contextIsolation: false,
            nodeIntegration: false,
            sandbox: false,
            enableRemoteModule: false,
        };

        if (this.isLegacyWindows) {
            return {
                ...base,
                webSecurity: false,
                experimentalFeatures: false,
                backgroundThrottling: false,
                webgl: false,
                allowRunningInsecureContent: true,
            };
        }

        return {
            ...base,
            webSecurity: true,
            experimentalFeatures: true,
            backgroundThrottling: false,
            webgl: true,
            allowRunningInsecureContent: false,
        };
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
        // Electron 11 ≈ Chromium 87 — Chrome/120 гэж хэлбэл Khan хэт шинэ JS илгээнэ
        const chromeVersion = (process.versions && process.versions.chrome) || '87.0.4280.141';
        const webkitVersion = '537.36';

        switch (this.windowsVersion) {
            case '7':
                return `Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/${webkitVersion} (KHTML, like Gecko) Chrome/${chromeVersion} Safari/${webkitVersion}`;
            case '8':
                return `Mozilla/5.0 (Windows NT 6.2; WOW64) AppleWebKit/${webkitVersion} (KHTML, like Gecko) Chrome/${chromeVersion} Safari/${webkitVersion}`;
            case '10':
            case '11':
            default:
                return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/${webkitVersion} (KHTML, like Gecko) Chrome/${chromeVersion} Safari/${webkitVersion}`;
        }
    }

    /**
     * Enhanced loading with Windows retry mechanism
     */
    async loadURLWithRetry(webContents, url, maxRetries = this.getCaptchaLoadMaxRetries()) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`🔍 Windows ${this.windowsVersion} CAPTCHA load attempt ${attempt}/${maxRetries}: ${url}`);
                
                if (attempt > 1) {
                    let delay;
                    if (this.isWindows7) delay = 3000 * attempt;
                    else if (this.isWindows8) delay = 2000 * attempt;
                    else delay = 1200 * attempt;
                    console.log(`⏰ Waiting ${delay}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }

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
        if (process.platform !== 'win32' || !window?.webContents) return;

        console.log(`🔧 CAPTCHA window listeners (Windows ${this.windowsVersion || '?'})`);

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
                    if (!window.isDestroyed()) {
                        window.webContents.loadURL(url);
                    }
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
     * CAPTCHA session HTTP header — Chrome 87 navigation шиг (Electron UA leak засах)
     */
    applyCaptchaChromeHeaders(targetSession) {
        if (!targetSession?.webRequest) return;

        const ua = this.getCompatibleUserAgent();
        const filter = {
            urls: [
                '*://*.khanbank.com/*',
                '*://api.khanbank.com/*',
            ],
        };

        targetSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
            const headers = { ...details.requestHeaders };
            headers['User-Agent'] = ua;
            headers['Accept-Language'] = 'mn-MN,mn;q=0.9,en-US;q=0.8,en;q=0.7';

            const resourceType = details.resourceType;
            if (resourceType === 'mainFrame' || resourceType === 'subFrame') {
                headers.Accept =
                    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9';
            }

            callback({ requestHeaders: headers });
        });
    }

    /**
     * Apply Windows compatibility fixes to session
     */
    applySessionFixes(targetSession = session.defaultSession) {
        if (!this.isLegacyWindows) {
            try {
                targetSession.setUserAgent(this.getCompatibleUserAgent());
            } catch (_) { /* */ }
            return;
        }

        console.log(`🔧 Applying Windows ${this.windowsVersion} session compatibility fixes`);

        try {
            const defaultSession = targetSession;
            
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

    /**
     * Login дараах цагаан хуудас — reload / алдааны мэдээлэл
     * @param {import('electron').BrowserWindow} window
     * @param {(level: string, tag: string, msg: string, extra?: object) => void} [logFn]
     */
    setupBlankPageRecovery(window, logFn = () => {}) {
        if (!window?.webContents) return;

        let blankRecoverAttempts = 0;
        const MAX_BLANK_RECOVER = 3;
        const CHECK_DELAYS_MS = this.getCaptchaBlankCheckDelaysMs();
        let scheduledForNav = 0;

        const checkBlank = async () => {
            if (window.isDestroyed()) return;
            try {
                const info = await window.webContents.executeJavaScript(`({
                    ready: document.readyState,
                    bodyLen: (document.body && document.body.innerText) ? document.body.innerText.trim().length : 0,
                    childCount: document.body ? document.body.children.length : 0,
                    rootEmpty: (() => {
                        const root = document.querySelector('#root, #app, [data-reactroot]');
                        return !!(root && !root.innerHTML.trim());
                    })(),
                    url: location.href,
                    title: document.title || ''
                })`, true);

                const isLoginHost =
                    /khanbank\\.com/i.test(info.url || '') &&
                    !String(info.url || '').startsWith('about:');
                const looksBlank =
                    isLoginHost &&
                    ((info.bodyLen < 30 && info.childCount < 4) || info.rootEmpty);

                if (!looksBlank || blankRecoverAttempts >= MAX_BLANK_RECOVER) return;

                blankRecoverAttempts += 1;
                logFn(
                    'warn',
                    'COMPAT',
                    'хоосон хуудас — сэргээх',
                    { attempt: blankRecoverAttempts, ...info, os: this.windowsVersion }
                );

                const wc = window.webContents;
                if (blankRecoverAttempts >= 2) {
                    try {
                        await wc.session.clearCache();
                    } catch (_) { /* */ }
                    wc.reloadIgnoringCache();
                } else {
                    wc.reload();
                }
            } catch (err) {
                logFn('warn', 'COMPAT', 'blank check алдаа', { error: err.message });
            }
        };

        const scheduleChecks = () => {
            const navId = ++scheduledForNav;
            CHECK_DELAYS_MS.forEach((delay) => {
                setTimeout(() => {
                    if (navId !== scheduledForNav || window.isDestroyed()) return;
                    checkBlank();
                }, delay);
            });
        };

        window.webContents.on('did-finish-load', scheduleChecks);
        window.webContents.on('did-navigate-in-page', scheduleChecks);
        window.webContents.on('did-navigate', scheduleChecks);
    }
}

module.exports = WindowsCompatibility;
