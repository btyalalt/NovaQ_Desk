// Constants - This will be updated dynamically from SysConfigurations
// Get version from package.json
const getPackageVersion = () => {
  try {
    // In Node.js environment (main process)
    if (typeof require !== 'undefined') {
      const packageJson = require('../../package.json');
      return packageJson.version;
    }
  } catch (error) {
    console.log('⚠️ Could not load package.json version:', error.message);
  }
  return '1.0.0'; // Fallback version
};

const VERSION = process.env.APP_VERSION || getPackageVersion(); // Dynamic version from environment or package.json
const DEV_API_BASE_URL = process.env.API_BASE_URL_DEV || 'http://localhost:3119';
const PROD_API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3119';
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
const BUFFER_TIME = 30 * 1000; // 30 seconds

// Check if we're in development mode - exclude portable mode
const isPortableMode = process.execPath && process.execPath.includes('NovaQ Desktop.exe');
const isElectronApp = typeof window !== 'undefined' && window.electron;
const isDevelopment = !isPortableMode && !isElectronApp && (
                     process.env.NODE_ENV === 'development' || 
                     process.argv.includes('--dev') ||
                     (typeof window !== 'undefined' && window.location.hostname === 'localhost') ||
                     (typeof window !== 'undefined' && window.location.protocol === 'file:' && 
                      (window.location.pathname.includes('src') || window.location.pathname.includes('dev')))
);

// Debug logging - only log once per session (check if we're in browser or main process)
const isBrowser = typeof window !== 'undefined';
const constantsLoggedKey = isBrowser ? 'constantsLogged' : '__constantsLogged__';
const globalObj = isBrowser ? window : global;

if (!globalObj[constantsLoggedKey]) {
  globalObj[constantsLoggedKey] = true;
  console.log('🔍 [CONSTANTS] Environment detection:');
  console.log('🔍 [CONSTANTS] NODE_ENV:', process.env.NODE_ENV);
  console.log('🔍 [CONSTANTS] APP_VERSION:', process.env.APP_VERSION);
  console.log('🔍 [CONSTANTS] VERSION:', VERSION);
  console.log('🔍 [CONSTANTS] process.argv:', process.argv);
  console.log('🔍 [CONSTANTS] isDevelopment:', isDevelopment);
}

// API Configuration
let API_CONFIG = {
  BASE_URL: isDevelopment ? DEV_API_BASE_URL : PROD_API_BASE_URL
};

if (!globalObj[constantsLoggedKey]) {
  console.log('🔍 [CONSTANTS] API_CONFIG.BASE_URL:', API_CONFIG.BASE_URL);
}



const STORAGE_KEYS = {
  API_URL: 'novaq_api_url',
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  TOKEN_EXPIRY: 'token_expiry_time',
  BANK_CREDENTIALS: 'bank_credentials',
  DEVICE_ID: 'deviceId',
  USER_OID: 'userOid',
  SAVED_USERNAME: 'savedUsername',
  SAVED_PASSWORD: 'savedPassword',
  SESSION_REFRESH_COUNT: 'session_refresh_count',
  SESSION_START_TIME: 'session_start_time'
};

const REFRESH_CONFIG = {
  WINDOW_MS: 35 * 1000,
  MAX_WINDOW_MS: 45 * 1000,
  RANDOM_INTERVAL_MS: 60 * 1000,
  MAX_RANDOM_INTERVAL_MS: 120 * 1000
};

const getRandomRefreshWindow = () => {
  const minMs = 35_000; // 35 seconds
  const maxMs = 45_000; // 45 seconds
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
};

const REFRESH_WINDOW_MS = getRandomRefreshWindow();

const tokenKey = (customerId) => `NQ_TOKEN_${customerId}`;

// Update API config function
const updateApiConfig = (newConfig) => {
  API_CONFIG = newConfig;
};

// CommonJS exports
module.exports = {
  VERSION,
  DEFAULT_USER_AGENT,
  BUFFER_TIME,
  API_CONFIG,
  STORAGE_KEYS,
  REFRESH_CONFIG,
  getRandomRefreshWindow,
  REFRESH_WINDOW_MS,
  tokenKey,
  updateApiConfig
};
