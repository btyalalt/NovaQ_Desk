import React, { useEffect, useState, useRef } from 'react';
import './StatementScreen.css';
import { getTokenAndStore, getTransactions } from '../services/apiService';
import io from 'socket.io-client';
import DesktopService from '../services/desktopService';
const desktopService = new DesktopService();
import { API_CONFIG } from '../utils/constants';
import authService from '../services/authService';

const StatementScreen = ({
  onBack,
  username,
  firstName,
  lastName,
  customerBankAccount,
  customer,
  theme = 'light'
}) => {
  const [amount, setAmount] = useState('₮ 0');
  const [transactions, setTransactions] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [contractInfo, setContractInfo] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [newTransactionsCount, setNewTransactionsCount] = useState(0);
  const [animatedTransactions, setAnimatedTransactions] = useState(new Set());
  const [tokenResult, setTokenResult] = useState(null);

  // Socket reference
  const socketRef = useRef(null);

  // Transaction-уудын нийлбэрийг тооцоолох функц
  const calculateTotalAmount = (transactions) => {
    const total = transactions.reduce((sum, transaction) => {
      const amount = parseFloat(transaction.amount) || 0;
      return sum + amount;
    }, 0);
    return total;
  };

  // Socket disconnect функц
  const disconnectAllConnections = () => {
    console.log('🔌 Бүх connection-уудыг зогсоож байна...');

    // Socket disconnect
    if (socketRef.current) {
      console.log('🔌 Socket disconnect хийж байна...');
      try {
        // Clear all event listeners first
        if (typeof socketRef.current.removeAllListeners === 'function') {
          socketRef.current.removeAllListeners();
        }
        
        // Socket.io client-д disconnect() функц байдаг
        if (typeof socketRef.current.disconnect === 'function') {
          socketRef.current.disconnect();
        } else {
          console.log('⚠️ Socket disconnect функц байхгүй, close() ашиглаж байна');
          if (typeof socketRef.current.close === 'function') {
            socketRef.current.close();
          }
        }
        socketRef.current = null;
        setSocketConnected(false);
      } catch (error) {
        console.error('❌ Socket disconnect алдаа:', error);
        // Force cleanup even if there's an error
        socketRef.current = null;
        setSocketConnected(false);
      }
    }

    // Global socket disconnect (main process)
    if (window.electron && window.electron.disconnectSocket) {
      console.log('🔌 Global socket disconnect хийж байна...');
      try {
        window.electron.disconnectSocket();
      } catch (error) {
        console.error('❌ Global socket disconnect алдаа:', error);
      }
    }

    // Clear all timers and intervals
    console.log('🧹 Бүх timer-уудыг цэвэрлэж байна...');

    console.log('✅ Бүх connection-ууд зогсоогдлоо');
  };

  // Back button handler
  const handleBack = async () => {

    try {
      await window.electron.invoke('close-captcha-window');
    } catch (error) {
      console.error('❌ CAPTCHA цонх хаахад алдаа:', error);
    }
    console.log('⬅️ Back button дарагдаж байна...');
    disconnectAllConnections();
    onBack();
  };

  // Socket connection setup with debounce
  useEffect(() => {
    let socketSetupTimeout;
    
    if (customerBankAccount?.userId || customerBankAccount?.UserId) {
      const userId = customerBankAccount.userId || customerBankAccount.UserId;
      console.log('🔌 Socket холболт эхлүүлж байна:', userId);

      // Debounce socket setup to prevent multiple connections
      socketSetupTimeout = setTimeout(async () => {
        // Get correct API URL for socket connection
        const getSocketUrl = () => {
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
        };

        // Socket холболт үүсгэх
        const getSocketConnection = async () => {
          try {
            const socketUrl = getSocketUrl();
            console.log('🔌 User-specific socket холболт үүсгэж байна:', socketUrl, 'userId:', userId);
            
            return io(socketUrl, {
              query: { userId: userId }, // ✅ User ID-тай query parameter
              transports: ['polling']
            });
          } catch (error) {
            console.error('❌ Socket connection үүсгэхэд алдаа:', error);
            return null;
          }
        };

        getSocketConnection().then(socket => {
          socketRef.current = socket;

          // Socket events
          socketRef.current.on('connect', () => {
            console.log('✅ User-specific socket холбогдлоо:', socketRef.current.id);
            setSocketConnected(true);

            // userId-тай room-д нэгдэх (server талд автоматаар join хийгддэг)
            socketRef.current.emit('joinRoom', { userId });
            console.log('🏠 User-specific room-д нэгдлээ:', userId);
            
            // CAPTCHA setup илгээх (хэрэв шаардлагатай бол)
            if (customerBankAccount?.IsCitizen !== undefined) {
              socketRef.current.emit('captcha-setup', {
                userOid: userId,
                isCitizen: customerBankAccount.IsCitizen
              });
              console.log('📤 CAPTCHA setup илгээгдлээ:', { userOid: userId, isCitizen: customerBankAccount.IsCitizen });
            }
          });

          socketRef.current.on('disconnect', () => {
            console.log('❌ Socket холболт тасарлаа');
            setSocketConnected(false);
          });

          // Шинэ transaction-ууд ирэх үед (backend дээр filter хийгдсэн)
          socketRef.current.on('newTransactions', (data) => {
            console.log('🆕 User-specific socket-оор шинэ transaction-ууд ирлээ:', data);

            // User-specific filter шалгах
            if (data.data && data.data.userOid && data.data.userOid !== userId) {
              console.log('⚠️ Бусад хэрэглэгчийн transaction ирлээ, алгасах:', data.data.userOid, 'vs', userId);
              return;
            }

            if (data.data && data.data.transactions) {
              const newTransactions = data.data.transactions;

              console.log(`📊 User-specific filter хийгдсэн transaction-ууд: ${newTransactions.length}`);
              
              if (newTransactions.length > 0) {
                console.log('✅ Энэ хэрэглэгчийн transaction-ууд олдлоо:', newTransactions.map(t => ({
                  id: t.id,
                  amount: t.amount,
                  from: t.from,
                  to: t.to,
                  date: t.date,
                  userOid: data.data.userOid
                })));
              } else {
                console.log('ℹ️ Энэ хэрэглэгчийн шинэ transaction байхгүй байна');
              }

              // Шинэ transaction-уудыг нэмэх
              setTransactions(prevTransactions => {
                // Хуучин transaction-уудтай давхцахгүй байх
                const existingIds = new Set(prevTransactions.map(t => `${t.amount}-${t.from}-${t.date}`));
                const uniqueNewTransactions = newTransactions.filter(t =>
                  !existingIds.has(`${t.amount}-${t.from}-${t.date}`)
                );

                if (uniqueNewTransactions.length > 0) {
                  console.log('🆕 Шинэ transaction-ууд нэмэгдлээ:', uniqueNewTransactions.length);
                  
                  setNewTransactionsCount(prev => prev + uniqueNewTransactions.length);

                  // Шинэ transaction-уудыг animation-д нэмэх
                  const newTransactionIds = uniqueNewTransactions.map(t => `${t.amount}-${t.from}-${t.date}`);
                  setAnimatedTransactions(prev => new Set([...prev, ...newTransactionIds]));

                  // 3 секундын дараа шинэ transaction count-ыг reset хийх
                  setTimeout(() => setNewTransactionsCount(0), 3000);

                  // 5 секундын дараа animation-ыг арилгах
                  setTimeout(() => {
                    setAnimatedTransactions(prev => {
                      const newSet = new Set(prev);
                      newTransactionIds.forEach(id => newSet.delete(id));
                      return newSet;
                    });
                  }, 5000);

                  const newTransactionList = [...uniqueNewTransactions, ...prevTransactions];

                  // Нийлбэрийг шинэчлэх
                  const newTotal = calculateTotalAmount(newTransactionList);
                  setTotalAmount(newTotal);
                  console.log('💰 Шинэ transaction нийлбэр:', newTotal.toLocaleString());

                  // Notification харуулах (filtered transactions-ын тоогоор)
                  showNewTransactionNotification(uniqueNewTransactions.length);

                  return newTransactionList;
                }

                return prevTransactions;
              });
            }
          });

          // Token expired event listener
          socketRef.current.on('tokenExpired', (data) => {
            console.log('⚠️ Token expired event ирлээ:', data);
            setErrorMessage('Token дууссан байна, дахин нэвтрэх шаардлагатай');
            
            // Socket холболтыг таслах
            if (socketRef.current) {
              socketRef.current.disconnect();
              setSocketConnected(false);
            }
          });

          // CAPTCHA update event listener
          socketRef.current.on('captcha-update', async (result) => {
            console.log('🎉 Socket-оор CAPTCHA update event ирлээ:', result);

            if (result.success && result.captchaDone) {
              console.log('✅ CAPTCHA амжилттай болсон! fetchAccountAndAmount дуудаж байна...');

              try {
                // 2 секундын дараа fetchAccountAndAmount дуудах (CAPTCHA cookies хадгалагдахыг хүлээх)
                setTimeout(async () => {
                  await tokenRefresh();
                }, 2000);
              } catch (error) {
                console.error('❌ CAPTCHA success дараах fetchAccountAndAmount алдаа:', error);
              }
            }
          });
        });
      }, 1000); // 1 second debounce
    }

    // Cleanup function
    return () => {
      if (socketSetupTimeout) {
        clearTimeout(socketSetupTimeout);
      }
      if (socketRef.current) {
        console.log('🔌 Socket холболт хааж байна');
        try {
          // Socket.io client-д disconnect() функц байдаг
          if (typeof socketRef.current.disconnect === 'function') {
            socketRef.current.disconnect();
          } else if (typeof socketRef.current.close === 'function') {
            socketRef.current.close();
          }
          // Clear all event listeners
          socketRef.current.removeAllListeners();
        } catch (error) {
          console.error('❌ Socket cleanup алдаа:', error);
        } finally {
          socketRef.current = null;
        }
      }
    };
  }, [customerBankAccount]);

  // Шинэ transaction notification харуулах
  const showNewTransactionNotification = (count) => {
    // Browser notification харуулах
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Шинэ гүйлгээ', {
        body: `${count} шинэ гүйлгээ ирлээ`,
       // icon: '/favicon.ico',
       // badge: '/favicon.ico',
        tag: 'novaq-transaction'
      });
    }

    // Console-д мэдээлэл
    console.log(`🆕 ${count} шинэ гүйлгээ ирлээ!`);
  };

  // Notification permission авах
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Fetch account and amount with debounce
  const fetchAccountAndAmount = async () => {
    try {
      console.log('🔍 fetchAccountAndAmount дуудагдаж байна:', { customerBankAccount });
      const transactionsResult = await getTransactions();
      // CAPTCHA шаардлагатай эсэхийг шалгах
      if (transactionsResult.needCaptcha) {

        showCaptchaWindow();
        return;
      }

      if (transactionsResult.data && transactionsResult.data.transactions) {
        console.log('✅ Transaction data амжилттай авлаа:', {
          count: transactionsResult.data.transactions.length
        });
        setTransactions(transactionsResult.data.transactions);

        // Transaction-уудын нийлбэрийг тооцоолох
        const total = calculateTotalAmount(transactionsResult.data.transactions);
        setTotalAmount(total);
        console.log('💰 Transaction нийлбэр:', total.toLocaleString());

        // Account amount-ыг тохируулах
        if (transactionsResult.data.account) {
          setAmount(`₮ ${transactionsResult.data.account.toLocaleString()}`);
        }
      } else {
        console.log('⚠️ Transaction data байхгүй байна');
        setTotalAmount(0);
      }
    } catch (transactionError) {
      console.error('❌ getTransactions алдаа:', transactionError);
      setErrorMessage('Гүйлгээний мэдээлэл авахад алдаа гарлаа');
    }
  };

  const tokenRefresh = async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      console.log('🔍 fetchAccountAndAmount дуудагдаж байна:', { customerBankAccount });
      // 🚀 getTokenAndStore дуудах
      if (customerBankAccount?.bankUserName && customerBankAccount?.bankPassword) {
        console.log('🔑 getTokenAndStore дуудаж байна...');
        const tokenResult = await getTokenAndStore(customerBankAccount.customerId || customerBankAccount.CustomerId);
        console.log('🔍 tokenResult:', tokenResult);
        setTokenResult(tokenResult); // State-д хадгалах
        if (tokenResult.success) {
          fetchAccountAndAmount();
        } else {
          console.log('❌ Token авахад алдаа:', tokenResult.errorMessage);

          // Token авахад алдаа бол CAPTCHA дуудах
          if (tokenResult.needCaptcha) {
            showCaptchaWindow();
          }
          setErrorMessage(tokenResult.errorMessage || 'Token авахад алдаа гарлаа');
        }
      } else {
        console.log('⚠️ Bank credentials олдсонгүй, CAPTCHA дуудах');
        showCaptchaWindow();
      }

    } catch (error) {
      console.error('❌ fetchAccountAndAmount алдаа:', error);
      setErrorMessage('Гүйлгээний мэдээлэл авахад алдаа гарлаа');
    } finally {
      setLoading(false);
    }
  }
  const showCaptchaWindow = async () => {
    console.log('🔄 CAPTCHA дуудаж байна...');
    try {
      await desktopService.clearKhanBankCookiesFromServer(['all_cookies']);
      const result = await window.electron.createCaptchaWindow(customerBankAccount.isCitizen);
      console.log('✅ CAPTCHA дуудагдалаа:', result);
    } catch (captchaError) {
      console.error('❌ CAPTCHA дуудахад алдаа:', captchaError);
      setErrorMessage('CAPTCHA дуудахад алдаа гарлаа');
    }
  }
  // Handle refresh
  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setErrorMessage('');
    try {
      await fetchAccountAndAmount();
    } catch (error) {
      setErrorMessage('Шинэчлэх үед алдаа гарлаа');
    } finally {
      setRefreshing(false);
    }
  };

  // Handle quit app



  const handleQuitApp = async () => {
    try {
      console.log('❌ Quit app дарагдаж байна...');
      // Бүх connection-уудыг зогсоох
      disconnectAllConnections();
      const computerNameResponse = await window.electron.invoke('get-computer-name');
      const computerName = typeof computerNameResponse === 'string' ? computerNameResponse : 'Unknown';
      authService.saveLogoutHistory({
        userName: username,
        computerName: computerName,
        DesktopVersion: require('../../package.json').version
      } );
      const result = await window.electron.invoke('close-app', { userName: username, computerName: computerName });
    } catch (error) {
      console.error('❌ Quit app алдаа:', error);
    }
  };

  // Component mount үед зөвхөн нэг удаа дуудах
  useEffect(() => {
    // Component mount үед зөвхөн нэг удаа дуудах
    const initializeData = async () => {
      try {
        await tokenRefresh();
      } catch (error) {
        console.error('❌ Initial data fetch алдаа:', error);
      }
    };

    initializeData();
  }, []); // Empty dependency array - зөвхөн нэг удаа

  // Apply theme when component mounts or theme changes
  useEffect(() => {
    if (document.querySelector('.mobile-container')) {
      const mobileContainer = document.querySelector('.mobile-container');
      mobileContainer.className = `mobile-container ${theme}`;
    }
  }, [theme]);

  return (
    <>
      <div className={`mobile-container ${theme}`} data-theme={theme}>
        {/* Header */}
        <div className="mobile-header">
          <div className="control-buttons">
            <span className="back-button" onClick={handleBack}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="9" cy="9" r="9"
                  fill="white" fillOpacity="0.15" />

                <path d="M12 9H6M6 9L9 6M6 9L9 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="control-button" onClick={handleQuitApp}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="9" cy="9" r="9" fill="white" fillOpacity="0.15" />
                <path d="M5.5 5.5L12.5 12.5M12.5 5.5L5.5 12.5" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
          </div>
          <div>
            <div className="user-greeting">
              <div className={`status-indicator ${socketConnected ? 'connected' : 'disconnected'}`}>
                <span className="status-dot"></span>
              </div>

              <span className="greeting-text">
                Сайн уу?
              </span>

            </div>
            <div className="name-greeting">
              <span className="greeting-name">{firstName}</span>{' '}
              <span className="greeting-lastname">{lastName}</span><br />
            </div>
          </div>



          <div className="title">
            Дансны орлого
          </div>
        </div>

        {/* Account box */}
        <div className="account-box">
          <span className="account-number">{customerBankAccount?.bankAccountNum || 'Данс олдсонгүй'}</span>
          <span className="account-amount">
            {`₮ ${(typeof totalAmount === 'number' ? totalAmount : 0).toLocaleString('mn-MN')}`}
          </span>
        </div>



        <button
          className={`refresh-button ${loading ? 'loading' : ''}`}
          onClick={handleRefresh}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="loading-spinner">⚡</span>
              Уншиж байна...
            </>
          ) : (
            'Сэргээх (F4)'
          )}
        </button>

        {errorMessage && amount === '₮ 0' && (
          <div className="error-message">
            {errorMessage}
          </div>
        )}

        <div className="main-content">
          <div className="scroll-container" data-scroll-container>
            <ul className="transactions-list">
              {transactions.length === 0 && !loading && (
                <li className="no-transactions">
                  Гүйлгээ олдсонгүй.
                </li>
              )}
              {transactions
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .map((item, idx) => {
                  const transactionId = `${item.amount}-${item.from}-${item.date}`;
                  const isNew = animatedTransactions.has(transactionId);

                  return (
                    <li key={idx} className={`transaction-item ${isNew ? 'new-transaction' : ''}`}>
                      <div className="transaction-content">
                        <div className="transaction-amount">
                          {item.amount?.toLocaleString()}
                        </div>
                        <div className="transaction-details">
                          <div className="transaction-from">
                            {item.from}
                          </div>
                          <div className="transaction-date">
                            {item.date}
                          </div>
                        </div>
                      </div>
                      {isNew && (
                        <div className="new-transaction-indicator">
                          🆕 Шинэ
                        </div>
                      )}
                    </li>
                  );
                })}
            </ul>
          </div>         
        </div>
       
      </div>
        <div 
        className="footer" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: '#f5f5f5', padding: '10px', textAlign: 'center', borderTop: '1px solid #ddd', zIndex: 1000 }}>
          {`@bto softline llc ${process.env.APP_VERSION}`}
          {customer && (() => {
            // contractEndDate байхгүй бол харуулахгүй
            const today = new Date();
            const endDate = customer.contractEndDate ? new Date(customer.contractEndDate) : null;
            const diffTime = endDate ? endDate - today : 0;
            const daysLeft = endDate ? Math.ceil(diffTime / (1000 * 60 * 60 * 24)) : 0;
            // 6 буюу түүнээс дээш хоног үлдсэн бол contract info харуулахгүй
            if (daysLeft >= 6) return null;
            return <ContractInfoDisplay customer={customer} />;
          })()}
        </div>
    </>
  );
};

// Contract Info Display Component
const ContractInfoDisplay = ({ customer }) => {
  const today = new Date();
  const endDate = customer.contractEndDate ? new Date(customer.contractEndDate) : null;
  const diffTime = endDate ? endDate - today : 0;
  const daysLeft = endDate ? Math.ceil(diffTime / (1000 * 60 * 60 * 24)) : 0;

  const getContractStatus = (days) => {
      if (days == 5) return {
        background: '#fff',
        color: '#0076FF',
        message: `Үйлчилгээний хугацаа дуусахад ${days} хоног үлдсэн`,
        icon: '🖐️'
      };
    if (days == 4) return {
      background: '#fff',
      color: '#2e7d32',
      message: `Үйлчилгээний хугацаа дуусахад ${days} хоног үлдсэн`,
      icon: '🖖'
    };
    if (days == 3) return {
      background: '#fff',
      color: '#F1C232',
      message: `Үйлчилгээний хугацаа дуусахад ${days} хоног үлдсэн`,
      icon: '🤟'
    };
    if (days == 2) return {
      background: '#fff',
      color: '#f57c00',
      message: `Үйлчилгээний хугацаа дуусахад ${days} хоног үлдсэн`,
      icon: '✌️'
    };
    if (days == 1) return {
      background: '#fff',
      color: '#F44336',
      message: `Үйлчилгээний хугацаа дуусахад ${days} хоног үлдсэн`,
      icon: '☝️'
    };
    if (days > 0) return {
      background: '#fff',
      color: '#d32f2f',
      message: `Үйлчилгээний хугацаа дуусахад ${days} хоног үлдсэн`,
      icon: '👆'
    };
    return {
      background: '#fff',
      color: '#721c24',
      message: 'Гэрээ дууссан',
      icon: '❌'
    };
  };

  const { background, color, message, icon } = getContractStatus(daysLeft);

  return (
    <div style={{
      margin: '12px 16px',
      padding: '8px 12px',
      background: background,
      color: color,
      borderRadius: '6px',
      fontSize: '12px',
      fontWeight: '600',
      textAlign: 'center',
      border: `1px solid ${color}20`
    }}>
      {icon} {message}
    </div>
  );
};

export default StatementScreen;
