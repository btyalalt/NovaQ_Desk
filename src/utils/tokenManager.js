import { tokenKey, STORAGE_KEYS, API_CONFIG } from './constants';

// Token management functions
export const saveToken = (customerId, tokenData) => {
  try {
    const key = tokenKey(customerId);
    localStorage.setItem(key, JSON.stringify(tokenData));
    console.log('✅ Token хадгалагдлаа:', customerId);
    return true;
  } catch (error) {
    console.error('❌ Token хадгалахад алдаа:', error);
    return false;
  }
};

export const readToken = (customerId) => {
  try {
    const key = tokenKey(customerId);
    const tokenData = localStorage.getItem(key);
    return tokenData ? JSON.parse(tokenData) : null;
  } catch (error) {
    console.error('❌ Token уншихад алдаа:', error);
    return null;
  }
};

export const deleteToken = (customerId) => {
  try {
    const key = tokenKey(customerId);
    localStorage.removeItem(key);
    console.log('✅ Token устгагдлаа:', customerId);
    return true;
  } catch (error) {
    console.error('❌ Token устгахад алдаа:', error);
    return false;
  }
};

export const isAboutToExpire = (tokenData) => {
  if (!tokenData || !tokenData.expiresAt) return false;
  
  const now = new Date().getTime();
  const expiryTime = new Date(tokenData.expiresAt).getTime();
  const timeUntilExpiry = expiryTime - now;
  
  // Return true if token expires within 5 minutes
  return timeUntilExpiry < 5 * 60 * 1000;
};

export const refreshIfNeeded = async (customerId) => {
  const tokenData = readToken(customerId);
  if (!tokenData) return null;
  
  if (isAboutToExpire(tokenData)) {
    console.log('🔄 Token шинэчлэх шаардлагатай');
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenData.token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        const newTokenData = {
          ...tokenData,
          token: result.token,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        };
        saveToken(customerId, newTokenData);
        return newTokenData;
      }
    } catch (error) {
      console.error('❌ Token шинэчлэхэд алдаа:', error);
    }
  }
  
  return tokenData;
};

// Legacy functions for compatibility
export const saveTokens = (customerId, tokenData) => {
  return saveToken(customerId, tokenData);
};

export const checkStoredTokensApp = (customerId) => {
  return readToken(customerId);
};

// Token validation
export const isValidToken = (tokenData) => {
  if (!tokenData || !tokenData.token) return false;
  
  if (tokenData.expiresAt) {
    const now = new Date().getTime();
    const expiryTime = new Date(tokenData.expiresAt).getTime();
    return now < expiryTime;
  }
  
  return true;
};

// Clear all tokens
export const clearAllTokens = () => {
  try {
    const keys = Object.keys(localStorage);
    const tokenKeys = keys.filter(key => key.startsWith('NQ_TOKEN_'));
    tokenKeys.forEach(key => localStorage.removeItem(key));
    console.log('✅ Бүх token-ууд устгагдлаа');
    return true;
  } catch (error) {
    console.error('❌ Token-уудыг устгахад алдаа:', error);
    return false;
  }
};

// Get token info
export const getTokenInfo = (customerId) => {
  const tokenData = readToken(customerId);
  if (!tokenData) return null;
  
  return {
    hasToken: !!tokenData.token,
    expiresAt: tokenData.expiresAt,
    isExpired: tokenData.expiresAt ? new Date() > new Date(tokenData.expiresAt) : false,
    isAboutToExpire: isAboutToExpire(tokenData)
  };
};
