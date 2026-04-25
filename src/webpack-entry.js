import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './utils/electronMock';
import LoginScreen from './components/LoginScreen';
import VersionCheck from './components/VersionCheck';
import FullScreenUpdate from './components/FullScreenUpdate';
import { isDevelopment } from './utils/constants';

// Global error handler - log but don't exit during update
window.addEventListener('error', (event) => {
  console.error('❌ Global Error:', event.error);
  console.log('🔍 DEBUG: Global error caught, not exiting app');
  // Don't exit - just log the error
  event.preventDefault();
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('❌ Unhandled Promise Rejection:', event.reason);
  console.log('🔍 DEBUG: Unhandled rejection caught, not exiting app');
  // Don't exit - just log the error
  event.preventDefault();
});

// Global root instance to prevent duplicate creation
let appRoot = null;

// App wrapper component with update screen
const AppWithUpdateScreen = () => {
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    // Listen for updater status from main process
    if (window.electron) {
      window.electron.receive('updater-status', (data) => {
        console.log('🔔 Received updater-status:', data);
        
        if (data && data.message) {
          const msg = data.message.toLowerCase();
          console.log('📋 Updater message:', msg);
          
          // Show update screen when updater starts
          if (msg.includes('starting updater') || msg.includes('starting novaq desktop update')) {
            console.log('🎯 Showing full screen update!');
            setIsUpdating(true);
          }
          
          // Hide update screen when completed
          if (msg.includes('update completed successfully')) {
            console.log('✅ Update completed, hiding screen...');
            setTimeout(() => {
              setIsUpdating(false);
            }, 2000);
          }
        }
      });
    }
  }, []);

  if (isUpdating) {
    return <FullScreenUpdate />;
  }

  return (
    <div className="app-container">
      <LoginScreen />
      <VersionCheck />
    </div>
  );
};

// Function to update CSP based on environment
const updateCSP = () => {
  const metaCSP = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  if (metaCSP) {
    const devApiBaseUrl = process.env.API_BASE_URL_DEV || 'http://localhost:3119';
    const devApiWsBaseUrl = devApiBaseUrl.replace(/^http/, 'ws');
    const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3119';
    const apiWsBaseUrl = apiBaseUrl.replace(/^http/, 'ws');
    const baseCSP = `default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' ${devApiBaseUrl} ${apiBaseUrl} https://desktop-f96376.gitlab.io/ ${devApiWsBaseUrl} ${apiWsBaseUrl} https://api.ipify.org;`;
    
    if (isDevelopment) {
      // Development mode - allow unsafe-eval for webpack
      metaCSP.setAttribute('content', baseCSP + " script-src 'self' 'unsafe-inline' 'unsafe-eval';");
      console.log('🔒 CSP updated for development (unsafe-eval enabled)');
    } else {
      // Production mode - no unsafe-eval
      metaCSP.setAttribute('content', baseCSP + " script-src 'self' 'unsafe-inline';");
      console.log('🔒 CSP updated for production (unsafe-eval disabled)');
    }
  }
};

// Function to initialize React app
const initializeApp = () => {
  // Update CSP based on environment first
  updateCSP();
  
  const container = document.getElementById('app');
  
  if (container && !appRoot) {
    // Clear any existing content safely
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    
    // Create React root only once
    appRoot = createRoot(container);
    appRoot.render(<AppWithUpdateScreen />);
    console.log('✅ React app initialized');
  } else if (!container) {
    console.error('❌ app element not found');
  } else if (appRoot) {
    console.log('⚠️ React app already initialized, skipping...');
  }
};

// Add dev-console-log listener for debugging (after DOM and electron are available)
const setupDevConsoleLog = () => {
  if (window.electron && window.electron.receive) {
    console.log('🔧 Registering dev-console-log listener...');
    // Listen for dev console logs from main process
    window.electron.receive('dev-console-log', (event, data) => {
      console.log('🔧 Received dev-console-log:', data);
      if (data && data.message) {
        console.log(data.message);
      }
    });
    
    console.log('🔧 Registering download-log listener...');
    // Listen for download progress logs from main process
    window.electron.receive('download-log', (event, data) => {
      console.log('🔧 Received download-log:', data);
      if (data && data.message) {
        // Use different console methods based on log type
        switch (data.type) {
          case 'critical-error':
            console.error(data.message);
            break;
          case 'error':
            console.warn(data.message);
            break;
          case 'success':
            console.info(data.message);
            break;
          case 'download-start':
            console.log(`%c${data.message}`, 'color: green; font-weight: bold;');
            break;
          default:
            console.log(data.message);
        }
      }
    });
    
    console.log('🔧 Registering trigger-portable-update listener...');
    // Listen for portable update triggers from main process
    window.electron.receive('trigger-portable-update', async (event, data) => {
      console.log('🎉 [RENDERER] Received trigger-portable-update event!');
      console.log('📊 [RENDERER] Event data:', data);
      
      // Show user-friendly message based on reason
      if (data && data.reason === 'auto-updater-failed') {
        console.log('%c🔄 Auto-updater алдаа гарсан тул manual download эхлүүлж байна...', 'color: orange; font-weight: bold;');
      } else if (data && data.reason === 'database-version-newer') {
        console.log('%c🔄 Database-аас шинэ хувилбар олдсон тул татаж байна...', 'color: blue; font-weight: bold;');
      } else {
        console.log('%c🔄 Manual update эхлүүлж байна...', 'color: green; font-weight: bold;');
      }
      
      try {
        console.log('📦 [RENDERER] Importing UpdateService...');
        
        // Import and use UpdateService
        const { default: UpdateService } = await import('./services/updateService.js');
        console.log('✅ [RENDERER] UpdateService imported successfully');
        
        console.log('🚀 [RENDERER] Triggering portable update via UpdateService...');
        console.log(`   🎯 Version: ${data.version}`);
        console.log(`   📋 Reason: ${data.reason}`);
        
        // Call UpdateService downloadPortableUpdate
        console.log('🔄 [RENDERER] Calling UpdateService.downloadPortableUpdate()...');
        const result = await UpdateService.downloadPortableUpdate();
        console.log('📦 [RENDERER] UpdateService portable update result:', result);
        
        if (result && result.success) {
          console.log('%c✅ Manual download амжилттай эхэллээ!', 'color: green; font-weight: bold;');
          console.log('✅ [RENDERER] Portable update completed successfully!');
        } else {
          console.log('%c❌ Manual download эхлүүлэхэд алдаа гарлаа!', 'color: red; font-weight: bold;');
          console.error('❌ [RENDERER] Portable update failed:', result ? result.error : 'Unknown error');
        }
        
      } catch (error) {
        console.error('❌ [RENDERER] Failed to trigger UpdateService portable update:', error);
        console.error('🔧 [RENDERER] Error details:', error.stack);
      }
    });
    
    console.log('✅ [RENDERER] All event listeners registered successfully');
  } else {
    console.warn('❌ window.electron or window.electron.receive not available for dev-console-log');
    // Retry after a short delay if electron not ready yet
    setTimeout(setupDevConsoleLog, 100);
  }
};

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  // DOM is still loading, wait for DOMContentLoaded
  document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupDevConsoleLog();
  });
} else {
  // DOM is already ready, initialize immediately
  initializeApp();
  setupDevConsoleLog();
}