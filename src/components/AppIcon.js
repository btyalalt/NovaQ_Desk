import React from 'react';

const AppIcon = ({ 
  size = 24, 
  className = '', 
  alt = 'NovaQ',
  fallbackToText = true 
}) => {
  const iconStyle = {
    width: `${size}px`,
    height: `${size}px`,
    objectFit: 'contain'
  };

  const textStyle = {
    width: `${size}px`,
    height: `${size}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007bff',
    color: 'white',
    borderRadius: '4px',
    fontSize: `${Math.max(12, size * 0.4)}px`,
    fontWeight: 'bold',
    textAlign: 'center'
  };

  const handleImageError = (event) => {
    if (fallbackToText) {
      // Hide the image and show text fallback
      event.target.style.display = 'none';
      const textFallback = event.target.nextSibling;
      if (textFallback) {
        textFallback.style.display = 'flex';
      }
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* Try ICO first */}
      <img 
        src="assets/icon.ico" 
        alt={alt} 
        className={className}
        style={iconStyle}
        onError={handleImageError}
      />
      
      {/* Fallback to PNG */}
      <img 
        src="assets/Logopng.png" 
        alt={alt} 
        className={className}
        style={{
          ...iconStyle,
          position: 'absolute',
          top: 0,
          left: 0,
          display: 'none'
        }}
        onError={(e) => {
          e.target.style.display = 'none';
          const textFallback = e.target.nextSibling;
          if (textFallback) {
            textFallback.style.display = 'flex';
          }
        }}
        onLoad={(e) => {
          // If PNG loads successfully, hide the ICO
          const icoImage = e.target.previousSibling;
          if (icoImage) {
            icoImage.style.display = 'none';
          }
          e.target.style.display = 'block';
        }}
      />
      
      {/* Text fallback */}
      {fallbackToText && (
        <div 
          style={{
            ...textStyle,
            position: 'absolute',
            top: 0,
            left: 0,
            display: 'none'
          }}
        >
          NQ
        </div>
      )}
    </div>
  );
};

export default AppIcon;
