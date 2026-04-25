const { API_CONFIG  } = require('../utils/constants');

// Get correct API URL based on environment
const getApiUrl = () => {
  // Check if we're in Electron environment
  if (typeof window !== 'undefined' && window.electron) {
    // Check environment to determine API URL
    const isDevelopment = process.env.NODE_ENV === 'development' || 
                         (typeof process !== 'undefined' && process.argv && process.argv.includes('--dev'));
    
    if (isDevelopment) {
      return process.env.API_BASE_URL_DEV || API_CONFIG.BASE_URL;
    } else {
      return API_CONFIG.BASE_URL;
    }
  }
  
  // In browser environment (non-Electron), check if we're on localhost
  if (typeof window !== 'undefined' && !window.electron && typeof process !== 'undefined') {
    const isRealDevelopment = process.env.NODE_ENV === 'development' && 
                              !process.execPath.includes('electron');
    
    if (isRealDevelopment && 
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
      return process.env.API_BASE_URL_DEV || API_CONFIG.BASE_URL;
    }
  }

  // Use production URL or configured URL
  return API_CONFIG.BASE_URL;
};

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

// JWT token хадгалах функц
const saveJWTToken = (token) => {
  try {
    console.log('🔍 saveJWTToken token:', token);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem('jwt_token', token);
      window.localStorage.setItem('auth_token', token); // Backup
      console.log('✅ JWT token localStorage-д хадгалагдлаа');
    } else {
      console.log('⚠️ localStorage боломжгүй, token хадгалахгүй');
    }
  } catch (error) {
    console.error('❌ JWT token хадгалахад алдаа:', error);
  }
};

// JWT token авах функц
const getJWTToken = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem('jwt_token') || window.localStorage.getItem('auth_token');
  }
  return null;
};

// JWT token хасах функц
const clearJWTToken = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('jwt_token');
      window.localStorage.removeItem('auth_token');
      global.currentAuthToken = null;
      console.log('✅ JWT token localStorage-с хасагдлаа');
    }

  } catch (error) {
    console.error('❌ JWT token хасахад алдаа:', error);
  }
};


// JWT token авах (login хийх үед)
const getJWTTokenFromServer = async (username, password) => {
  try {
    console.log('🔐 JWT token авах хүсэлт илгээж байна...');

    const apiBaseUrl = getApiUrl();

    const fetchFn = getFetch();
    const response = await fetchFn(`${apiBaseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      throw new Error(`Login API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.success && data.token) {
      // JWT token-ыг localStorage-д хадгалах
      saveJWTToken(data.token);
      return {
        success: true,
        token: data.token,
        user: data.user
      };
    } else {
      throw new Error(data.errorMessage || 'Login амжилтгүй');
    }

  } catch (error) {
    console.error('❌ JWT token авахад алдаа:', error);
    return {
      success: false,
      token: null,
      user: null,
      errorMessage: error.message || 'Login хийхэд алдаа гарлаа'
    };
  }
};

// Get token and store
// Track if getTokenAndStore is currently running to prevent duplicate calls
let getTokenAndStoreRunning = false;

const getTokenAndStore = async (userOid) => {
    if (getTokenAndStoreRunning) {
        return {
            success: false,
            errorMessage: 'Token авах процесс аль хэдийн ажиллаж байна',
            isDuplicate: true
        };
    }

    getTokenAndStoreRunning = true;
    try {
        const apiBaseUrl = getApiUrl();
        const jwtToken = getJWTToken();

        if (!jwtToken) {
            return {
                success: false,
                errorMessage: 'JWT token олдсонгүй, эхлээд login хийх хэрэгтэй',
                needLogin: true
            };
        }

        // 1. User info шалгах
        const fetchFn = getFetch();
        const userRes = await fetchFn(`${apiBaseUrl}/api/auth/verify`, {
            headers: {
                'Authorization': `Bearer ${jwtToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!userRes.ok) {
            if (userRes.status === 401) {
                return {
                    success: false,
                    errorMessage: 'JWT token дууссан, дахин login хийх хэрэгтэй',
                    needLogin: true
                };
            }
            throw new Error(`User credentials API error: ${userRes.status}`);
        }

        const userData = await userRes.json();
        if (!userData.success || !userData.customerBankAccount) {
            return {
                success: false,
                errorMessage: 'Хэрэглэгчийн банкны мэдээл олдсонгүй',
                needCaptcha: true
            };
        }

        if (!userData.customerBankAccount.bankUserName || !userData.customerBankAccount.bankPassword) {
            return {
                success: false,
                errorMessage: 'Хэрэглэгчийн мэдээл дутуу байна',
                needCaptcha: true
            };
        }

        // 2. Token авах — GET /api/desktop/token
        const fetchFn2 = getFetch();
        const tokenRes = await fetchFn2(`${apiBaseUrl}/api/desktop/token`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwtToken}` // JWT token
            },
        });

        const tokenData = await tokenRes.json().catch(() => ({}));

        console.log('tokenData', tokenData)
        // ─── Амжилттай ───
        if (tokenRes.ok && tokenData.success && tokenData.data?.access_token) {
            return { success: true, errorMessage: null };
        }

        // ─── Амжилтгүй — data.code шалгах (шинэ формат) ───
        if (tokenData.data?.code) {
            const { code, message, bankResponse } = tokenData.data;

            switch (code) {
                case 'CAPTCHA_PENDING':
                    return {
                        success: false,
                        errorMessage: message || 'CAPTCHA шаардлагатай',
                        bankResponse,
                        needCaptcha: true,
                    };

                case 'REGISTER_DEVICE':
                    return {
                        success: false,
                        errorMessage: message || 'Шинээр төхөөрөмж таниулах шаардлагатай',
                        bankResponse,
                        needCaptcha: true,
                    };

                case 'PASSWORD_BLOCKED':
                    return {
                        success: false,
                        errorMessage: message || 'Нууц үг блоклогдсон',
                        bankResponse,
                        passwordBlocked: true,
                    };

                case 'CONTRACT_EXPIRED':
                    return {
                        success: false,
                        errorMessage: message || 'Гэрээний хугацаа дууссан',
                        bankResponse,
                        contractExpired: true,
                    };

                case 'TOKEN_EXPIRED':
                    return {
                        success: false,
                        errorMessage: message || 'Token дууссан',
                        bankResponse,
                    };

                case 'CONNECTION_ERROR':
                    return {
                        success: false,
                        errorMessage: message || 'Сүлжээний холболтын алдаа',
                        bankResponse,
                    };

                case 'BANK_ERROR':
                default:
                    return {
                        success: false,
                        errorMessage: message || 'Банкны серверийн алдаа',
                        bankResponse,
                    };
            }
        }

        // ─── HTTP status-аар fallback ───
        if (tokenRes.status === 401) {
            return {
                success: false,
                errorMessage: 'Нууц үг буруу байна',
                needCaptcha: true,
                passwordBlocked: true
            };
        }

        if (tokenRes.status === 403) {
            return {
                success: false,
                errorMessage: 'Хандах эрх байхгүй',
            };
        }

        return {
            success: false,
            errorMessage: tokenData.message || `Token API алдаа: ${tokenRes.status}`,
        };

    } catch (error) {
        console.error('❌ getTokenAndStore алдаа:', error);
        return {
            success: false,
            errorMessage: error.message || 'Токен авахад алдаа гарлаа'
        };
    } finally {
        getTokenAndStoreRunning = false;
    }
};


// Get transactions
const getTransactions = async () => {
  try {
    console.log('🔍 getTransactions дуудагдаж байна');

    // JWT token авах
    const jwtToken = await getJWTToken();
    if (!jwtToken) {
      return {
        data: [],
        errorMessage: 'JWT token олдсонгүй, эхлээд login хийх хэрэгтэй',
        needLogin: true
      };
    }

    const apiBaseUrl = getApiUrl();
    const fetchFn = getFetch();
    const res = await fetchFn(`${apiBaseUrl}/api/desktop/transactions`, {
      method: 'GET', // GET method ашиглах (JWT token header-ээс авах)
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json'
      }
      // Body-гүй - server дээр JWT token-оос userOid авах
    });

    // if (!res.ok) {
    //   if (res.status === 401) {
    //     return {
    //       data: [],
    //       errorMessage: 'JWT token дууссан, дахин login хийх хэрэгтэй',
    //       needLogin: true
    //     };
    //   }
    //   if (res.status === 403) {
    //     return {
    //       data: [],
    //       errorMessage: 'Хандах эрх байхгүй',
    //       needLogin: true
    //     };
    //   }
    //   throw new Error(`Transactions API error: ${res.status}`);
    // }

    const data = await res.json();

    // CAPTCHA шаардлагатай эсэхийг шалгах
    if (data.needCaptcha) {
      return {
        data: [],
        errorMessage: 'Төхөөрөмж таниулах шаардлагатай',
        needCaptcha: true
      };
    }

    console.log('✅ Transactions амжилттай авлаа:', {
      success: data.success,
      count: data.data?.transactions?.length || 0
    });

    return { data: data.data, errorMessage: null };

  } catch (error) {
    console.error('❌ getTransactions алдаа:', error);
    return {
      data: [],
      errorMessage: error.message || 'Гүйлгээний мэдээлэл авахэд алдаа гарлаа'
    };
  }
};

// Database status check function removed - using main.js version to avoid duplication

// Get SysConfigurations from database
const getSysConfigurations = async () => {
  try {
    console.log('🔍 Getting SysConfigurations from database...');
    
    const jwtToken = getJWTToken();
    if (!jwtToken) {
      return {
        success: false,
        errorMessage: 'JWT token олдсонгүй, эхлээд login хийх хэрэгтэй',
        needLogin: true
      };
    }

    const apiBaseUrl = getApiUrl();
    const fetchFn = getFetch();
    const response = await fetchFn(`${apiBaseUrl}/api/desktop/SysConfigurations`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        return {
          success: false,
          errorMessage: 'JWT token дууссан, дахин login хийх хэрэгтэй',
          needLogin: true
        };
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ SysConfigurations received:', data);
    
    return data;
  } catch (error) {
    console.error('❌ Error getting SysConfigurations:', error);
    return {
      success: false,
      errorMessage: error.message,
      data: null
    };
  }
};

module.exports = {
  getTransactions, clearJWTToken, getJWTToken, saveJWTToken, getJWTTokenFromServer, getTokenAndStore,
  getSysConfigurations
};
