import React from 'react';
import './CustomAlert.css';

const CustomAlert = ({ 
  isOpen, 
  title, 
  message, 
  type = 'error', // 'error', 'warning', 'info', 'success'
  onClose,
  showCancel = false,
  onConfirm = null,
  confirmText = 'OK',
  cancelText = 'Цуцлах'
}) => {
  // Only log when actually rendering (isOpen is true and has content)
  if (isOpen && message) {
    console.log('🔍 CustomAlert render:', { isOpen, title, message, type });
  }
  
  if (!isOpen) {
    return null;
  }

  const getIcon = () => {
    switch (type) {
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      case 'success':
        return '✅';
      default:
        return 'ℹ️';
    }
  };

  const getThemeClass = () => {
    switch (type) {
      case 'error':
        return 'alert-error';
      case 'warning':
        return 'alert-warning';
      case 'info':
        return 'alert-info';
      case 'success':
        return 'alert-success';
      default:
        return 'alert-info';
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 999999,
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '400px',
        width: '90%',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
        border: '2px solidrgb(8, 120, 247)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <div style={{
            fontSize: '24px',
            marginRight: '12px'
          }}>
            {getIcon()}
          </div>
          <div style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#5635dc'
          }}>
            {title}
          </div>
        </div>
        
        <div style={{
          fontSize: '14px',
          lineHeight: '1.5',
          color: '#666',
          marginBottom: '24px'
        }}>
          {message}
        </div>
        
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          {showCancel && (
            <button 
              style={{
                padding: '10px 20px',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                background: '#f8f9fa',
                color: '#5635dc'
              }}
              onClick={onClose}
            >
              {cancelText}
            </button>
          )}
          <button 
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              background: '#5635dc',
              color: 'white',
              minWidth: '80px'
            }}
            onClick={() => {
              if (onConfirm) {
                onConfirm();
              } else {
                onClose();
              }
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomAlert;
