/**
 * KhanBankCookies insert — ЗӨВХӨН main process (CookieCollector).
 * desktopService/webpack bundle ашиглахгүй.
 */
const https = require('https');
const http = require('http');
const { getMainProcessJwt } = require('./mainJwt');
const { captchaLog } = require('./captchaDebugLog');

function getMainApiUrl() {
    const isDev =
        process.env.NODE_ENV === 'development' ||
        (typeof process !== 'undefined' && process.argv && process.argv.includes('--dev'));
    if (isDev) {
        return process.env.API_BASE_URL_DEV || 'http://103.168.56.34:3130';
    }
    return process.env.API_BASE_URL || 'https://novaq.mn:3119';
}

function httpPostJson(url, headers, body) {
    return new Promise((resolve, reject) => {
        const lib = url.startsWith('https') ? https : http;
        const u = new URL(url);
        const data = JSON.stringify(body);
        const req = lib.request(
            {
                hostname: u.hostname,
                port: u.port || (url.startsWith('https') ? 443 : 80),
                path: u.pathname + u.search,
                method: 'POST',
                headers: {
                    ...headers,
                    'Content-Length': Buffer.byteLength(data),
                },
                rejectUnauthorized: false,
            },
            (res) => {
                let raw = '';
                res.on('data', (chunk) => {
                    raw += chunk;
                });
                res.on('end', () => {
                    resolve({
                        ok: res.statusCode >= 200 && res.statusCode < 300,
                        status: res.statusCode,
                        raw,
                    });
                });
            }
        );
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function postToDesktopApi(path, jwtToken, body) {
    const apiBaseUrl = getMainApiUrl();
    const url = `${apiBaseUrl}${path}`;
    const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwtToken}`,
    };

    if (typeof fetch !== 'undefined') {
        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });
        const raw = await response.text();
        return { ok: response.ok, status: response.status, raw };
    }

    return httpPostJson(url, headers, body);
}

function parseJsonResponse(res, label) {
    try {
        return JSON.parse(res.raw);
    } catch (parseErr) {
        captchaLog('error', 'API', `${label} хариу JSON биш`, {
            status: res.status,
            preview: (res.raw || '').slice(0, 150),
            error: parseErr.message,
        });
        return null;
    }
}

/**
 * @returns {Promise<{ ok: boolean, insertedCount?: number, reason?: string }>}
 */
async function insertKhanBankCookiesFromMain(params) {
    const {
        isCitizen,
        url,
        headers,
        deviceId,
        requestPayload,
        responsePayload,
        isResponseHeader,
        bankAccountNum,
        jwtToken: jwtOverride,
    } = params;

    if (!url) return { ok: false, reason: 'no_url' };

    const jwtToken = jwtOverride || getMainProcessJwt();
    if (!jwtToken) return { ok: false, reason: 'no_jwt' };

    const requestData = {
        isCitizen,
        url,
        headers,
        deviceId,
        bankAccountNum,
        requestPayload,
        responsePayload,
        isResponseHeader,
    };

    try {
        const res = await postToDesktopApi(
            '/api/desktop/insert-khanbank-cookies',
            jwtToken,
            requestData
        );
        const result = parseJsonResponse(res, 'insert');
        if (!result) {
            return { ok: false, reason: 'invalid_json', status: res.status };
        }

        const count = result.insertedCount ?? 0;
        return { ok: count > 0, insertedCount: count, result };
    } catch (err) {
        captchaLog('error', 'API', 'insert network алдаа', { error: err.message });
        return { ok: false, reason: err.message };
    }
}

async function checkExposeHeadersFromMain(params) {
    const { isCitizen, jwtToken: jwtOverride } = params;
    const jwtToken = jwtOverride || getMainProcessJwt();
    if (!jwtToken) return { ok: false, reason: 'no_jwt' };

    try {
        const res = await postToDesktopApi('/api/desktop/check-expose-headers', jwtToken, {
            isCitizen,
            exposeHeaders: 'response_header_Access-Control-Expose-Headers',
        });
        const result = parseJsonResponse(res, 'expose');
        if (!result) return { ok: false, reason: 'invalid_json' };

        return { ok: !!result.success, result };
    } catch (err) {
        captchaLog('error', 'EXPOSE', 'checkExposeHeaders алдаа', { error: err.message });
        return { ok: false, reason: err.message };
    }
}

module.exports = {
    insertKhanBankCookiesFromMain,
    checkExposeHeadersFromMain,
};
