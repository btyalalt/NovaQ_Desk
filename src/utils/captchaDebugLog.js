/**
 * CAPTCHA → KhanBankCookies insert debug log
 * Main terminal + renderer DevTools (IPC dev-console-log)
 * CAPTCHA_VERBOSE_LOG=1 үед л дэлгэрэнгүй
 */

let rendererWebContents = null;

const CAPTCHA_VERBOSE =
    process.env.CAPTCHA_VERBOSE_LOG === '1' || process.env.CAPTCHA_VERBOSE_LOG === 'true';

function setCaptchaLogRenderer(webContents) {
    rendererWebContents = webContents;
}

function _maskSecrets(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const copy = { ...obj };
    if (copy.password) copy.password = '***';
    if (copy.bank_Password) copy.bank_Password = '***';
    if (copy.requestPayload && typeof copy.requestPayload === 'string') {
        try {
            const p = JSON.parse(copy.requestPayload);
            if (p.password) p.password = '***';
            copy.requestPayload = p;
        } catch {
            copy.requestPayload = '(payload)';
        }
    }
    if (copy.headers && typeof copy.headers === 'object') {
        const h = { ...copy.headers };
        if (h.Cookie) h.Cookie = `${String(h.Cookie).slice(0, 40)}...`;
        if (h.cookie) h.cookie = `${String(h.cookie).slice(0, 40)}...`;
        copy.headers = h;
    }
    return copy;
}

function _shortUrl(url) {
    if (!url) return '';
    try {
        const path = new URL(url).pathname;
        const parts = path.split('/').filter(Boolean);
        return parts.slice(-4).join('/') || path;
    } catch {
        return String(url).replace(/^https?:\/\/[^/]+/, '').slice(0, 60);
    }
}

function _emit(level, line, extra) {
    const consoleLevel = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    if (extra && CAPTCHA_VERBOSE) {
        console[consoleLevel](line, _maskSecrets(extra));
    } else {
        console[consoleLevel](line);
    }

    if (!rendererWebContents || rendererWebContents.isDestroyed()) return;
    try {
        rendererWebContents.send('dev-console-log', {
            type: 'captcha-insert',
            level: consoleLevel,
            message: line,
            extra: CAPTCHA_VERBOSE && extra ? _maskSecrets(extra) : undefined,
        });
    } catch (_) {}
}

/**
 * Нэг мөр — insert дууссаны дараа
 */
function captchaLogInsertResult({ tag, url, insertedCount = 0, ok, reason, exposeOk }) {
    const path = _shortUrl(url);
    const icon = ok ? '✓' : '✗';
    let line = `[CAPTCHA→DB] ${icon} ${tag || 'insert'} ${path} → DB+${insertedCount}`;
    if (exposeOk) line += ' expose=OK';
    if (!ok && reason) line += ` (${reason})`;
    _emit(ok ? 'log' : 'warn', line);
}

/**
 * @param {'info'|'warn'|'error'|'ok'} level
 */
function captchaLog(level, tag, message, extra) {
    if (!CAPTCHA_VERBOSE) {
        if (level === 'error') {
            _emit('error', `[CAPTCHA→DB] ${tag}: ${message}`, extra);
            return;
        }
        if (tag === 'STATS' && extra) {
            _emit(
                'log',
                `[CAPTCHA→DB] stats: captured=${extra.captured} sent=${extra.sent} inserted=${extra.inserted} failed=${extra.failed}`
            );
            return;
        }
        if (tag === 'MANAGER' && message.includes('эхлүүл')) {
            _emit('log', `[CAPTCHA→DB] ${message}`, extra);
            return;
        }
        if (tag === 'HOOKS' && message === 'Суулгагдлаа') {
            _emit('log', `[CAPTCHA→DB] hooks суулгагдлаа`, extra);
        }
        return;
    }

    _emit(
        level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log',
        `[CAPTCHA→DB][${tag}] ${message}`,
        extra
    );
}

module.exports = {
    setCaptchaLogRenderer,
    captchaLog,
    captchaLogInsertResult,
    CAPTCHA_VERBOSE,
};
