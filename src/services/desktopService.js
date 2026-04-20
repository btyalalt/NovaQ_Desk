const { API_CONFIG } = require('../utils/constants');
const { getJWTToken } = require('./apiService');
const https = require('https');
const http = require('http');

const getApiUrl = () => {
    // Check if we're in Electron environment
    if (typeof window !== 'undefined' && window.electron) {
        // Check environment to determine API URL
        const isDevelopment = process.env.NODE_ENV === 'development' ||
            (typeof process !== 'undefined' && process.argv && process.argv.includes('--dev'));

        if (isDevelopment) {
            return 'http://localhost:3101';
        } else {
            return 'http://103.168.56.34:3101';
        }
    }

    // In browser environment (non-Electron), check if we're on localhost
    if (typeof window !== 'undefined' && !window.electron && typeof process !== 'undefined') {
        const isRealDevelopment = process.env.NODE_ENV === 'development' &&
            !process.execPath.includes('electron');

        if (isRealDevelopment &&
            (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
            return 'http://localhost:3101';
        }
    }

    // Use production URL or configured URL
    return API_CONFIG.BASE_URL;
};
// Main process-д JWT token авах функц
function getJWTTokenForMainProcess() {
  // Main process-д global.currentAuthToken ашиглах
  if (typeof global !== 'undefined' && global.currentAuthToken) {
    return global.currentAuthToken;
  }
  global.currentAuthToken = getJWTToken();
  // Renderer process-д localStorage ашиглах
  return getJWTToken();
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
    this.baseUrl = API_CONFIG.BASE_URL;
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

  // ✅ KhanBank Cookies хадгалах
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
        isResponseHeader
      } = params;

      if (!url) {
        console.warn('⚠️ URL өгөгдөөгүй');
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
      
      if (typeof fetch !== 'undefined') {
        console.log('🔧 Using fetch for KhanBank cookies API call');
        response = await fetch(`${this.baseUrl}/api/desktop/insert-khanbank-cookies`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getJWTTokenForMainProcess()}`
          },
          body: JSON.stringify(requestData)
        });
      } else {
        console.log('🔧 Using https module for KhanBank cookies API call');
        response = await httpsRequest(`${this.baseUrl}/api/desktop/insert-khanbank-cookies`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getJWTTokenForMainProcess()}`
          }
        }, requestData);
      }

      if (response.ok) {
        const result = await response.json();
        console.log('✅ KhanBank cookies хадгалагдлаа:', result);
        return true;
      } else {
        console.error('❌ Server-ээс cookies хадгалахад алдаа:', response.status);
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
    const { isCitizen, exposeHeaders } = params;
    try {
      const jwtToken = getJWTTokenForMainProcess();
      console.log('🔍 checkExposeHeaders JWT token:', jwtToken);
      
      if (!jwtToken) {
        throw new Error('JWT token байхгүй байна');
      }
      
      // Try fetch first, fallback to https module
      let response;
      const requestData = { isCitizen, exposeHeaders };
      
      if (typeof fetch !== 'undefined') {
        console.log('🔧 Using fetch for expose headers API call');
        response = await fetch(`${this.baseUrl}/api/desktop/check-expose-headers`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwtToken}`
          },
          body: JSON.stringify(requestData)
        });
      } else {
        console.log('🔧 Using https module for expose headers API call');
        response = await httpsRequest(`${this.baseUrl}/api/desktop/check-expose-headers`, {
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
      console.error('❌ Expose-Headers шалгахад алдаа:', error);
      throw error;
    }
  }

}

module.exports = DesktopService;
