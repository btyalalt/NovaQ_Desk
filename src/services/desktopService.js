const { API_CONFIG } = require('../utils/constants');
const { getApiUrl } = require('../utils/apiUrl');
const { getJWTToken } = require('./apiService');

let captchaLog = () => {};
try {
  ({ captchaLog } = require('../utils/captchaDebugLog'));
} catch (_) { /* renderer webpack — optional */ }
const https = require('https');
const http = require('http');
// JWT: renderer → localStorage; main → global (cookie-collector mainJwt.js ашиглана)
function getJWTTokenForMainProcess() {
  if (typeof global !== 'undefined' && global.currentAuthToken) {
    return global.currentAuthToken;
  }

  const rendererToken = getJWTToken();
  if (rendererToken && typeof global !== 'undefined') {
    global.currentAuthToken = rendererToken;
  }

  return rendererToken || null;
}

// HTTPS module ашиглаж API дуудах функц
function httpsRequest(url, options, data = null) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const urlObj = new URL(url);
    
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      // TLS options for HTTPS
      rejectUnauthorized: false,
      secureProtocol: 'TLSv1_2_method'
    };

    const req = lib.request(reqOptions, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(responseData);
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            json: () => Promise.resolve(jsonData),
            data: jsonData
          });
        } catch (error) {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            json: () => Promise.resolve({ message: responseData }),
            data: { message: responseData }
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}


class DesktopService {


  constructor() {
    this.baseUrl = getApiUrl();
  }

  // ✅ KhanBank Cookies цэвэрлэх
  async clearKhanBankCookiesFromServer(cookieTypes = ['response_headers', 'request_headers', 'request_payload', 'response_payload']) {
    try {
      const jwtToken = getJWTTokenForMainProcess();

      const apiBaseUrl = getApiUrl();
      console.log(`clearKhanBankCookiesFromServer() ${this.baseUrl} new apiBaseUrl : ${apiBaseUrl}`)
      if (!jwtToken) {
        throw new Error('JWT token байхгүй байна');
      }
      
      // Skip fetch calls in main process to prevent errors
      if (typeof fetch === 'undefined') {
        console.log('ℹ️ Fetch not available, skipping API call');
        return { success: false, message: 'Fetch not available' };
      }


      const response = await fetch(`${apiBaseUrl}/api/desktop/clear-khanbank-cookies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtToken}`
        },
        body: JSON.stringify({
          cookieTypes: cookieTypes
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ KhanBank cookies амжилттай цэвэрлэгдлээ:', data);
      return data;
    } catch (error) {
      console.error('❌ KhanBank cookies цэвэрлэхэд алдаа:', error.message);
      // Don't throw error to prevent app crash, just log and continue
      console.log('ℹ️ KhanBank cookies алдааг анхааралгүй үлдээж байна (network issue)');
      return { success: false, message: 'Network connection failed' };
    }
  }

  // ✅ KhanBank Cookies хадгалах (зөвхөн renderer/webpack). CAPTCHA insert → khanBankCookieInsert.js (main)
  async insertKhanBankCookiesToServer(params) {
    try {
      const {
        isCitizen,
        url,
        headers,
        deviceId,
        userAgent,
        username,
        password,
        bankAccountNum,
        requestPayload,
        responsePayload,
        isResponseHeader,
        jwtToken: jwtOverride,
      } = params;

      if (!url) {
        console.warn('⚠️ URL өгөгдөөгүй');
        return false;
      }

      const jwtToken = jwtOverride || getJWTTokenForMainProcess();
      if (!jwtToken) {
        // Skip cookie sync until auth token is available to avoid noisy 401 loops.
        console.warn('⚠️ JWT token байхгүй тул cookies sync түр алгасав');
        return false;
      }

      // Try fetch first, fallback to https module
      let response;
      const requestData = {
        isCitizen,
        url,
        headers,
        deviceId,
        userAgent,
        username,
        password,
        bankAccountNum,
        requestPayload,
        responsePayload,
        isResponseHeader
      };
      
      const apiBaseUrl = getApiUrl();
      const fromCaptcha = !!jwtOverride;
      if (fromCaptcha) {
        captchaLog('info', 'API', 'insert-khanbank-cookies дуудаж байна', {
          apiBaseUrl,
          url,
          bankAccountNum,
          headerKeys: headers ? Object.keys(headers).length : 0,
          hasRequestPayload: !!requestPayload,
          hasResponsePayload: !!responsePayload,
        });
      }

      if (typeof fetch !== 'undefined') {
        if (!fromCaptcha) console.log('🔧 Using fetch for KhanBank cookies API call');
        response = await fetch(`${apiBaseUrl}/api/desktop/insert-khanbank-cookies`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwtToken}`
          },
          body: JSON.stringify(requestData)
        });
      } else {
        console.log('🔧 Using https module for KhanBank cookies API call');
        response = await httpsRequest(`${apiBaseUrl}/api/desktop/insert-khanbank-cookies`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwtToken}`
          }
        }, requestData);
      }

      if (response.ok) {
        const result = await response.json();
        const count = result?.insertedCount ?? 0;
        if (fromCaptcha) {
          captchaLog(count > 0 ? 'ok' : 'warn', 'API', 'insert хариу', {
            insertedCount: count,
            dataTypes: result?.dataTypes,
            message: result?.message,
          });
        } else if (count > 0) {
          console.log('✅ KhanBank cookies хадгалагдлаа:', result);
        } else {
          console.warn('⚠️ KhanBank cookies API OK гэхдээ insertedCount=0:', result);
        }
        return count > 0;
      } else {
        const errText = await response.text().catch(() => '');
        if (fromCaptcha) {
          captchaLog('error', 'API', 'insert HTTP алдаа', { status: response.status, errText });
        } else {
          console.error('❌ Server-ээс cookies хадгалахад алдаа:', response.status, errText);
        }
        return false;
      }
    } catch (error) {
      console.error('❌ KhanBank cookies хадгалахад алдаа:', error.message);
      console.log('ℹ️ KhanBank cookies алдааг анхааралгүй үлдээж байна (network issue)');
      return false;
    }
  }


  // ✅ Expose-Headers шалгаж, CustomerBankCookiesUpdate процедур дуудах
  async checkExposeHeaders(params) {
    const { isCitizen, exposeHeaders, jwtToken: jwtOverride } = params;
    try {
      const jwtToken = jwtOverride || getJWTTokenForMainProcess();
      console.log('🔍 checkExposeHeaders JWT token:', jwtToken);
      
      if (!jwtToken) {
        console.warn('⚠️ JWT token байхгүй тул expose-headers шалгалт алгасав');
        return { success: false, skipped: true, reason: 'missing_jwt' };
      }
      
      const apiBaseUrl = getApiUrl();
      let response;
      const requestData = { isCitizen, exposeHeaders };
      
      if (typeof fetch !== 'undefined') {
        console.log('🔧 Using fetch for expose headers API call');
        response = await fetch(`${apiBaseUrl}/api/desktop/check-expose-headers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwtToken}`
          },
          body: JSON.stringify(requestData)
        });
      } else {
        console.log('🔧 Using https module for expose headers API call');
        response = await httpsRequest(`${apiBaseUrl}/api/desktop/check-expose-headers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwtToken}`
          }
        }, requestData);
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Expose-Headers шалгагдлаа:', data);
      return data;
    } catch (error) {
      console.error('❌ Expose-Headers шалгахад алдаа:', error.message || error);
      return { success: false, skipped: true, reason: 'request_failed' };
    }
  }

}

module.exports = DesktopService;
