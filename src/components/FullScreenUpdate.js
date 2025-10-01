import React from 'react';
import AppIcon from './AppIcon';

const FullScreenUpdate = () => {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Logo */}
      <div style={{ marginBottom: '40px' }}>
        <AppIcon size={140} />
      </div>

      {/* Message */}
      <div style={{
        fontSize: '24px',
        fontWeight: '600',
        color: '#2c3e50',
        textAlign: 'center',
        lineHeight: '1.6'
      }}>
        Систем шинэчлэгдэж байна,
        <br />
        түр хүлээнэ үү...
      </div>
    </div>
  );
};

export default FullScreenUpdate;

