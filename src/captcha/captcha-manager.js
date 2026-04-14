// ============================================================
// captcha/captcha-manager.js — CAPTCHA цонхны lifecycle
// ============================================================
const { BrowserWindow } = require('electron');
const path = require('path');
const WindowsCompatibility = require('../utils/windows7Compat');
const CookieCollector = require('../socket/cookie-collector');
const CaptchaSocket = require('../socket/captcha-socket');

const winCompat = new WindowsCompatibility();

class CaptchaManager {
    constructor() {
        this.window = null;
        this.cookieCollector = null;
        this.captchaSocket = null;
    }

    /**
     * CAPTCHA цонх нээх
     * @param {number} isCitizen - 0: байгууллага, 1: иргэн
     * @param {BrowserWindow|null} mainWindow
     */
    async open(isCitizen, mainWindow = null) {
        console.log('[CaptchaManager] open:', { isCitizen });

        // Хуучин цонх хаах
        await this.close();

        const captchaUrl = isCitizen
            ? 'https://e.khanbank.com/auth/login'
            : 'https://corp.khanbank.com/auth/login';

        // ─── BrowserWindow үүсгэх ───
        this.window = new BrowserWindow({
            width: 800,
            height: 600,
            x: 100,
            y: 100,
            parent: mainWindow || undefined,
            modal: false,
            frame: true,
            title: 'Төхөөрөмж таниулах',
            show: false,
            resizable: true,
            ...winCompat.getCompatibleWindowOptions(),
            webPreferences: winCompat.getCompatibleWebPreferences(),
        });

        this.window.webContents.setUserAgent(winCompat.getCompatibleUserAgent());
        winCompat.applySessionFixes();

        // ─── HTML ачаалах ───
        await this._loadContent();

        // ─── Events ───
        this.window.on('closed', () => {
            console.log('[CaptchaManager] Цонх хаагдлаа');
            this.window = null;
            this._cleanup();
        });

        this.window.once('ready-to-show', () => {
            console.log('[CaptchaManager] ready-to-show');

            const delay = winCompat.isWindows7 ? 2000 : 0;
            setTimeout(() => {
                // CookieCollector эхлүүлэх
                this.cookieCollector = new CookieCollector(this.window, isCitizen, winCompat);
                this.cookieCollector.install();

                // Socket холболт
                this.captchaSocket = new CaptchaSocket(isCitizen);
                this.captchaSocket.connect();

                // CAPTCHA дуусахад цонх хаах — ЦОРЫН ГАНЦ trigger
                this.captchaSocket.onCaptchaDone(() => {
                    console.log('[CaptchaManager] CAPTCHA дууслаа → цонх хааж байна');
                    this.close();
                });
            }, delay);
        });

        // ─── KhanBank URL ачаалах ───
        const loadDelay = winCompat.getLoadingDelay();
        setTimeout(async () => {
            if (!this.window || this.window.isDestroyed()) return;
            try {
                await winCompat.loadURLWithRetry(this.window.webContents, captchaUrl);
                console.log('[CaptchaManager] KhanBank URL ачааллаа');
            } catch (err) {
                console.error('[CaptchaManager] URL ачаалах алдаа:', err.message);
            }
        }, loadDelay);

        // ─── Цонх харуулах ───
        const showDelay = winCompat.isWindows7 ? 3000 : 1000;
        setTimeout(() => {
            if (this.window && !this.window.isDestroyed()) {
                this.window.show();
                if (winCompat.isWindows7) {
                    this.window.focus();
                    this.window.moveTop();
                }
            }
        }, showDelay);

        return this.window;
    }

    /**
     * CAPTCHA цонх хаах + бүх resource цэвэрлэх
     */
    async close() {
        this._cleanup();

        if (this.window && !this.window.isDestroyed()) {
            console.log('[CaptchaManager] Цонх хааж байна...');
            this.window.destroy();
            this.window = null;
            await new Promise(r => setTimeout(r, 300));
        }
        this.window = null;
    }

    isOpen() {
        return this.window && !this.window.isDestroyed();
    }

    // ─── Private ───

    _cleanup() {
        if (this.cookieCollector) {
            this.cookieCollector.uninstall();
            this.cookieCollector = null;
        }
        if (this.captchaSocket) {
            this.captchaSocket.disconnect();
            this.captchaSocket = null;
        }
    }

    async _loadContent() {
        const htmlPath = path.join(__dirname, '..', 'captcha.html');

        if (winCompat.isWindows7) {
            try {
                const fs = require('fs');
                const html = fs.readFileSync(htmlPath, 'utf8');
                const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
                await this.window.webContents.loadURL(dataUrl);
            } catch (err) {
                console.error('[CaptchaManager] Win7 HTML ачаалах алдаа:', err.message);
                await this.window.loadFile(htmlPath);
            }
        } else {
            await this.window.loadFile(htmlPath);
        }
    }
}

module.exports = new CaptchaManager();