// ============================================================
// services/socketService.js — Нэгдсэн Socket Service
// ============================================================
// Нэг socket холболт бүгдийг хийнэ:
//   - newTransactions event (server poller-ээс)
//   - captcha-update event (captcha-listener-ээс)
//   - captcha-setup emit (CAPTCHA цонх нээхэд)
//   - joinRoom emit (user-specific room)

const io = require('socket.io-client');
const { API_CONFIG } = require('../utils/constants');

class SocketService {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this._userId = null;
        this._isCitizen = null;

        // Callback-ууд
        this._onCaptchaDone = null;
        this._onNewTransactions = null;
        this._onCaptchaRequired = null;
        this._onTokenExpired = null;
        this._onConnectChange = null;
        this._pendingCaptchaSetup = null;
    }

    // ─── Connection ────────────────────────────────────────────

    /**
     * Socket холболт хийх
     * @param {string|null} userId - User ID (room join + query)
     * @param {number|null} isCitizen - IsCitizen утга (captcha-setup)
     * @param {string|null} accessToken - JWT (poller bankAccounts уншина)
     */
    connect(userId = null, isCitizen = null, accessToken = null) {
        // Аль хэдийн холбогдсон бол давхар холбохгүй
        if (this.socket && this.isConnected) {
            console.log('[SocketService] Аль хэдийн холбогдсон');
            return this.socket;
        }

        // Хуучин socket байвал цэвэрлэх
        if (this.socket) {
            this.disconnect();
        }

        this._userId = userId;
        this._isCitizen = isCitizen;

        const url = this._getApiUrl();
        console.log(`[SocketService] Холбогдож байна: ${url}, userId: ${userId}`);

        try {
            const query = {};
            if (userId) query.userId = userId;
            if (accessToken) query.token = accessToken;

            this.socket = io(url, {
                query,
                transports: ['polling'],
                timeout: 15000,
                forceNew: true,
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 3000,
                reconnectionDelayMax: 10000,
                upgrade: false,
                rememberUpgrade: false,
            });

            this._setupEventHandlers();
            return this.socket;
        } catch (error) {
            console.error('[SocketService] Холболт алдаа:', error.message);
            this.isConnected = false;
            return null;
        }
    }

    /**
     * Socket холболт хаах + бүх listener цэвэрлэх
     */
    disconnect() {
        if (this.socket) {
            try {
                this.socket.removeAllListeners();
                this.socket.disconnect();
            } catch (err) {
                console.error('[SocketService] Disconnect алдаа:', err.message);
            }
            this.socket = null;
        }
        this.isConnected = false;
        this._userId = null;
        console.log('[SocketService] Disconnected');

        if (this._onConnectChange) {
            this._onConnectChange(false);
        }
    }

    // ─── Event Callbacks ───────────────────────────────────────

    /**
     * CAPTCHA амжилттай дууссан
     * @param {Function} cb - (result) => void
     */
    onCaptchaDone(cb) {
        this._onCaptchaDone = cb;
    }

    /**
     * Шинэ гүйлгээ ирсэн (server poller-ээс)
     * @param {Function} cb - (data) => void
     */
    onNewTransactions(cb) {
        this._onNewTransactions = cb;
    }

    /**
     * CAPTCHA шаардлагатай (server poller CAPTCHA_PENDING илрүүлсэн)
     * @param {Function} cb - (data) => void
     */
    onCaptchaRequired(cb) {
        this._onCaptchaRequired = cb;
    }

    /**
     * Token дууссан
     * @param {Function} cb - (data) => void
     */
    onTokenExpired(cb) {
        this._onTokenExpired = cb;
    }

    /**
     * Socket холболтын төлөв өөрчлөгдсөн
     * @param {Function} cb - (connected: boolean) => void
     */
    onConnectChange(cb) {
        this._onConnectChange = cb;
    }

    // ─── Emitters ──────────────────────────────────────────────

    /**
     * CAPTCHA setup илгээх (CAPTCHA цонх нээхэд)
     */
    // socketService.js дотор:

    emitCaptchaSetup(userOid, isCitizen) {
        if (this._isReady()) {
            this.socket.emit('captcha-setup', { userOid, isCitizen });
            console.log('[SocketService] captcha-setup илгээгдлээ');
            this._pendingCaptchaSetup = false;
        } else {
            // Socket бэлэн биш — connect болоход илгээх
            console.log('[SocketService] captcha-setup queue-д хадгалсан');
            this._pendingCaptchaSetup = true;
        }
    }

    /**
     * User room-д нэгдэх
     */
    joinUserRoom(userId) {
        if (!this._isReady()) return;

        this.socket.emit('joinRoom', { userId });
        console.log(`[SocketService] Room нэгдлээ: ${userId}`);
    }

    // ─── Status ────────────────────────────────────────────────

    isSocketConnected() {
        return !!(this.socket && this.isConnected);
    }

    getSocketId() {
        return this.socket?.id ?? null;
    }

    // ─── Private: Event Handlers ───────────────────────────────

    _setupEventHandlers() {
        if (!this.socket) return;

        // ─── Connect ───
        this.socket.on('connect', () => {
            this.isConnected = true;
            if (this._userId) this.joinUserRoom(this._userId);

            // Хүлээгдэж буй captcha-setup байвал илгээх
            if (this._pendingCaptchaSetup && this._userId) {
                this.socket.emit('captcha-setup', {
                    userOid: this._userId,
                    isCitizen: this._isCitizen
                });
                this._pendingCaptchaSetup = false;
                console.log('[SocketService] captcha-setup (pending) илгээгдлээ');
            }

            if (this._onConnectChange) this._onConnectChange(true);
        });

        // ─── Disconnect ───
        this.socket.on('disconnect', (reason) => {
            this.isConnected = false;
            console.log('[SocketService] Disconnected:', reason);

            if (this._onConnectChange) {
                this._onConnectChange(false);
            }
        });

        // ─── Connect Error ───
        this.socket.on('connect_error', (error) => {
            this.isConnected = false;
            console.error('[SocketService] Connect error:', error.message);
        });

        // ─── Reconnect ───
        this.socket.on('reconnect', (attemptNumber) => {
            this.isConnected = true;
            console.log('[SocketService] Reconnected:', attemptNumber);

            if (this._onConnectChange) {
                this._onConnectChange(true);
            }
        });

        this.socket.on('reconnect_failed', () => {
            this.isConnected = false;
            console.error('[SocketService] Reconnect failed');

            if (this._onConnectChange) {
                this._onConnectChange(false);
            }
        });

        // ─── Business Events ───

        // Шинэ гүйлгээ (server TransactionPoller-ээс)
        this.socket.on('newTransactions', (data) => {
            console.log('[SocketService] newTransactions:', data?.data?.transactions?.length ?? 0);
            if (this._onNewTransactions) {
                this._onNewTransactions(data);
            }
        });

        // CAPTCHA дууссан (server captcha-listener-ээс)
        this.socket.on('captcha-update', (result) => {
            console.log('[SocketService] captcha-update:', {
                success: result?.success,
                done: result?.captchaDone,
                shouldClose: result?.shouldCloseWindow,
            });

            if (result?.success && result?.captchaDone) {
                if (this._onCaptchaDone) {
                    this._onCaptchaDone(result);
                }
            }
        });

        // CAPTCHA шаардлагатай (server poller CAPTCHA илрүүлсэн)
        this.socket.on('captcha_required', (data) => {
            console.log('[SocketService] captcha_required:', data?.message);
            if (this._onCaptchaRequired) {
                this._onCaptchaRequired(data);
            }
        });

        // Token дууссан
        this.socket.on('tokenExpired', (data) => {
            console.log('[SocketService] tokenExpired');
            if (this._onTokenExpired) {
                this._onTokenExpired(data);
            }
        });

        // CAPTCHA resolved (server-ээс monitoring дахин эхэлсэн)
        this.socket.on('captcha_resolved', (data) => {
            console.log('[SocketService] captcha_resolved:', data?.message);
        });
    }

    // ─── Private: Helpers ──────────────────────────────────────

    _isReady() {
        return !!(this.socket && (this.isConnected || this.socket.connected));
    }

    _getApiUrl() {
        if (typeof window !== 'undefined' && window.electron) {
            const isDev = process.env.NODE_ENV === 'development' ||
                (typeof process !== 'undefined' && process.argv?.includes('--dev'));
            return isDev ? (process.env.API_BASE_URL_DEV || API_CONFIG.BASE_URL) : API_CONFIG.BASE_URL;
        }

        if (typeof window !== 'undefined' && !window.electron && typeof process !== 'undefined') {
            const isDev = process.env.NODE_ENV === 'development' &&
                !process.execPath?.includes('electron');
            if (isDev && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
                return process.env.API_BASE_URL_DEV || API_CONFIG.BASE_URL;
            }
        }

        return API_CONFIG.BASE_URL;
    }
}

// Singleton
const socketService = new SocketService();
module.exports = socketService;