const { API_CONFIG } = require('./constants');

const DEFAULT_DEV_API = 'http://103.168.56.34:3130';

/**
 * Renderer/main-д ашиглах API base URL.
 * Electron dev: main process .env-ээс (preload apiBaseUrl).
 * Бусад: webpack DefinePlugin эсвэл constants.
 */
function getApiUrl() {
  if (typeof window !== 'undefined' && window.electron?.apiBaseUrl) {
    return window.electron.apiBaseUrl;
  }

  const isDevelopment =
    process.env.NODE_ENV === 'development' ||
    (typeof process !== 'undefined' && process.argv && process.argv.includes('--dev'));

  if (typeof window !== 'undefined' && window.electron && isDevelopment) {
    return process.env.API_BASE_URL_DEV || DEFAULT_DEV_API;
  }

  if (typeof window !== 'undefined' && !window.electron && typeof process !== 'undefined') {
    const isRealDevelopment =
      process.env.NODE_ENV === 'development' &&
      !process.execPath?.includes?.('electron');

    if (
      isRealDevelopment &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ) {
      return process.env.API_BASE_URL_DEV || DEFAULT_DEV_API;
    }
  }

  if (isDevelopment) {
    return process.env.API_BASE_URL_DEV || DEFAULT_DEV_API;
  }

  return API_CONFIG.BASE_URL;
}

module.exports = { getApiUrl, DEFAULT_DEV_API };
