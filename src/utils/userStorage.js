// Mock user storage for development
export const mockUserStorage = {
  getItem: (key) => {
    return localStorage.getItem(key);
  },
  setItem: (key, value) => {
    localStorage.setItem(key, value);
  },
  removeItem: (key) => {
    localStorage.removeItem(key);
  },
  clear: () => {
    localStorage.clear();
  }
};

// User storage interface
export const userStorage = {
  get: (key) => mockUserStorage.getItem(key),
  set: (key, value) => mockUserStorage.setItem(key, value),
  remove: (key) => mockUserStorage.removeItem(key),
  clear: () => mockUserStorage.clear()
};

// Additional functions for apiService compatibility
export const saveUser = (customerId, data) => {
  console.log('saveUser', customerId, data);
  localStorage.setItem(`user_${customerId}`, JSON.stringify(data));
};

export const readUser = (customerId) => {
  const data = localStorage.getItem(`user_${customerId}`);
  return data ? JSON.parse(data) : null;
};

export const clearUser = (customerId) => {
  localStorage.removeItem(`user_${customerId}`);
};
