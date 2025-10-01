const io = require('socket.io-client');
const { API_CONFIG } = require('../utils/constants');

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
  }

  // Get correct API URL based on environment
  getApiUrl() {
    // Check if we're in Electron environment
    if (typeof window !== 'undefined' && window.electron) {
      // Check environment to determine API URL
      const isDevelopment = process.env.NODE_ENV === 'development' || 
                           (typeof process !== 'undefined' && process.argv && process.argv.includes('--dev'));
      
      if (isDevelopment) {
        return 'http://localhost:3101';
      } else {
        return 'http://103.168.56.34:3101';
      }
    }
    
    // In browser environment (non-Electron), check if we're on localhost
    if (typeof window !== 'undefined' && !window.electron && typeof process !== 'undefined') {
      const isRealDevelopment = process.env.NODE_ENV === 'development' && 
                                !process.execPath.includes('electron');
      
      if (isRealDevelopment && 
          (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        return 'http://localhost:3101';
      }
    }

    // Use production URL or configured URL
    return API_CONFIG.BASE_URL;
  }

  // ✅ Socket.io холболт хийх
  connect(url = null, userId = null) {
    if (!url) {
      url = this.getApiUrl();
    }
    try {
      // User ID-тай холболт хийх
      const options = userId ? { 
        query: { userId: userId },
        transports: ['websocket', 'polling']
      } : {
        transports: ['websocket', 'polling']
      };
      
      this.socket = io(url, options);
      this.setupEventHandlers();
      
      // ✅ Connection-г шалгах
      if (this.socket.connected) {
        this.isConnected = true;
        console.log('🔌 User-specific Socket.io холбогдлоо (синхрон):', this.socket.id, 'userId:', userId);
        
        // User ID байвал room-д join хийх
        if (userId) {
          this.joinUserRoom(userId);
        }
      }
      
      return this.socket;
    } catch (error) {
      console.error('❌ Socket.io холболт хийхэд алдаа:', error);
      return null;
    }
  }

  // ✅ Event handlers тохируулах
  setupEventHandlers() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.isConnected = true;
      console.log('🔌 Socket.io холбогдлоо:', this.socket.id);
    });

    this.socket.on('disconnect', () => {
      this.isConnected = false;
      console.log('🔌 Socket.io холболт тасарлаа');
    });

    this.socket.on('error', (error) => {
      console.error('❌ Socket.io алдаа:', error);
    });
  }

  // ✅ CAPTCHA setup илгээх
  emitCaptchaSetup(userOid, isCitizen) {
    if (this.socket && (this.isConnected || this.socket.connected)) {
      this.socket.emit('captcha-setup', {
        userOid: userOid,
        isCitizen: isCitizen
      });
      console.log('📤 CAPTCHA setup илгээгдлээ:', { userOid, isCitizen });
    } else {
      console.warn('⚠️ Socket холболтгүй байна, socket.connected:', this.socket?.connected, 'isConnected:', this.isConnected);
    }
  }

  // ✅ User-specific room-д join хийх
  joinUserRoom(userId) {
    if (this.socket && (this.isConnected || this.socket.connected)) {
      this.socket.emit('joinRoom', { userId: userId });
      console.log('🏠 User room-д join хийлээ:', userId);
    } else {
      console.warn('⚠️ Socket холболтгүй байна, room join хийх боломжгүй');
    }
  }

  // ✅ CAPTCHA update event listener нэмэх
  onCaptchaUpdate(callback) {
    if (this.socket) {
      this.socket.on('captcha-update', callback);
      console.log('👂 CAPTCHA update listener нэмэгдлээ (socketService)');
    } else {
      console.warn('⚠️ Socket объект null байна, event listener нэмэх боломжгүй');
    }
  }

  // ✅ Transaction update event listener нэмэх
  onTransactionUpdate(callback) {
    if (this.socket) {
      this.socket.on('newTransactions', callback);
      console.log('👂 Transaction update listener нэмэгдлээ (socketService)');
    } else {
      console.warn('⚠️ Socket объект null байна, transaction listener нэмэх боломжгүй');
    }
  }

  // ✅ Socket холболт хаах
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      console.log('🔌 Socket холболт хаагдлаа');
    }
  }

  // ✅ Socket холболт байгаа эсэхийг шалгах
  isSocketConnected() {
    return this.socket && this.isConnected;
  }
}

// Singleton instance үүсгэх
const socketService = new SocketService();
module.exports = socketService;
