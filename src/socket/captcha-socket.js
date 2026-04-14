// ============================================================
// captcha/captcha-socket.js — Socket.io connection
// ============================================================
const { io } = require('socket.io-client');
const { API_CONFIG } = require('../utils/constants');

class CaptchaSocket {
    constructor(isCitizen) {
        this.isCitizen = isCitizen;
        this.socket = null;
        this._onDoneCallback = null;
    }

    connect() {
        if (this.socket) {
            this.disconnect();
        }

        const authToken = global.currentAuthToken;
        if (!authToken) {
            console.warn('[CaptchaSocket] Auth token олдсонгүй');
            return;
        }

        // JWT-ээс userOid авах
        let userOid = null;
        try {
            const payload = JSON.parse(Buffer.from(authToken.split('.')[1], 'base64').toString());
            userOid = payload.userOid || payload.userId || null;
        } catch (_) {}

        this.socket = io(API_CONFIG.BASE_URL, { transports: ['polling'] });

        this.socket.on('connect', () => {
            console.log('[CaptchaSocket] connected:', this.socket.id);
            this.socket.emit('captcha-setup', {
                userOid,
                isCitizen: this.isCitizen,
            });
        });

        this.socket.on('disconnect', () => {
            console.log('[CaptchaSocket] disconnected');
        });

        this.socket.on('error', (err) => {
            console.error('[CaptchaSocket] error:', err);
        });

        // CAPTCHA дууссан event — цорын ганц trigger
        this.socket.on('captcha-update', (result) => {
            console.log('[CaptchaSocket] captcha-update:', {
                success: result?.success,
                done: result?.captchaDone,
            });
            if (result?.success && result?.captchaDone && result?.shouldCloseWindow) {
                if (this._onDoneCallback) {
                    this._onDoneCallback();
                }
            }
        });

        this.socket.connect();
    }

    disconnect() {
        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket.disconnect();
            this.socket = null;
        }
        console.log('[CaptchaSocket] disconnected & cleaned');
    }

    /**
     * CAPTCHA амжилттай дууссан event
     * @param {Function} cb
     */
    onCaptchaDone(cb) {
        this._onDoneCallback = cb;
    }
}

module.exports = CaptchaSocket;