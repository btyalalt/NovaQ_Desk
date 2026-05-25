/**
 * Dev / Prod — нэг л логик. Зөвхөн API host өөрчлөгдөнө.
 *
 * NOVAQ_API_TARGET=prod  → https://novaq.mn:3119 (эсвэл API_BASE_URL)
 * NOVAQ_API_TARGET=dev   → http://103.168.56.34:3130 (эсвэл API_BASE_URL_DEV)
 * (хоосон) packaged .exe → prod; npm run dev (--dev) → dev
 */
const PROD_DEFAULT = 'https://novaq.mn:3119';
const DEV_DEFAULT = 'http://103.168.56.34:3130';

function readForcedTarget() {
    const t = String(process.env.NOVAQ_API_TARGET || '').trim().toLowerCase();
    if (t === 'prod' || t === 'production') return 'prod';
    if (t === 'dev' || t === 'development') return 'dev';
    return null;
}

/** Webpack/renderer-д electron require хийхгүй (зөвхөн main.js app.isPackaged дамжуулна) */
function isPackagedApp() {
    if (typeof process === 'undefined') return false;
    if (process.argv?.includes('--dev')) return false;

    const execPath = String(process.execPath || '');
    if (/node_modules[\\/]electron/i.test(execPath)) return false;

    if (/NovaQ_Desk\.exe|NovaQ Desktop\.exe/i.test(execPath)) return true;
    if (process.defaultApp === false && process.versions?.electron) return true;

    return false;
}

function isDevCli() {
    return (
        process.argv?.includes('--dev') ||
        (process.env.NODE_ENV === 'development' && !isPackagedApp())
    );
}

/**
 * @param {{ packaged?: boolean }} [opts]
 */
function resolveApiBaseUrl(opts = {}) {
    const forced = readForcedTarget();
    const prodUrl = (process.env.API_BASE_URL || PROD_DEFAULT).trim();
    const devUrl = (process.env.API_BASE_URL_DEV || DEV_DEFAULT).trim();

    if (forced === 'prod') return prodUrl;
    if (forced === 'dev') return devUrl;

    const packaged = opts.packaged !== undefined ? opts.packaged : isPackagedApp();
    if (packaged) return prodUrl;
    if (isDevCli()) return devUrl;
    return prodUrl;
}

function resolveWsBaseUrl(apiBaseUrl) {
    return String(apiBaseUrl || resolveApiBaseUrl()).replace(/^http/i, 'ws');
}

function getRuntimeLabel(apiBaseUrl) {
    const url = apiBaseUrl || resolveApiBaseUrl();
    const devUrl = (process.env.API_BASE_URL_DEV || DEV_DEFAULT).trim();
    return url === devUrl || url.includes('103.168.56.34') ? 'DEV' : 'PROD';
}

function logRuntimeApi(context = 'APP') {
    const url = resolveApiBaseUrl();
    const target = readForcedTarget() || (isDevCli() ? 'auto→dev' : 'auto→prod');
    console.log(`[${context}] API ${getRuntimeLabel(url)} ${url} (NOVAQ_API_TARGET=${target})`);
}

module.exports = {
    PROD_DEFAULT,
    DEV_DEFAULT,
    resolveApiBaseUrl,
    resolveWsBaseUrl,
    getRuntimeLabel,
    isDevCli,
    isPackagedApp,
    logRuntimeApi,
};
