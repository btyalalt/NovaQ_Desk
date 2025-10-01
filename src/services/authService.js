import { saveUser } from '../utils/userStorage';
import { saveJWTToken, clearJWTToken, getJWTToken } from './apiService';
import { API_CONFIG } from '../utils/constants';
import packageJson from '../../package.json';

// Get fetch function based on environment
const getFetch = () => {
  if (typeof window !== 'undefined' && window.fetch) {
    // Browser environment - use native fetch
    return window.fetch.bind(window);
  } else {
    // Node.js environment - this should not happen in webpack bundle
    throw new Error('fetch not available in this environment');
  }
};

class AuthService {
  constructor() {
    this.currentUser = null;
  }

  // Get correct API URL based on environment
  getApiUrl() {
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
  }

  static getInstance() {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }
  async saveLoginHistory(credentials) {
    try {
      console.log('🔍 [MAIN] Saving login history with credentials:', {
        userName: credentials.userName,
        clientIP: credentials.clientIP,
        computerName: credentials.computerName,
        systemName: credentials.systemName
      });

      const fetchFn = getFetch();
      const apiUrl = this.getApiUrl();
      console.log('🔍 [MAIN] API URL for login history:', apiUrl);

      const response = await fetchFn(`${apiUrl}/api/desktop/login-history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getJWTToken()}`
        },
        body: JSON.stringify({
          userName: credentials.userName,
          clientIP: credentials.clientIP,
          computerName: credentials.computerName,
          systemName: credentials.systemName,
          DesktopVersion: credentials.DesktopVersion || packageJson.version
        })
      });

      console.log('🔍 [MAIN] Login history response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [MAIN] Login history server error:', response.status, errorText);
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ [MAIN] Login history inserted successfully:', result);
      return result;
    } catch (error) {
      console.error('❌ [MAIN] Error inserting login history:', error);
      return { success: false, message: error.message };
    }
  }
  async saveLogoutHistory(credentials) {
    try {
      // Server logout endpoint-ийн шаардлагатай 3 талбар
      const payload = {
        userName: credentials.userName,
        computerName: credentials.computerName,
        DesktopVersion: credentials.DesktopVersion || packageJson.version
      };

      console.log('🔍 [MAIN] Logout history payload:', payload);

      const fetchFn = getFetch();
      const apiUrl = this.getApiUrl();
      console.log('🔍 [MAIN] API URL for logout history:', apiUrl);

      const response = await fetchFn(`${apiUrl}/api/desktop/logout-history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getJWTToken()}`
        },
        body: JSON.stringify(payload)
      });

      console.log('🔍 [MAIN] Logout history payload:', {  
        userName: credentials.userName,
        computerName: credentials.computerName,
        DesktopVersion: credentials.DesktopVersion || packageJson.version
      });

      console.log('🔍 [MAIN] Logout history response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('✅ [MAIN] Logout history saved successfully:', result);
        clearJWTToken();
        return { success: true, message: 'Logout history saved successfully' };
      } else {
        const errorText = await response.text();
        console.error('❌ [MAIN] Logout history server error:', response.status, response.statusText);
        console.error('❌ [MAIN] Server response:', errorText);
        console.error('❌ [MAIN] Sent payload:', JSON.stringify(payload, null, 2));
        
        // Parse server error message
        try {
          const errorJson = JSON.parse(errorText);
          console.error('❌ [MAIN] Server error message:', errorJson.message);
        } catch (parseError) {
          console.error('❌ [MAIN] Raw server response:', errorText);
        }
        
        return { success: false, message: `Server error: ${response.status} - ${errorText}` };
      }
    } catch (error) {
      console.error('❌ [MAIN] Logout history хадгалахад алдаа:', error);
      return { success: false, message: error.message };
    }
  }
  async login(credentials) {
    try {
      // Call the server API to authenticate
      console.log("credentials", credentials);
      
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const fetchFn = getFetch();
      const response = await fetchFn(`${this.getApiUrl()}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      console.log('🔍 Login response status:', response.status);

      if (!response.ok) {
        // Handle HTTP error responses
        // Backend-ээс ирсэн message-ийг шууд харуулдаг болгов
        let errorMessage = 'Нэвтрэх амжилтгүй';
        try {
          const errorText = await response.text();
          // Try to parse JSON error
          let errorJson;
          try {
            errorJson = JSON.parse(errorText);
          } catch (e) {
            errorJson = null;
          }
          if (errorJson && errorJson.message) {
            errorMessage = errorJson.message;
          } else if (typeof errorText === 'string' && errorText.trim().length > 0) {
            errorMessage = errorText;
          }
        } catch (e) {
          // fallback
          errorMessage = 'Нэвтрэх амжилтгүй';
        }
        
        return {
          success: false,
          message: errorMessage,
          status: response.status
        };
      }

      const result = await response.json();

      if (result.success) {
        this.currentUser = result.user;

        // Save user data to userStorage
        if (result.user && result.user.username) {
          try {
            // Save ALL user data and CustomerBankAccount data to userStorage
            const allUserData = {
              // User data
              UserName: result.user.username,
              FirstName: result.user.firstName,
              LastName: result.user.lastName,
              oid: result.user.oid,
              roleOid: result.user.roleOid,
              isCitizen: result.user.isCitizen,
              customers: result.user.customers,
              accountant: result.user.accountant,
              employee: result.user.employee,

              // CustomerBankAccount data (if available)
              ...(result.customerBankAccount && {
                // Bank account details
                bankAccountNum: result.customerBankAccount.bankAccountNum,
                bankUserName: result.customerBankAccount.bankUserName,
                bankPassword: result.customerBankAccount.bankPassword,
                deviceId: result.customerBankAccount.deviceId,

                // Bank configuration
                customerId: result.customerBankAccount.customerId,
                userId: result.customerBankAccount.userId,
                bankId: result.customerBankAccount.bankId,
                isCitizen: result.customerBankAccount.isCitizen,

                // CAPTCHA and OTP settings
                captchaClose: result.customerBankAccount.captchaClose,
                otpy: result.customerBankAccount.otpy,

                // HTTP headers and configuration
                accept: result.customerBankAccount.accept,
                acceptEncoding: result.customerBankAccount.acceptEncoding,
                acceptLanguage: result.customerBankAccount.acceptLanguage,
                appVersion: result.customerBankAccount.appVersion,
                contentType: result.customerBankAccount.contentType,
                cookie: result.customerBankAccount.cookie,
                origin: result.customerBankAccount.origin,
                referer: result.customerBankAccount.referer,
                secChUa: result.customerBankAccount.secChUa,
                secChUaMobile: result.customerBankAccount.secChUaMobile,
                secChUaPlatform: result.customerBankAccount.secChUaPlatform,
                secFetchDest: result.customerBankAccount.secFetchDest,
                secFetchMode: result.customerBankAccount.secFetchMode,
                secFetchSite: result.customerBankAccount.secFetchSite,
                secure: result.customerBankAccount.secure,
                userAgent: result.customerBankAccount.userAgent,

                // Token information
                accessToken: result.customerBankAccount.accessToken,
                refreshToken: result.customerBankAccount.refreshToken,
                tokenExpiresAt: result.customerBankAccount.tokenExpiresAt,
                refreshTokenExpiresAt: result.customerBankAccount.refreshTokenExpiresAt,
                lastTokenUpdate: result.customerBankAccount.lastTokenUpdate,

                // Legacy field mappings for compatibility
                BankAccountnum: result.customerBankAccount.bankAccountNum,
                bank_UserName: result.customerBankAccount.bankUserName,
                DeviceID: result.customerBankAccount.deviceID
              })
            };

            await saveUser(result.user.username, allUserData);
            console.log('✅ ALL user data saved to userStorage:', result.user.username);
            console.log('📊 Data saved includes:', Object.keys(allUserData).length, 'fields');
            console.log('🏦 CustomerBankAccount fields:', result.customerBankAccount ? Object.keys(result.customerBankAccount).length : 0);
          } catch (error) {
            console.error('❌ Error saving user data:', error);
          }
        }

        // Store token and user data in electron-store
        if (window.electron) {
          await window.electron.invoke('store-set', 'authToken', result.token);
          await window.electron.invoke('store-set', 'currentUser', result.user);

          // Store CustomerBankAccount data if available
          if (result.customerBankAccount) {
            await window.electron.invoke('store-set', 'customerBankAccount', result.customerBankAccount);
            console.log('✅ CustomerBankAccount data saved:', result.customerBankAccount);
          }
        }
        console.log('🔍 result.token:', result);
        // JWT token-ыг localStorage-д хадгалах
        if (result.token) {
          try {
            saveJWTToken(result.token);
            console.log('✅ JWT token localStorage-д хадгалагдлаа');
          } catch (error) {
            console.error('❌ JWT token хадгалахад алдаа:', error);
          }
        }
      }

      return result;
    } catch (error) {
      console.error('Login error:', error);
      
      let errorMessage = 'Network error. Please check your connection.';
      
      if (error.name === 'AbortError') {
        errorMessage = 'Connection timeout. Please check your network connection.';
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Cannot connect to server. Please check your internet connection.';
      } else if (error.message.includes('ERR_CONNECTION_TIMED_OUT')) {
        errorMessage = 'Connection timed out. Server may be unavailable.';
      } else if (error.message.includes('ETIMEDOUT')) {
        errorMessage = 'Server is not responding. Please check if the server is running.';
      } else if (error.message.includes('ECONNREFUSED')) {
        errorMessage = 'Connection refused. Server may be down or not accessible.';
      } else if (error.message.includes('ENOTFOUND')) {
        errorMessage = 'Server not found. Please check the server address.';
      }
      
      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  async getCurrentUser() {
    if (this.currentUser) {
      return this.currentUser;
    }

    // Try to get from storage
    if (window.electron) {
      const storedUser = await window.electron.invoke('store-get', 'currentUser');
      if (storedUser) {
        this.currentUser = storedUser;
        return storedUser;
      }
    }

    return null;
  }

  async getToken() {
    if (window.electron) {
      return await window.electron.invoke('store-get', 'authToken');
    }
    return null;
  }

  async getCustomerBankAccount() {
    if (window.electron) {
      return await window.electron.invoke('store-get', 'customerBankAccount');
    }
    return null;
  }

  async refreshUserData() {
    try {
      const token = await getJWTToken();
      if (!token) {
        console.log('⚠️ No auth token available for refresh');
        return null;
      }
      console.log('🔍 token:', token);
      
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const fetchFn = getFetch();
      const response = await fetchFn(`${this.getApiUrl()}/api/auth/verify`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (response.ok) {
        const result = await response.json();

        // Save ALL refreshed data to userStorage
        if (result.user && result.user.username) {
          try {
            const allUserData = {
              // User data
              UserName: result.user.username,
              FirstName: result.user.firstName,
              LastName: result.user.lastName,
              oid: result.user.oid,
              roleOid: result.user.roleOid,
              isCitizen: result.user.isCitizen,
              customers: result.user.customers,
              accountant: result.user.accountant,
              employee: result.user.employee,

              // CustomerBankAccount data (if available)
              ...(result.customerBankAccount && {
                // Bank account details
                bankAccountNum: result.customerBankAccount.bankAccountNum,
                bankUserName: result.customerBankAccount.bankUserName,
                bankPassword: result.customerBankAccount.bankPassword,
                deviceId: result.customerBankAccount.deviceId,

                // Bank configuration
                customerId: result.customerBankAccount.customerId,
                userId: result.customerBankAccount.userId,
                bankId: result.customerBankAccount.bankId,
                isCitizen: result.customerBankAccount.isCitizen,

                // CAPTCHA and OTP settings
                captchaClose: result.customerBankAccount.captchaClose,
                otpy: result.customerBankAccount.otpy,

                // HTTP headers and configuration
                accept: result.customerBankAccount.accept,
                acceptEncoding: result.customerBankAccount.acceptEncoding,
                acceptLanguage: result.customerBankAccount.acceptLanguage,
                appVersion: result.customerBankAccount.appVersion,
                contentType: result.customerBankAccount.contentType,
                cookie: result.customerBankAccount.cookie,
                origin: result.customerBankAccount.origin,
                referer: result.customerBankAccount.referer,
                secChUa: result.customerBankAccount.secChUa,
                secChUaMobile: result.customerBankAccount.secChUaMobile,
                secChUaPlatform: result.customerBankAccount.secChUaPlatform,
                secFetchDest: result.customerBankAccount.secFetchDest,
                secFetchMode: result.customerBankAccount.secFetchMode,
                secFetchSite: result.customerBankAccount.secFetchSite,
                secure: result.customerBankAccount.secure,
                userAgent: result.customerBankAccount.userAgent,

                // Token information
                accessToken: result.customerBankAccount.accessToken,
                refreshToken: result.customerBankAccount.refreshToken,
                tokenExpiresAt: result.customerBankAccount.tokenExpiresAt,
                refreshTokenExpiresAt: result.customerBankAccount.refreshTokenExpiresAt,
                lastTokenUpdate: result.customerBankAccount.lastTokenUpdate,

                // Legacy field mappings for compatibility
                BankAccountnum: result.customerBankAccount.bankAccountNum,
                bank_UserName: result.customerBankAccount.bankUserName,
                DeviceID: result.customerBankAccount.deviceID
              })
            };

            await saveUser(result.user.username, allUserData);
            console.log('✅ ALL refreshed user data saved to userStorage:', result.user.username);
            console.log('📊 Refreshed data includes:', Object.keys(allUserData).length, 'fields');
          } catch (error) {
            console.error('❌ Error saving refreshed user data:', error);
          }
        }

        // Update stored data in electron-store
        if (window.electron) {
          await window.electron.invoke('store-set', 'currentUser', result.user);
          if (result.customerBankAccount) {
            await window.electron.invoke('store-set', 'customerBankAccount', result.customerBankAccount);
          }
        }

        // Update current user
        this.currentUser = result.user;

        console.log('✅ User data refreshed successfully');
        return result;
      } else {
        console.log('⚠️ Failed to refresh user data');
        return null;
      }
    } catch (error) {
      console.error('❌ Error refreshing user data:', error);
      
      if (error.name === 'AbortError') {
        console.error('❌ User data refresh timeout');
      } else if (error.message.includes('Failed to fetch')) {
        console.error('❌ Cannot connect to server for user data refresh');
      } else if (error.message.includes('ETIMEDOUT')) {
        console.error('❌ Server not responding for user data refresh');
      } else if (error.message.includes('ECONNREFUSED')) {
        console.error('❌ Connection refused for user data refresh');
      } else if (error.message.includes('ENOTFOUND')) {
        console.error('❌ Server not found for user data refresh');
      }
      
      return null;
    }
  }

  async isAuthenticated() {
    const token = await getJWTToken();
    if (!token) return false;

    try {
      // Verify token with server
      const fetchFn = getFetch();
      const response = await fetchFn(`${this.getApiUrl()}/api/auth/verify`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Token verification error:', error);
      return false;
    }
  }

  async refreshToken() {
    try {
      const token = await getJWTToken();
      if (!token) return false;

      const fetchFn = getFetch();
      const response = await fetchFn(`${this.getApiUrl()}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (window.electron) {
          await window.electron.invoke('store-set', 'authToken', result.token);
        }
        return true;
      }

      return false;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  }
}

export default AuthService.getInstance();
