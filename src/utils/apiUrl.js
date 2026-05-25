const { API_CONFIG } = require('./constants');
const { resolveApiBaseUrl } = require('../config/runtimeApiConfig');

/**
 * Renderer/main-д ашиглах API base URL (main preload-ээс ирсэн URL давуу).
 */
function getApiUrl() {
    if (typeof window !== 'undefined' && window.electron?.apiBaseUrl) {
        return window.electron.apiBaseUrl;
    }
    return resolveApiBaseUrl();
}

module.exports = { getApiUrl, DEFAULT_DEV_API: process.env.API_BASE_URL_DEV || 'http://103.168.56.34:3130' };
