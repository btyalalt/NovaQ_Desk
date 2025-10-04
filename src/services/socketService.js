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
    
    console.log('🔌 User-specific socket холболт үүсгэж байна:', url, 'userId:', userId);
    
    try {
      // User ID-тай холболт хийх
      const options = userId ? { 
        query: { userId: userId },
        transports: ['websocket', 'polling'],
        timeout: 10000, // 10 секунд timeout
        forceNew: true, // Шинэ холболт үүсгэх
        reconnection: true, // Автомат дахин холбогдох
        reconnectionAttempts: 3, // 3 удаа оролдох
        reconnectionDelay: 2000 // 2 секунд хүлээх
      } : {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 2000
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
      this.handleConnectionError(url, userId);
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

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      console.log('🔌 Socket.io холболт тасарлаа:', reason);
      
      // Автомат дахин холбогдох оролдлого
      if (reason === 'io server disconnect') {
        console.log('🔄 Server disconnect, дахин холбогдох оролдлого...');
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket.io холболтын алдаа:', error.message);
      this.isConnected = false;
      
      // WebSocket алдаа бол fallback механизм ашиглах
      if (error.message.includes('websocket') || error.message.includes('WebSocket')) {
        console.log('🔄 WebSocket алдаа, polling transport оролдох...');
        this.tryPollingFallback();
      }
    });

    this.socket.on('error', (error) => {
      console.error('❌ Socket.io алдаа:', error);
      this.isConnected = false;
    });

    // Reconnection events
    this.socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Socket.io дахин холбогдлоо:', attemptNumber);
      this.isConnected = true;
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('🔄 Socket.io дахин холбогдох оролдлого:', attemptNumber);
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('❌ Socket.io дахин холбогдох алдаа:', error);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('❌ Socket.io дахин холбогдох амжилтгүй боллоо');
      this.isConnected = false;
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
      console.warn('⚠️ Socket холболтгүй байна, offline mode ашиглах');
      // Offline mode-д CAPTCHA setup хадгалах
      this.emitCaptchaSetupOffline(userOid, isCitizen);
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

  // ✅ WebSocket алдааны fallback механизм
  tryPollingFallback() {
    if (!this.socket) return;
    
    console.log('🔄 Polling transport оролдох...');
    this.socket.io.opts.transports = ['polling']; // Зөвхөн polling ашиглах
    this.socket.io.engine.upgrade = false; // WebSocket upgrade хориглох
    this.socket.io.open(); // Дахин нээх
  }

  // ✅ Холболтын алдааны удирдлага
  handleConnectionError(url, userId) {
    console.error('❌ Socket холболт амжилтгүй боллоо:', url);
    
    // Offline mode болон fallback механизм
    this.isConnected = false;
    
    // Хэрэглэгчид мэдээлэл өгөх
    if (typeof window !== 'undefined' && window.electron) {
      // Electron environment-д notification өгөх
      try {
        window.electron.showNotification('Сүлжээний холболт', 'Socket сервертэй холбогдох боломжгүй байна. Офлайн горимд ажиллаж байна.');
      } catch (error) {
        console.log('Notification илгээх боломжгүй:', error);
      }
    }
    
    // Retry механизм
    setTimeout(() => {
      console.log('🔄 Socket холболт дахин оролдох...');
      this.connect(url, userId);
    }, 5000); // 5 секунд хүлээгээд дахин оролдох
  }

  // ✅ Offline mode шалгах
  isOfflineMode() {
    return !this.isConnected && (!this.socket || !this.socket.connected);
  }

  // ✅ CAPTCHA setup offline mode-д
  emitCaptchaSetupOffline(userOid, isCitizen) {
    console.log('📤 CAPTCHA setup (offline mode):', { userOid, isCitizen });
    // Offline mode-д localStorage-д хадгалах
    try {
      const captchaSetup = {
        userOid: userOid,
        isCitizen: isCitizen,
        timestamp: Date.now(),
        offline: true
      };
      localStorage.setItem('novaq_captcha_setup_offline', JSON.stringify(captchaSetup));
      console.log('💾 CAPTCHA setup offline хадгалагдлаа');
    } catch (error) {
      console.error('❌ CAPTCHA setup offline хадгалах алдаа:', error);
    }
  }
}

// Singleton instance үүсгэх
const socketService = new SocketService();
module.exports = socketService;
