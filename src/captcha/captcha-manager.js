// ============================================================
// captcha/captcha-manager.js — CAPTCHA цонхны lifecycle (ИДЭВХТЭЙ)
// main.js → create-captcha-window | StatementScreen → socket captcha-setup
// Cookie insert: cookie-collector → khanBankCookieInsert (main only)
// ============================================================
const path = require('path');
const { BrowserWindow, session } = require('electron');
const WindowsCompatibility = require('../utils/windows7Compat');
const CookieCollector = require('../socket/cookie-collector');

const CAPTCHA_PRELOAD_PATH = path.join(__dirname, 'captcha-chrome-shim.preload.js');

/** app.whenReady()-ээс өмнө session.fromPartition() дуудахгүй (exe эхлэхгүй болно) */
let captchaSession = null;
let captchaSessionCspHooked = false;

function getCaptchaSession(stripCsp) {
    if (!captchaSession) {
        captchaSession = session.fromPartition('persist:novaq-khan-captcha');
    }
    if (stripCsp && !captchaSessionCspHooked) {
        captchaSessionCspHooked = true;
        captchaSession.webRequest.onHeadersReceived((details, callback) => {
            const headers = { ...details.responseHeaders };
            delete headers['content-security-policy'];
            delete headers['Content-Security-Policy'];
            callback({ responseHeaders: headers });
        });
    }
    return captchaSession;
}
const { setCaptchaLogRenderer, captchaLog } = require('../utils/captchaDebugLog');

const winCompat = new WindowsCompatibility();

/** Win7-ээс бусад: шууд Khan login ачаална (3s loadDelay байхгүй) */
function getCaptchaOpenDelayMs() {
    if (winCompat.isWindows7) return 8000;
    if (winCompat.isLegacyWindows) return 1500;
    return 0;
}

class CaptchaManager {
    constructor() {
        this.window = null;
        this.cookieCollector = null;
        this._opening = false;
    }

    /**
     * CAPTCHA цонх нээх
     * @param {number} isCitizen - 0: байгууллага, 1: иргэн
     * @param {BrowserWindow|null} mainWindow
     */
    async open(isCitizen, mainWindow = null) {
        if (this._opening) {
            captchaLog('warn', 'MANAGER', 'open аль хэдийн ажиллаж байна');
            return this.window;
        }
        this._opening = true;

        try {
            captchaLog('info', 'MANAGER', 'open', { isCitizen });

            // Аль хэдийн нээлттэй бол дахин close/open хийхгүй (цонх асах шалтгаан)
            if (this.isOpen()) {
                captchaLog('info', 'MANAGER', 'open — цонх аль хэдийн нээлттэй');
                return this.window;
            }

            await this.close();

            const captchaSes = getCaptchaSession(winCompat.isLegacyWindows);

            const captchaUrl =
                isCitizen === 1
                    ? 'https://e.khanbank.com/auth/login'
                    : 'https://corp.khanbank.com/auth/login';

            this.window = new BrowserWindow({
                width: 1200,
                height: 800,
                x: 100,
                y: 100,
                parent: mainWindow || undefined,
                modal: false,
                frame: true,
                autoHideMenuBar: true,
                title: 'Төхөөрөмж таниулах',
                show: true,
                resizable: true,
                ...winCompat.getCompatibleWindowOptions(),
                webPreferences: {
                    ...winCompat.getCaptchaWebPreferences(CAPTCHA_PRELOAD_PATH),
                    session: captchaSes,
                },
            });

            this.window.webContents.setUserAgent(winCompat.getCompatibleUserAgent());
            captchaSes.setUserAgent(winCompat.getCompatibleUserAgent());
            winCompat.applySessionFixes(captchaSes);
            winCompat.setupWindowsEventListeners(this.window);
            winCompat.setupBlankPageRecovery(this.window, captchaLog);

            captchaLog('info', 'MANAGER', 'OS', {
                windows: winCompat.windowsVersion,
                legacy: winCompat.isLegacyWindows,
                chrome: process.versions?.chrome,
            });

            if (mainWindow?.webContents && !mainWindow.isDestroyed()) {
                setCaptchaLogRenderer(mainWindow.webContents);
            }

            this.window.on('closed', () => {
                captchaLog('info', 'MANAGER', 'цонх хаагдлаа');
                this.window = null;
                this._cleanup();
            });

            this.window.once('ready-to-show', () => {
                if (this.window && !this.window.isDestroyed()) {
                    this.window.show();
                    this.window.focus();
                    this.window.moveTop?.();
                }
            });

            const startCookieCollector = () => {
                if (!this.window || this.window.isDestroyed()) return;
                if (this.cookieCollector) return;
                captchaLog('info', 'MANAGER', 'CookieCollector эхлүүлж байна', { isCitizen });
                this.cookieCollector = new CookieCollector(this.window, isCitizen, winCompat);
                this.cookieCollector.install();
            };

            const openDelay = getCaptchaOpenDelayMs();
            const runLoad = async () => {
                if (!this.window || this.window.isDestroyed()) return;
                try {
                    await winCompat.loadURLWithRetry(this.window.webContents, captchaUrl);
                    captchaLog('info', 'MANAGER', 'KhanBank URL ачааллаа', { captchaUrl });
                    const hookDelay = winCompat.isWindows7 ? 2000 : 0;
                    if (hookDelay > 0) {
                        setTimeout(startCookieCollector, hookDelay);
                    } else {
                        startCookieCollector();
                    }
                } catch (err) {
                    captchaLog('error', 'MANAGER', 'URL ачаалах алдаа', { error: err.message });
                }
            };

            if (openDelay > 0) {
                setTimeout(runLoad, openDelay);
            } else {
                await runLoad();
            }

            return this.window;
        } finally {
            this._opening = false;
        }
    }

    async close() {
        this._cleanup();

        if (this.window && !this.window.isDestroyed()) {
            captchaLog('info', 'MANAGER', 'хааж байна');
            this.window.destroy();
            this.window = null;
            await new Promise((r) => setTimeout(r, 200));
        }
        this.window = null;
    }

    isOpen() {
        return this.window && !this.window.isDestroyed();
    }

    _cleanup() {
        if (this.cookieCollector) {
            this.cookieCollector.uninstall();
            this.cookieCollector = null;
        }
    }
}

module.exports = new CaptchaManager();
