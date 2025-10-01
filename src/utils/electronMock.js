// Mock Electron APIs for web development only
// Only run in web browser environment, not in Electron production
if (typeof window !== 'undefined' && !window.electron && !window.process?.versions?.electron) {
  // Mock BrowserWindow for web development
  global.BrowserWindow = {
    new: () => ({
      width: 800,
      height: 600,
      webContents: {
        setUserAgent: () => {},
        loadFile: () => {},
        executeJavaScript: () => {},
        loadURL: () => {}
      }
    })
  };

  // Mock path for web development
  global.path = {
    join: (...args) => args.join('/')
  };

  window.electron = {
    invoke: async (method, ...args) => {
      // console.log(`🔌 Mock Electron: ${method}`, args); // Disabled for cleaner console
      
      switch (method) {
        case 'store-get':
          // Mock localStorage for electron-store
          try {
            const value = localStorage.getItem(args[0]);
            return value ? JSON.parse(value) : null;
          } catch (error) {
            return null;
          }
        
        case 'store-set':
          // Mock localStorage for electron-store
          try {
            localStorage.setItem(args[0], JSON.stringify(args[1]));
            return { success: true };
          } catch (error) {
            return { success: false, error: error.message };
          }
        
        case 'store-delete':
          // Mock localStorage for electron-store
          try {
            localStorage.removeItem(args[0]);
            return { success: true };
          } catch (error) {
            return { success: false, error: error.message };
          }
        
        case 'focus-window':
          // Mock window focus
          try {
            window.focus();
            return { success: true };
          } catch (error) {
            return { success: false, error: error.message };
          }
        
        case 'close-app':
          console.log('🔌 Mock: Quit app requested');
          if(typeof window !== 'undefined' && window.close) {
            setTimeout(() => {
              window.close();
            }, 100);
          }
          return { success: true };
        
        case 'check-for-updates':
          return { success: true, status: 'not-available' };
        
        case 'download-update':
          return { success: true, status: 'downloading' };
        
        case 'install-update':
          return { success: true, status: 'installing' };
        
        case 'create-captcha-window':
          // Mock CAPTCHA window creation for web development
          console.log('🔌 Mock: Creating CAPTCHA window (isCitizen:', args[0], ')');
          return { 
            success: true, 
            message: 'CAPTCHA window created successfully (mock)',
            isCitizen: args[0] || true
          };
        
        case 'close-captcha-window':
          // Mock CAPTCHA window closing for web development
          console.log('🔌 Mock: Closing CAPTCHA window');
          return { success: true, message: 'CAPTCHA window closed (mock)' };
        
        case 'is-captcha-window-open':
          // Mock CAPTCHA window status check for web development
          console.log('🔌 Mock: Checking if CAPTCHA window is open');
          return { success: true, isOpen: false };
        
        case 'clear-captcha-hooks':
          // Mock CAPTCHA hooks clearing for web development
          console.log('🔌 Mock: Clearing CAPTCHA hooks');
          return { success: true, message: 'CAPTCHA hooks cleared successfully (mock)' };
        
        case 'reinstall-captcha-hooks':
          // Mock CAPTCHA hooks reinstalling for web development
          console.log('🔌 Mock: Reinstalling CAPTCHA hooks');
          return { success: true, message: 'CAPTCHA hooks reinstalled successfully (mock)' };
        
        case 'clear-khanbank-cookies':
          // Mock KhanBank cookies clearing for web development
          console.log('🔌 Mock: Clearing KhanBank cookies');
          return { success: true, message: 'KhanBank cookies cleared successfully (mock)' };
        
        case 'insert-khanbank-cookies':
          // Mock KhanBank cookies insertion for web development
          console.log('🔌 Mock: Inserting KhanBank cookies with params:', args[0]);
          return { success: true, message: 'KhanBank cookies inserted successfully (mock)' };
        
        case 'quit-app':
          // Mock quit app for web development
          console.log('🔌 Mock: Quit app requested with params:', args[0]);
          return { success: true, message: 'App quit (mock)' };
        
        // Additional mock functions for preload.js
        case 'get-users':
          return { success: true, users: [] };
        
        case 'get-customer-name':
          return { success: true, customerName: 'Customer Name (Mock)' };
        
        case 'call-insert-login-history':
          return { success: true, message: 'Login history inserted (mock)' };
        
        case 'call-update-logout-time':
          return { success: true, message: 'Logout time updated (mock)' };
        
        case 'insert-logout-with-autorefresh':
          return { success: true, message: 'Logout with autorefresh inserted (mock)' };
        
        case 'increment-auto-refresh-count':
          return { success: true, message: 'Auto refresh count incremented (mock)' };
        
        case 'get-contract-info':
          return { success: true, contractInfo: {} };
        
        case 'get-system-version':
          return { success: true, version: '1.0.0 (mock)' };
        
        case 'check-version-and-update':
          return { success: true, message: 'Checking for updates (mock)' };
        
        case 'perform-auto-update':
          return { success: true, message: 'Auto update started (mock)' };
        
        case 'restart-app':
          return { success: true, message: 'App restarting (mock)' };
        
        case 'get-bank-error-description':
          return { success: true, errorDescription: 'Bank error description (mock)' };
        
        case 'show-alert-window':
          return { success: true, message: 'Alert window shown (mock)' };
        
        case 'open-simple-khanbank-captcha':
          return { success: true, message: 'Simple KhanBank CAPTCHA opened (mock)' };
        
        case 'test-corporate-captcha':
          return { success: true, message: 'Corporate CAPTCHA test opened (mock)' };
        
        case 'open-captcha-window':
          return { success: true, message: 'CAPTCHA window opened (mock)' };
        
        case 'open-khanbank-corporate-login':
          return { success: true, message: 'Corporate login opened (mock)' };
        
        case 'set-current-user-oid':
          return { success: true, message: 'Current user OID set (mock)' };
        
        case 'get-user-oid':
          return { success: true, userOid: 'user-oid (mock)' };
        
        case 'get-khanbank-device-id':
          return { success: true, deviceId: 'khanbank-device-id (mock)' };
        
        case 'get-full-bank-account-data':
          return { success: true, bankData: {} };
        
        case 'get-local-storage':
          try {
            const value = localStorage.getItem(args[0]?.key);
            return { success: true, value: value ? JSON.parse(value) : null };
          } catch (error) {
            return { success: false, error: error.message };
          }
        
        case 'set-local-storage':
          try {
            localStorage.setItem(args[0]?.key, JSON.stringify(args[0]?.value));
            return { success: true, message: 'Value stored (mock)' };
          } catch (error) {
            return { success: false, error: error.message };
          }
        
        case 'update-local-storage':
          try {
            localStorage.setItem(args[0]?.key, JSON.stringify(args[0]?.value));
            return { success: true, message: 'Value updated (mock)' };
          } catch (error) {
            return { success: false, error: error.message };
          }
        
        case 'call-khanbank-api':
          return { success: true, response: {} };
        
        case 'get-khanbank-token-from-db':
          return { success: true, token: 'khanbank-token (mock)' };
        
        case 'save-khanbank-credentials':
          return { success: true, message: 'Credentials saved (mock)' };
        
        case 'get-khanbank-token':
          return { success: true, token: 'khanbank-token (mock)' };
        
        case 'get-khanbank-payload-credentials':
          return { success: true, credentials: {} };
        
        case 'get-login-credentials':
          return { success: true, credentials: {} };
        
        default:
          return { success: false, error: 'Method not implemented in mock' };
      }
    },
    
    receive: (channel, callback) => {
      if (channel === 'update-status') {
        setTimeout(() => {
          callback({ status: 'not-available' });
        }, 1000);
      }
    }
  };
 
}
