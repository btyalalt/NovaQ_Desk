/**
 * Зөвхөн main process модулиуд (cookie-collector, main.js) ашиглана.
 * Webpack bundle-д оруулахгүй — electron-store ашиглана.
 */
function getMainProcessJwt() {
  if (typeof global !== 'undefined' && global.currentAuthToken) {
    return global.currentAuthToken;
  }

  try {
    const Store = require('electron-store');
    const token = new Store().get('jwt_token');
    if (token && typeof global !== 'undefined') {
      global.currentAuthToken = token;
    }
    return token || null;
  } catch (e) {
    console.warn('[mainJwt] JWT уншихад алдаа:', e.message);
    return null;
  }
}

module.exports = { getMainProcessJwt };
