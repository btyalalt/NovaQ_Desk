import React, { useState, useEffect } from 'react';
import updateService from '../services/updateService';

const UpdateNotification = () => {
  const [updateStatus, setUpdateStatus] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Listen for update status changes
    const handleUpdateStatus = (status) => {
      setUpdateStatus(status);
      setIsVisible(true);
      
      // Auto-hide after 5 seconds for non-critical statuses
      if (status.status === 'not-available' || status.status === 'checking') {
        setTimeout(() => setIsVisible(false), 5000);
      }
    };

    updateService.addListener(handleUpdateStatus);

    // Check for updates on component mount
    updateService.checkForUpdates();

    return () => {
      updateService.removeListener(handleUpdateStatus);
    };
  }, []);

  const handleDownloadUpdate = async () => {
    const result = await updateService.downloadUpdate();
    if (!result.success) {
      console.error('Failed to download update:', result.error);
    }
  };

  const handleInstallUpdate = async () => {
    const result = await updateService.installUpdate();
    if (!result.success) {
      console.error('Failed to install update:', result.error);
    }
  };

  const handleCheckForUpdates = async () => {
    const result = await updateService.checkForUpdates();
    if (!result.success) {
      console.error('Failed to check for updates:', result.error);
    }
  };

  // Only show for important updates, not "not-available"
  if (!isVisible || !updateStatus || updateStatus.status === 'not-available') {
    return null;
  }

  const getStatusMessage = () => {
    switch (updateStatus.status) {
      case 'checking':
        return '🔍 Checking for updates...';
      case 'available':
        return `📦 Update available: v${updateStatus.version}`;
      case 'downloading':
        return `📥 Downloading update: ${Math.round(updateStatus.progress || 0)}%`;
      case 'downloaded':
        return `✅ Update downloaded: v${updateStatus.version}`;
      case 'not-available':
        return '✅ You have the latest version';
      case 'error':
        return `❌ Update error: ${updateStatus.error}`;
      default:
        return '🔄 Update status unknown';
    }
  };

  const getStatusColor = () => {
    switch (updateStatus.status) {
      case 'available':
      case 'downloaded':
        return '#4CAF50';
      case 'downloading':
        return '#2196F3';
      case 'error':
        return '#F44336';
      case 'checking':
        return '#FF9800';
      default:
        return '#757575';
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        backgroundColor: '#fff',
        border: `2px solid ${getStatusColor()}`,
        borderRadius: '8px',
        padding: '16px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 1000,
        maxWidth: '300px',
        minWidth: '250px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ 
          color: getStatusColor(), 
          fontWeight: 'bold',
          fontSize: '14px'
        }}>
          {getStatusMessage()}
        </span>
        <button
          onClick={() => setIsVisible(false)}
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: 'none',
            fontSize: '18px',
            cursor: 'pointer',
            color: '#999'
          }}
        >
          ×
        </button>
      </div>

      {updateStatus.status === 'available' && (
        <button
          onClick={handleDownloadUpdate}
          style={{
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '8px'
          }}
        >
          Download Update
        </button>
      )}

      {updateStatus.status === 'downloaded' && (
        <button
          onClick={handleInstallUpdate}
          style={{
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer',
            marginRight: '8px'
          }}
        >
          Install & Restart
        </button>
      )}

      {updateStatus.status === 'downloading' && (
        <div style={{ marginTop: '8px' }}>
          <div style={{
            width: '100%',
            height: '4px',
            backgroundColor: '#e0e0e0',
            borderRadius: '2px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${updateStatus.progress || 0}%`,
              height: '100%',
              backgroundColor: '#2196F3',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
      )}

      {updateStatus.status === 'error' && (
        <button
          onClick={handleCheckForUpdates}
          style={{
            backgroundColor: '#FF9800',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      )}

      <button
        onClick={handleCheckForUpdates}
        style={{
          backgroundColor: 'transparent',
          color: '#666',
          border: '1px solid #ddd',
          padding: '8px 16px',
          borderRadius: '4px',
          cursor: 'pointer',
          marginTop: '8px',
          width: '100%'
        }}
      >
        Check for Updates
      </button>
    </div>
  );
};

export default UpdateNotification;
