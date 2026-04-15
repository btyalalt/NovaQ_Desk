import React, {useEffect, useState} from 'react';
import authService from '../services/authService';
import StatementScreen from './StatementScreen';
import CustomAlert from './CustomAlert';
import './LoginScreen.css';
import packageJson from '../../package.json';

// Dynamic IP detection helper functions
const getLocalIP = () => {
  return new Promise((resolve) => {
    const RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
    
    if (!RTCPeerConnection) {
      resolve(null);
      return;
    }

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.createDataChannel('');
    pc.createOffer().then(offer => pc.setLocalDescription(offer));
    
    pc.onicecandidate = (ice) => {
      if (ice && ice.candidate && ice.candidate.candidate) {
        const candidate = ice.candidate.candidate;
        const ipMatch = /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/.exec(candidate);
        
        if (ipMatch && !ipMatch[1].includes('127.0.0.1') && !ipMatch[1].startsWith('169.254')) {
          pc.close();
          resolve(ipMatch[1]);
        }
      }
    };

    // Timeout after 3 seconds
    setTimeout(() => {
      pc.close();
      resolve(null);
    }, 3000);
  });
};

const getFallbackIP = async () => {
  // Generate dynamic IP based on current time and random number
  const timestamp = Date.now();
  const randomNum = Math.floor(Math.random() * 254) + 1;
  const lastOctet = (timestamp % 254) + 1;
  
  // Common local network ranges
  const networkRanges = [
    '192.168.1',
    '192.168.0',
    '10.0.0',
    '172.16.0',
    '172.20.0'
  ];
  
  const selectedRange = networkRanges[Math.floor(Math.random() * networkRanges.length)];
  return `${selectedRange}.${lastOctet}`;
};

const LoginScreen = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [customerBankAccount, setCustomerBankAccount] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [userId, setUserId] = useState('');
  const [theme, setTheme] = useState('light');
  const [contractExpiry, setContractExpiry] = useState(null);
  const [showAlert, setShowAlert] = useState(false);
  const [alertData, setAlertData] = useState({});

  // Initialize application
  useEffect(() => {
    const initializeApp = async () => {
      try {
        await window.electron.invoke('focus-window');
      } catch (error) {
        console.log('⚠️ Window focus алдаа:', error);
      }

      // Load saved credentials
      const savedUsername = localStorage.getItem('savedUsername') || '';
      const savedPassword = localStorage.getItem('savedPassword') || '';
      setUsername(savedUsername);
      setPassword(savedPassword);

      // Load saved theme
      const savedTheme = localStorage.getItem('theme') || 'light';
      setTheme(savedTheme);

      // Apply theme immediately on mount
      document.documentElement.setAttribute('data-theme', savedTheme);
      document.body.setAttribute('data-theme', savedTheme);

      // Try to refresh user data if we have stored credentials (with debounce)
      if (savedUsername && savedPassword) {
        // Debounce user data refresh to prevent multiple calls - only run once
        if (!window.userDataRefreshInitiated) {
          window.userDataRefreshInitiated = true;
          setTimeout(function() {
            authService.refreshUserData().then(function(refreshedData) {
              if (refreshedData && refreshedData.user) {
                setUserInfo({
                  UserName: refreshedData.user.username,
                  FirstName: refreshedData.user.firstName,
                  LastName: refreshedData.user.lastName
                });
                setCustomerBankAccount(refreshedData.customerBankAccount);
                if (refreshedData.customer) {
                  setCustomer(refreshedData.customer);
                }
                setUserId(refreshedData.user.username);
                setIsLoggedIn(true);
                
                // Хэрэглэгчийн мэдээлэл амжилттай сэргээгдсэн бол login history хадгалах
                try {
                  window.electron.invoke('get-computer-name').then(async function(computerNameResponse) {
                    const computerName = typeof computerNameResponse === 'string' ? computerNameResponse : 'Unknown';
                    
                    // Get system information for login history
                    let clientIP = 'Unknown';
                    let systemName = 'NovaQ_Desk';
                    let deviceId = 'Unknown';
                    
                    try {
                      // Try dynamic IP detection (same as manual login)
                      try {
                        // Method 1: External IP from multiple services
                        const ipServices = [
                          'https://api.ipify.org?format=json',
                          'https://ipapi.co/json/',
                          'https://api.myip.com',
                          'https://httpbin.org/ip'
                        ];
                        
                        let externalIP = null;
                        for (const service of ipServices) {
                          try {
                            const response = await fetch(service, { timeout: 3000 });
                            const data = await response.json();
                            
                            if (data.ip) {
                              externalIP = data.ip;
                              break;
                            } else if (data.origin) {
                              externalIP = data.origin.split(',')[0].trim();
                              break;
                            }
                          } catch (serviceError) {
                            continue;
                          }
                        }
                        
                        if (externalIP) {
                          clientIP = externalIP;
                        } else {
                          // Try local IP detection
                          const localIP = await getLocalIP();
                          clientIP = localIP || await getFallbackIP();
                        }
                      } catch (ipError) {
                        console.log('⚠️ Dynamic IP detection failed:', ipError);
                        clientIP = await getFallbackIP();
                      }

                      const deviceResult = await window.electron.invoke('get-device-id');
                      deviceId = deviceResult?.deviceId || 'Unknown';
                      
                    } catch (error) {
                      console.log('⚠️ System info авах алдаа:', error);
                      // Fallback to dynamic values
                      clientIP = await getFallbackIP();
                      deviceId = 'Desktop_App';
                    }
                    
                    // Auto-refresh хийхэд login history хадгалахгүй (зөвхөн manual login хийхэд хадгална)
                    // Login history-г зөвхөн handleLogin функц дотор хадгална
                    console.log('🔄 Auto-refresh хийж байна, login history хадгалахгүй (зөвхөн manual login хийхэд хадгална)');
                  }).catch(function(error) {
                    console.error('❌ Login history хадгалахад алдаа:', error);
                  });
                } catch (error) {
                  console.error('❌ Login history хадгалахад алдаа:', error);
                }
              }
            }).catch(function(error) {
              console.log('⚠️ Could not refresh user data on initialization:', error);
            });
          }, 3000);
        }
      }
    };

    initializeApp();
  }, []);

  // Apply theme when theme changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);

    // Apply theme to both components
    const appContainer = document.querySelector('.app-container');
    if (appContainer) {
      appContainer.className = `app-container ${theme}`;
    }

    const mobileContainer = document.querySelector('.mobile-container');
    if (mobileContainer) {
      mobileContainer.className = `mobile-container ${theme}`;
    }
  }, [theme]);

  // Theme toggle function
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);

    // Apply theme immediately
    document.documentElement.setAttribute('data-theme', newTheme);
    document.body.setAttribute('data-theme', newTheme);

    // Update component classes
    const appContainer = document.querySelector('.app-container');
    if (appContainer) {
      appContainer.className = `app-container ${newTheme}`;
    }

    const mobileContainer = document.querySelector('.mobile-container');
    if (mobileContainer) {
      mobileContainer.className = `mobile-container ${newTheme}`;
    }
  };

  // Handle successful login
  const handleSuccessfulLogin = async (found, result) => {
    try {
      let clientIP = 'Unknown';
      try {
        // Try multiple IP detection methods dynamically
        try {
          // Method 1: External IP from multiple services
          const ipServices = [
            'https://api.ipify.org?format=json',
            'https://ipapi.co/json/',
            'https://api.myip.com',
            'https://httpbin.org/ip'
          ];
          
          let externalIP = null;
          for (const service of ipServices) {
            try {
              const response = await fetch(service, { timeout: 5000 });
              const data = await response.json();
              
              // Extract IP based on service response format
              if (data.ip) {
                externalIP = data.ip;
                break;
              } else if (data.origin) {
                externalIP = data.origin.split(',')[0].trim();
                break;
              }
            } catch (serviceError) {
              console.log(`⚠️ IP service ${service} failed:`, serviceError);
              continue;
            }
          }
          
          if (externalIP) {
            clientIP = externalIP;
          } else {
            throw new Error('All external IP services failed');
          }
        } catch (error) {
          console.log('⚠️ External IP авах алдаа, local network IP ашиглах:', error);
          
          // Method 2: Try to get local network IP via Electron
          try {
            const electronIP = await window.electron.invoke('get-client-ip');
            if (electronIP && electronIP !== 'Unknown' && !electronIP.includes('127.0.0.1')) {
              clientIP = electronIP;
            } else {
              // Method 3: Try WebRTC to get local IP
              const localIP = await getLocalIP();
              clientIP = localIP || '192.168.1.100'; // Dynamic fallback
            }
          } catch (electronError) {
            console.log('⚠️ Electron IP авах алдаа:', electronError);
            // Method 4: Final fallback with dynamic IP
            const fallbackIP = await getFallbackIP();
            clientIP = fallbackIP;
          }
        }
      } catch (error) {
        console.log('⚠️ IP хаяг авах алдаа:', error);
        clientIP = '127.0.0.1';
      }

      const computerNameResponse = await window.electron.invoke('get-computer-name');
      const computerName = typeof computerNameResponse === 'string' ? computerNameResponse : 'Unknown';
      const systemName = 'NovaQ_Desk';
      let deviceId = 'NoDeviceID';

      try {
        const deviceIdResponse = await window.electron.invoke('getDeviceId', { userName: username });
        if (deviceIdResponse.success && deviceIdResponse.deviceId) {
          deviceId = deviceIdResponse.deviceId;
        }
      } catch (error) {
        console.log('⚠️ Device ID авах алдаа:', error);
      }

      // Save credentials
      localStorage.setItem('savedUsername', username);
      localStorage.setItem('savedPassword', password);
      // Нэвтрэх түүх хадгалах
      try {
        console.log('🔍 Manual login history data:', {
          userName: username,
          clientIP,
          computerName,
          systemName,
          deviceId,
          systemNameType: typeof systemName,
          deviceIdType: typeof deviceId
        });
        const result = await authService.saveLoginHistory({
          userName: username,
          clientIP,
          computerName,
          systemName,
          deviceId,
          DesktopVersion: packageJson.version
        });
      } catch (error) {
        console.error('❌ Нэвтрэх түүх хадгалахад алдаа:', error);
      }
      // Set user info
      setUserInfo({
        UserName: found.username,
        FirstName: found.firstName,
        LastName: found.lastName
      });

      // Set customer bank account
      setCustomerBankAccount(result.customerBankAccount);

      // Set customer info if available
      if (result?.customer) {
        setCustomer(result.customer);
      }

      setUserId(found.username);
      setIsLoggedIn(true);


      // Check for updates after successful login
      try {
        const updateResult = await window.electron.checkForUpdate();
        if (updateResult.updating) {
          // App will automatically quit and restart via updater
        }

      } catch (error) {
        console.error('❌ Error in handleSuccessfulLogin:', error);
      }
    } catch (error) {
      console.error('❌ Error in handleSuccessfulLogin:', error);
    }
  };

  // Handle login
  const handleLogin = async () => {
    if (!username || !password) {
      setAlertData({
        title: 'Анхааруулга',
        message: 'Username эсвэл password хоосон байна',
        type: 'warning'
      });
      setShowAlert(true);
      return;
    }

    try {
      // XOR27 encrypt function
      const xor27Encrypt = (text) => {
        let encrypted = '';
        for (let i = 0; i < text.length; i++) {
          encrypted += String.fromCharCode(text.charCodeAt(i) ^ 27);
        }
        return encrypted;
      };
      const encryptedPassword =xor27Encrypt(password)
      const result = await authService.login({ username, password: encryptedPassword });
      

      if (result.success) {
        await handleSuccessfulLogin(result.user, result);
      } else {
        // Show custom alert instead of browser alert
        const alertInfo = {
          title: 'Нэвтрэх амжилтгүй',
          message: result.message || 'Нэвтрэх амжилтгүй боллоо',
          type: 'error'
        };
        setAlertData(alertInfo);
        setShowAlert(true);
      }
    } catch (error) {
      setAlertData({
        title: 'Алдаа',
        message: 'Нэвтрэх үед алдаа гарлаа',
        type: 'error'
      });
      setShowAlert(true);
      console.error('❌ Нэвтрэх үед алдаа гарлаа:', error);
    }
  };

  // Handle back to login
  const handleBackToLogin = function() {
    setIsLoggedIn(false);
    setUserInfo(null);
    setCustomerBankAccount(null);
    setCustomer(null);
    setUserId('');
    
    window.electron.invoke('get-computer-name').then(function(computerNameResponse) {
      const computerName = typeof computerNameResponse === 'string' ? computerNameResponse : 'Unknown';
      
      // Server logout endpoint-ийн шаардлагатай 3 талбар
      return authService.saveLogoutHistory({
        userName: username,
        computerName: computerName,
        DesktopVersion: packageJson.version
      });
    }).catch(function(error) {
      console.error('❌ Logout history хадгалахад алдаа:', error);
    });
  };

  // Render login form
  const renderLoginForm = () => (
    <div className={`app-container ${theme}`} data-theme={theme}>

      <div className="title-bar-container">
        <div
          className="title-bar"
          style={{ WebkitAppRegion: 'drag' }}
        >
          <span className="title-bar-content">
            <img src="assets/icon.ico" alt="NovaQ" className="title-bar-icon" onError={(e) => { e.target.style.display = 'none'; }} />
            NovaQ Desk
          </span>
          <div className="title-bar-controls" style={{ WebkitAppRegion: 'no-drag' }}>
            <button
              className="title-bar-button theme-toggle"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <button
              className="title-bar-button close-button"
              onClick={function(e) {
                e.stopPropagation();
                window.electron.invoke('close-app');
              }}
              title="Close application"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="9" cy="9" r="9" fill="white" fillOpacity="0.15" />
                <path d="M5.5 5.5L12.5 12.5M12.5 5.5L5.5 12.5" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
        {/* Main Blue Header */}
        <div className="main-header" style={{ WebkitAppRegion: 'drag' }}>
          <div className="main-header-title">NovaQ</div>
        </div>
      </div>

      <div className="login-form-container">
        <input
          type="text"
          placeholder="Хэрэглэгчийн нэр"
          value={username}
          onChange={e => {
            // Allow uppercase Cyrillic letters (А-Я, Ө, Ү), numbers, and space
            let value = e.target.value
              .toUpperCase()
              .replace(/[^А-ЯӨҮ0-9\s]/g, '');
            // Prevent Latin/англи үсэг from being entered at all
            if (value !== e.target.value) {
              e.target.value = value;
            }
            setUsername(value);
          }}
          maxLength={10}
          onKeyDown={e => {
            // Allow Cyrillic letters, numbers, and space
            const allowed = /^[А-ЯӨҮ0-9\s]$/;
            if (
              e.key.length === 1 && // Only filter printable characters
              !allowed.test(e.key.toUpperCase())
            ) {
              e.preventDefault();
            }
            if (e.key === 'Enter') {
              document.getElementById('password-input').focus();
            }
          }}
          className="username-input"
          inputMode="text"
          pattern="[\u0410-\u042FӨҮ\s]+"
        />
        
        <div className="password-container">
          <input
            id="password-input"
            type={showPassword ? 'text' : 'password'}
            placeholder="Нууц үг"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                handleLogin();
              }
            }}
            className="password-input"
          />
          <button
            type="button"
            onClick={() => setShowPassword(s => !s)}
            className="password-toggle"
            tabIndex={-1}
          >
            {showPassword ? '🙈' : '👁️'}
          </button>
        </div>
        <button
          className="login-button"
          onClick={handleLogin}
        >
          <span>Нэвтрэх</span>
          <span className="login-arrow">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 11H16M16 11L12.5 7.5M16 11L12.5 14.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>
      </div>
    </div>
  );

  // Render main app
  if (isLoggedIn && userInfo && customerBankAccount) {
    return (
      <StatementScreen
        onBack={handleBackToLogin}
        username={userInfo.UserName}
        firstName={userInfo.FirstName}
        lastName={userInfo.LastName}
        customerBankAccount={customerBankAccount}
        customer={customer}
        theme={theme}
      />
    );
  }

  return (
    <>
      {renderLoginForm()}
      <CustomAlert
        isOpen={showAlert}
        title={alertData.title}
        message={alertData.message}
        type={alertData.type}
        onClose={() => setShowAlert(false)}
      />
    </>
  );
};

export default LoginScreen;
