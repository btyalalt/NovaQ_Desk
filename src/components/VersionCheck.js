import React, { useState, useEffect } from 'react';
import CustomAlert from './CustomAlert';

const VersionCheck = () => {
  const [versionInfo, setVersionInfo] = useState(null);
  const [databaseStatus, setDatabaseStatus] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [showUpdateWaitAlert, setShowUpdateWaitAlert] = useState(false);

  // Component mount flag
  let isMounted = true;
  
  useEffect(() => {
    let hideTimeout = null;
    
    // Global flag to prevent multiple listener registrations
    if (!window.versionCheckListenersRegistered) {
      window.versionCheckListenersRegistered = true;
      console.log('VersionCheck listeners registered');
      
      // Listen for version status from main process
      if (window.electron && window.electron.receive) {
        const handleVersionStatus = (event, data) => {
          if (!isMounted) return;
          
          // Skip duplicate time-based logs
          const currentTime = Date.now();
          const timeDiff = currentTime - (window.lastVersionLogTime || 0);
          if (timeDiff < 5000) { // 5 second debounce
            console.log('📋 Skipping duplicate version status (time-based)');
            return;
          }
          window.lastVersionLogTime = currentTime;

          // Skip duplicate data
          const dataString = JSON.stringify(data);
          if (window.lastVersionData === dataString) {
            console.log('📋 Skipping duplicate version status (data-based)');
            return;
          }
          window.lastVersionData = dataString;
          let lastVersionData = data;
          
          // Enhanced logging for database version
          console.log('📋 Version status received:', data);
          if (data && data.remote) {
            console.log('🗄️ Database хувилбар:', data.remote);
            console.log('📱 App хувилбар:', data.current);
            console.log('🔄 Шинэчлэл шаардлагатай:', data.needsUpdate ? 'Тийм' : 'Үгүй');
            
            // Auto-download notification
            if (data.autoDownload && data.downloadStarted) {
              console.log('🚀 Auto-download started for version:', data.remote);
            }
            
            // Show update wait alert when GitLab version is older than database version
            if (data.needsUpdate && data.current && data.remote) {
              // Check if GitLab version is older than database version (update not available yet)
              console.log('🔍 Checking if update is available from GitLab...');
              console.log('📱 Current App:', data.current);
              console.log('🗄️ Database Version:', data.remote);
              
              // For now, we'll show the alert for any version mismatch
              // Later we can add more sophisticated logic to check GitLab vs Database versions
              if (data.needsUpdate && !data.autoDownload) {
                console.log('⚠️ Update needed but not auto-downloading, showing wait alert');
                setShowUpdateWaitAlert(true);
              }
            }
          }
          
          setVersionInfo(data);
          if (data && (data.needsUpdate || data.downloading || data.downloaded || data.error)) {
            setIsVisible(true);
            
            // Auto-hide after 10 seconds for non-critical updates
            if (data.needsUpdate && !data.downloading && !data.downloaded && !data.error) {
              if (hideTimeout) clearTimeout(hideTimeout);
              hideTimeout = setTimeout(() => {
                if (isMounted) setIsVisible(false);
              }, 10000);
            }
          }
          
          // Auto-hide success messages after 5 seconds
          if (data && !data.needsUpdate && !data.error) {
            if (hideTimeout) clearTimeout(hideTimeout);
            hideTimeout = setTimeout(() => {
              if (isMounted) setIsVisible(false);
            }, 5000);
          }
        };

        const handleDatabaseStatus = (event, data) => {
          if (!isMounted) return;
          console.log('📋 Database status received:', data);
          setDatabaseStatus(data);
        };

        // Add event listeners only once
        window.electron.receive('version-status', handleVersionStatus);
        window.electron.receive('database-status', handleDatabaseStatus);
      }
    } else {
      console.log('📋 VersionCheck listeners already registered, skipping...');
    }

    // Cleanup function
    return () => {
      isMounted = false;
      if (hideTimeout) {
        clearTimeout(hideTimeout);
      }
      // Note: electron.receive doesn't have removeListener, so we rely on component unmount
    };
  }, []);

  const getStatusMessage = () => {
    if (versionInfo && versionInfo.error) {
      return `❌ ${versionInfo.message || 'Version check failed'}: ${versionInfo.error}`;
    }
    if (versionInfo && versionInfo.downloading) {
      return `📥 ${versionInfo.message || 'Downloading update'}: ${Math.round(versionInfo.progress || 0)}%`;
    }
    if (versionInfo && versionInfo.downloaded) {
      return `✅ ${versionInfo.message || 'Update downloaded and ready to install'}`;
    }
    if (versionInfo && versionInfo.needsUpdate) {
      return `🔄 ${versionInfo.message || 'Update available'}: v${versionInfo.current} → v${versionInfo.remote}`;
    }
    return '✅ Up to date';
  };

  const getStatusColor = () => {
    if (versionInfo && versionInfo.error) return '#F44336';
    if (versionInfo && versionInfo.downloading) return '#FF9800';
    if (versionInfo && versionInfo.downloaded) return '#4CAF50';
    if (versionInfo && versionInfo.needsUpdate) return '#FF9800';
    return '#4CAF50';
  };

  const handleManualDownload = () => {
    if (window.electron) {
      window.electron.invoke('manual-download-update');
    }
  };

  const handleRetryUpdate = () => {
    if (window.electron) {
      window.electron.invoke('retry-update');
    }
  };

  const handleInstallUpdate = () => {
    if (window.electron) {
      window.electron.invoke('install-update');
    }
  };

  // DISABLED: Version check UI completely hidden
  return null;
};

export default VersionCheck;