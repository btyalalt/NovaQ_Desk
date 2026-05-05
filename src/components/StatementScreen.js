import React, {useEffect, useRef, useState} from 'react';
import './StatementScreen.css';
import {getTokenAndStore, getTransactions} from '../services/apiService';
import DesktopService from '../services/desktopService';
import authService from '../services/authService';
import socketService from '../services/socketService';

const desktopService = new DesktopService();
const KHAN_BANK_ID = 'A09422E3-3B85-4883-9F78-2030851A6B9C';
const TDB_BANK_ID = '4CC51C7F-FE7E-4497-A44E-BF34450F8708';
const MANDATORY_DARK_BANK_ID = 'E0E0317E-3D5D-4F1A-B950-B84DDD7E9F78';
const BANK_AMOUNT_COLORS = {
    [KHAN_BANK_ID]: '#00A651',
    [TDB_BANK_ID]: '#1296DB',
    [MANDATORY_DARK_BANK_ID]: '#343A46',
};

const StatementScreen = ({
                             onBack,
                             username,
                             firstName,
                             lastName,
                             customerBankAccount,
                             customer,
                             theme = 'light'
                         }) => {
    const [transactions, setTransactions] = useState([]);
    const [totalAmount, setTotalAmount] = useState(0);
    const [accountTotals, setAccountTotals] = useState([]);
    const [selectedAccountNumber, setSelectedAccountNumber] = useState(null);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [errorMessageBank, setErrorMessageBank] = useState('');
    const [socketConnected, setSocketConnected] = useState(false);
    const [newTransactionsCount, setNewTransactionsCount] = useState(0);
    const [animatedTransactions, setAnimatedTransactions] = useState(new Set());
    const [tokenResult, setTokenResult] = useState(null);
    const [showAmount, setShowAmount] = useState(false);
    const [showAccountList, setShowAccountList] = useState(false);

    const fetchingRef = useRef(false);
    const captchaOpenRef = useRef(false);
    const accountDropdownRef = useRef(null);

    // ─── Helper ────────────────────────────────────────────────

    const calculateTotalAmount = (txList) => {
        return txList.reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0);
    };

    const formatMoney = (value) => {
        const numericValue = Number(value) || 0;
        return numericValue.toLocaleString('mn-MN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };
    const MASKED_AMOUNT = '************';

    const normalizeAccountNumber = (value) => String(value || '').trim();

    const hydrateAccountTotals = (data) => {
        const totals = Array.isArray(data?.accountTotals)
            ? data.accountTotals.filter((item) => item && item.accountNumber)
            : [];

        setAccountTotals(totals);

        const preferredAccount =
            normalizeAccountNumber(selectedAccountNumber) ||
            normalizeAccountNumber(customerBankAccount?.bankAccountNum);

        const matchedAccount = totals.find(
            (item) => normalizeAccountNumber(item.accountNumber) === preferredAccount
        );

        setSelectedAccountNumber(
            matchedAccount?.accountNumber || totals[0]?.accountNumber || null
        );
    };

    // ─── Socket setup (нэг удаа) ──────────────────────────────

    useEffect(() => {
        const userId = customerBankAccount?.userId || customerBankAccount?.UserId;
        if (!userId) return;

        // console.log(`[StatementScreen] Socket холболт эхлүүлж байна: customerBankAccount :`, customerBankAccount);
        // console.log('[StatementScreen] Socket холболт эхлүүлж байна:', userId);

        // 1. Socket холбогдох
        socketService.connect(userId, customerBankAccount?.isCitizen);

        // 2. Холболтын төлөв
        socketService.onConnectChange((connected) => {
            setSocketConnected(connected);
        });

        // 3. Шинэ гүйлгээ (server TransactionPoller-ээс)
        socketService.onNewTransactions((data) => {
            if (!data?.data?.transactions) return;

            // User шалгалт
            if (data.data.userOid && data.data.userOid !== userId) return;

            const fallbackBankId = String(customerBankAccount?.bankId || customerBankAccount?.BankId || '').toUpperCase();
            const incoming = data.data.transactions.map((tx) => ({
                ...tx,
                bankId: String(tx?.bankId || fallbackBankId).toUpperCase(),
            }));
            if (incoming.length === 0) return;

            setTransactions(prev => {
                const existingIds = new Set(
                    prev.map(t => `${String(t.bankId || '').toUpperCase()}-${t.amount}-${t.from}-${t.date}`)
                );
                const unique = incoming.filter(
                    t => !existingIds.has(`${String(t.bankId || '').toUpperCase()}-${t.amount}-${t.from}-${t.date}`)
                );

                if (unique.length === 0) return prev;

                console.log(`🆕 ${unique.length} шинэ гүйлгээ ирлээ`);

                // Animation
                const newIds = unique.map(t => `${String(t.bankId || '').toUpperCase()}-${t.amount}-${t.from}-${t.date}`);
                setAnimatedTransactions(prev => new Set([...prev, ...newIds]));
                setNewTransactionsCount(prev => prev + unique.length);

                setTimeout(() => setNewTransactionsCount(0), 3000);
                setTimeout(() => {
                    setAnimatedTransactions(prev => {
                        const s = new Set(prev);
                        newIds.forEach(id => s.delete(id));
                        return s;
                    });
                }, 5000);

                const merged = [...unique, ...prev];
                const total = calculateTotalAmount(merged);
                setTotalAmount(total);

                // Notification
                showNewTransactionNotification(unique.length);

                return merged;
            });
        });

        // 4. CAPTCHA дууссан (server captcha-listener-ээс)
        socketService.onCaptchaDone((result) => {
            console.log('[StatementScreen] CAPTCHA дууслаа');
            captchaOpenRef.current = false;
            setErrorMessage('');
            try {
                const closeResult = window.electron.closeCaptchaWindow();
                console.log('[StatementScreen] closeCaptchaWindow result:', closeResult);
            } catch (err) {
                console.error('[StatementScreen] closeCaptchaWindow алдаа:', err);
            }
        });

        // 5. CAPTCHA шаардлагатай (server poller илрүүлсэн)
        socketService.onCaptchaRequired((data) => {
            console.log('[StatementScreen] CAPTCHA шаардлагатай:', data?.message);
            setErrorMessage(data?.message || 'CAPTCHA шаардлагатай');
            showCaptchaWindow().then();
        });

        // 6. Token дууссан
        socketService.onTokenExpired(() => {
            setErrorMessage('Token дууссан байна, дахин нэвтрэх шаардлагатай');
        });

        // Cleanup
        return () => {
            console.log('[StatementScreen] Socket disconnect');
            socketService.disconnect();

            // ← Unmount болоход CAPTCHA цонх нээлттэй бол хаах
            if (captchaOpenRef.current) {
                captchaOpenRef.current = false;
                window.electron?.closeCaptchaWindow?.();
            }
        };
    }, [customerBankAccount]);

    // ─── Notification ──────────────────────────────────────────

    useEffect(() => {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    const showNewTransactionNotification = (count) => {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Шинэ гүйлгээ', {
                body: `${count} шинэ гүйлгээ ирлээ`,
                tag: 'novaq-transaction'
            });
        }
    };

    // ─── Fetch (зөвхөн гар аргаар: mount + Сэргээх товч) ─────
    const fetchAccountAndAmount = async () => {
        if (captchaOpenRef.current) {
            console.log('⚠️ CAPTCHA нээлттэй, алгасах');
            return;
        }
        if (fetchingRef.current) {
            console.log('⚠️ Аль хэдийн ажиллаж байна');
            return;
        }

        fetchingRef.current = true;
        try {
            const response = await getTransactions();

            if (response.needCaptcha) {
                showCaptchaWindow();
                return;
            }

            const { data } = response;
            if (!data) {
                setErrorMessage(response.errorMessage || 'Серверээс хариу ирсэнгүй');
                return;
            }

            switch (data.code) {
                case 'OK':
                    setErrorMessage('');
                    setErrorMessageBank('');
                    if (data.transactions) {
                        setTransactions(data.transactions);
                        setTotalAmount(calculateTotalAmount(data.transactions));
                    }
                    hydrateAccountTotals(data);
                    break;

                case 'CAPTCHA_PENDING':
                    setErrorMessage(data.message || 'CAPTCHA шаардлагатай');
                    setBankResponseError(data.bankResponse);
                    showCaptchaWindow();
                    if (data.transactions?.length > 0) {
                        setTransactions(data.transactions);
                        setTotalAmount(calculateTotalAmount(data.transactions));
                    }
                    hydrateAccountTotals(data);
                    break;

                case 'REGISTER_DEVICE':
                    setErrorMessage(data.message || 'Шинээр төхөөрөмж таниулах шаардлагатай');
                    setBankResponseError(data.bankResponse);
                    showCaptchaWindow();
                    break;

                case 'PASSWORD_BLOCKED':
                    setErrorMessage(data.message || 'Нууц үг блоклогдсон');
                    setBankResponseError(data.bankResponse);
                    break;

                case 'CONTRACT_EXPIRED':
                    setErrorMessage(data.message || 'Гэрээний хугацаа дууссан');
                    setBankResponseError(data.bankResponse);
                    break;

                case 'BANK_ERROR':
                case 'CONNECTION_ERROR':
                    setErrorMessage(data.message || 'Банкны серверийн алдаа');
                    setBankResponseError(data.bankResponse);
                    break;

                case 'TOKEN_EXPIRED':
                    setErrorMessage(data.message || 'Token дууссан байна');
                    setBankResponseError(data.bankResponse);
                    break;

                case 'NO_ACCOUNT':
                    setErrorMessage(data.message || 'Bank account олдсонгүй');
                    setBankResponseError(data.bankResponse);
                    break;

                default:
                    // Legacy формат
                    if (data.captchaPending) {
                        setErrorMessage(data.bankMessage || 'CAPTCHA шаардлагатай');
                        showCaptchaWindow();
                    } else if (data.registerDevice) {
                        setErrorMessage(data.bankMessage || 'Төхөөрөмж таниулах');
                        showCaptchaWindow();
                    } else if (data.transactions) {
                        setErrorMessage('');
                        setErrorMessageBank('');
                        setTransactions(data.transactions);
                        setTotalAmount(calculateTotalAmount(data.transactions));
                        hydrateAccountTotals(data);
                    }
                    break;
            }
        } catch (err) {
            console.error('❌ getTransactions алдаа:', err);
            setErrorMessage('Гүйлгээний мэдээлэл авахад алдаа гарлаа');
        } finally {
            fetchingRef.current = false;
        }
    };

// ─── Helper: bankResponse-г errorMessageBank-д тохируулах ───

    const setBankResponseError = (bankResponse) => {
        if (bankResponse && (bankResponse.errorCode || bankResponse.bankMessage)) {
            const parts = [];
            if (bankResponse.errorCode) parts.push(bankResponse.errorCode);
            if (bankResponse.bankMessage) parts.push(bankResponse.bankMessage);
            if (bankResponse.statusCode) parts.push(`HTTP ${bankResponse.statusCode}`);
            setErrorMessageBank(parts.join(' : '));
        } else {
            setErrorMessageBank('');
        }
    };

    // ─── Token refresh ─────────────────────────────────────────

    const tokenRefresh = async () => {
        if (captchaOpenRef.current) return;

        setLoading(true);
        setErrorMessage('');

        try {
            if (customerBankAccount?.bankUserName && customerBankAccount?.bankPassword) {
                const result = await getTokenAndStore(
                    customerBankAccount.customerId || customerBankAccount.CustomerId
                );
                setTokenResult(result);

                if (result.isDuplicate) return;

                if (result.success) {
                    await fetchAccountAndAmount();
                } else {
                    if (result.needCaptcha) showCaptchaWindow();


                    setErrorMessage(result.errorMessage || 'Token авахад алдаа гарлаа');
                    if(result.bankResponse){
                        setErrorMessageBank(result.bankResponse.errorCode + ' : ' + result.bankResponse.bankMessage)
                    }
                }
            } else {
                showCaptchaWindow();
            }
        } catch (error) {
            console.error('❌ tokenRefresh алдаа:', error);
            setErrorMessage('Token шинэчлэхэд алдаа гарлаа');
        } finally {
            setLoading(false);
        }
    };

    // ─── CAPTCHA ───────────────────────────────────────────────

    const showCaptchaWindow = async () => {
        if (captchaOpenRef.current) {
            console.log('⚠️ CAPTCHA аль хэдийн нээлттэй');
            return;
        }

        captchaOpenRef.current = true;

        // ← Server-д captcha-setup илгээх
        const userId = customerBankAccount?.userId || customerBankAccount?.UserId;
        socketService.emitCaptchaSetup(userId, customerBankAccount?.isCitizen);

        try {
            await desktopService.clearKhanBankCookiesFromServer(['all_cookies']);
            await window.electron.createCaptchaWindow(customerBankAccount.isCitizen);
        } catch (err) {
            console.error('❌ CAPTCHA нээхэд алдаа:', err);
            setErrorMessage('CAPTCHA нээхэд алдаа гарлаа');
            captchaOpenRef.current = false;
        }
    };

    // ─── Disconnect ────────────────────────────────────────────

    const disconnectAll = () => {
        captchaOpenRef.current = false;
        socketService.disconnect();

        if (window.electron?.disconnectSocket) {
            try { window.electron.disconnectSocket(); } catch (_) {}
        }
    };

    // ─── Handlers ──────────────────────────────────────────────

    const handleBack = async () => {
        try {
            await window.electron.invoke('close-captcha-window');
        } catch (_) {}
        disconnectAll();
        onBack();
    };

    const handleRefresh = async () => {
        console.log('handleRefresh', refreshing)
        if (refreshing) return;
        setRefreshing(true);
        setErrorMessage('');
        try {
            await fetchAccountAndAmount();
        } catch (_) {
            setErrorMessage('Шинэчлэх үед алдаа гарлаа');
            captchaOpenRef.current = false;
        } finally {
            setRefreshing(false);
        }
    };

    const handleQuitApp = async () => {
        try {
            disconnectAll();
            const computerNameResponse = await window.electron.invoke('get-computer-name');
            const computerName = typeof computerNameResponse === 'string' ? computerNameResponse : 'Unknown';
            authService.saveLogoutHistory({
                userName: username,
                computerName,
                DesktopVersion: require('../../package.json').version
            });
            await window.electron.invoke('close-app', { userName: username, computerName });
        } catch (error) {
            console.error('❌ Quit app алдаа:', error);
        }
    };

    // ─── Init (нэг удаа) ──────────────────────────────────────

    useEffect(() => {
        tokenRefresh();
    }, []);

    useEffect(() => {
        setShowAccountList(false);
    }, [customerBankAccount?.bankAccountNum]);

    useEffect(() => {
        if (!showAccountList) return undefined;

        const handleOutsideClick = (event) => {
            if (!accountDropdownRef.current) return;
            if (!accountDropdownRef.current.contains(event.target)) {
                setShowAccountList(false);
                setShowAmount(false);
            }
        };

        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [showAccountList]);

    // ─── Theme ─────────────────────────────────────────────────

    useEffect(() => {
        const el = document.querySelector('.mobile-container');
        if (el) el.className = `mobile-container ${theme}`;
    }, [theme]);

    // ─── Render ────────────────────────────────────────────────

    const hasMultipleAccounts = accountTotals.length >= 2;
    const selectedAccount = accountTotals.find(
        (item) => normalizeAccountNumber(item.accountNumber) === normalizeAccountNumber(selectedAccountNumber)
    );
    const displayedAccountNumber =
        selectedAccount?.accountNumber || customerBankAccount?.bankAccountNum || 'Данс олдсонгүй';
    const displayedAmount = selectedAccount?.amountSum ?? totalAmount;

    const handleAmountClick = () => {
        if (hasMultipleAccounts) {
            setShowAccountList((prev) => {
                const next = !prev;
                setShowAmount(next);
                return next;
            });
            return;
        }

        setShowAccountList(false);
        setShowAmount((prev) => !prev);
    };

    const handleSelectAccount = (account) => {
        setSelectedAccountNumber(account.accountNumber);
        setShowAccountList(false);
        setShowAmount(false);
    };

    return (
        <>
            <div className={`mobile-container ${theme}`} data-theme={theme}>
                {/* Header */}
                <div className="mobile-header">
                    <div className="control-buttons">
                        <div className="right-buttons">
              <span className="back-button" onClick={handleBack}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="9" cy="9" r="9" fill="white" fillOpacity="0.15" />
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
                    </div>
                    <div>
                        <div className="user-greeting">
                            <div className={`status-indicator ${socketConnected ? 'connected' : 'disconnected'}`}>
                                <span className="status-dot"></span>
                            </div>
                            <span className="greeting-text">Сайн уу?</span>
                        </div>
                        <div className="name-greeting">
                            <span className="greeting-name">{firstName}</span>{' '}
                            <span className="greeting-lastname">{lastName}</span><br />
                        </div>
                    </div>
                    <div className="title">Дансны орлого</div>
                </div>

                {/* Account box */}
                <div className="account-dropdown-wrapper" ref={accountDropdownRef}>
                    <div className="account-box">
                        <span className="account-number">{displayedAccountNumber}</span>
                        <span className="account-amount" style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            <span style={{ userSelect: 'none' }}>
              {showAmount
                  ? `₮ ${formatMoney(displayedAmount)}`
                  : MASKED_AMOUNT
              }
            </span>
            <button
                type="button"
                className="Income"
                onClick={handleAmountClick}
                style={{
                    background: 'none', border: 'none', padding: 0, margin: 0,
                    cursor: 'pointer', outline: 'none', boxShadow: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '28px', height: '28px'
                }}
                title={showAmount ? 'Нуух' : 'Харах'}
            >
              <svg width="24" height="24" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 6V12M9 6L6 9M9 6L12 9" stroke="#0076FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </span>
                    </div>
                    {showAccountList && hasMultipleAccounts && (
                        <div className="account-totals-list">
                            {accountTotals.map((account) => {
                                const accountNumber = normalizeAccountNumber(account.accountNumber);
                                const isSelected = accountNumber === normalizeAccountNumber(selectedAccountNumber);
                                return (
                                    <button
                                        key={accountNumber}
                                        type="button"
                                        className={`account-totals-item ${isSelected ? 'active' : ''}`}
                                        onClick={() => handleSelectAccount(account)}
                                    >
                                        <span>{accountNumber}</span>
                                        <span>{showAmount ? `₮ ${formatMoney(account.amountSum)}` : MASKED_AMOUNT}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
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

                {errorMessage && (
                    <div className="error-message">{errorMessage}</div>
                )}
                {errorMessage && errorMessageBank && (
                    <div className="error-message">{errorMessageBank}</div>
                )}

                <div className="main-content">
                    <div className="scroll-container" data-scroll-container>
                        <ul className="transactions-list">
                            {transactions.length === 0 && !loading && (
                                <li className="no-transactions">Гүйлгээ олдсонгүй.</li>
                            )}
                            {transactions
                                .sort((a, b) => new Date(b.date) - new Date(a.date))
                                .map((item, idx) => {
                                    const txId = `${String(item.bankId || '').toUpperCase()}-${item.amount}-${item.from}-${item.date}`;
                                    const isNew = animatedTransactions.has(txId);
                                    const bankId = String(item.bankId || '').toUpperCase();
                                    const amountColor = BANK_AMOUNT_COLORS[bankId];
                                    return (
                                        <li key={idx} className={`transaction-item ${isNew ? 'new-transaction' : ''}`}>
                                            <div className="transaction-content">
                                                <div
                                                    className="transaction-amount"
                                                    style={amountColor ? {color: amountColor} : undefined}
                                                >
                                                    {item.amount?.toLocaleString()}
                                                </div>
                                                <div className="transaction-details">
                                                    <div className="transaction-from">{item.from}</div>
                                                    <div className="transaction-date">{item.date}</div>
                                                </div>
                                            </div>
                                            {isNew && <div className="new-transaction-indicator">🆕 Шинэ</div>}
                                        </li>
                                    );
                                })}
                        </ul>
                    </div>
                </div>
            </div>

            <div className="footer" style={{
                position: 'fixed', bottom: 0, left: 0, right: 0,
                backgroundColor: '#f5f5f5', padding: '10px', textAlign: 'center',
                borderTop: '1px solid #ddd', zIndex: 1000
            }}>
                {`@bto softline llc ${process.env.APP_VERSION}`}
                {customer && (() => {
                    const today = new Date();
                    const endDate = customer.contractEndDate ? new Date(customer.contractEndDate) : null;
                    const diffTime = endDate ? endDate - today : 0;
                    const daysLeft = endDate ? Math.ceil(diffTime / (1000 * 60 * 60 * 24)) : 0;
                    if (daysLeft >= 6) return null;
                    return <ContractInfoDisplay customer={customer} />;
                })()}
            </div>
        </>
    );
};

// ─── Contract Info Display ───────────────────────────────────

const ContractInfoDisplay = ({ customer }) => {
    const today = new Date();
    const endDate = customer.contractEndDate ? new Date(customer.contractEndDate) : null;
    const diffTime = endDate ? endDate - today : 0;
    const daysLeft = endDate ? Math.ceil(diffTime / (1000 * 60 * 60 * 24)) : 0;

    const getContractStatus = (days) => {
        if (days === 5) return { color: '#0076FF', message: `Үйлчилгээний хугацаа дуусахад ${days} хоног үлдсэн`, icon: '🖐️' };
        if (days === 4) return { color: '#2e7d32', message: `Үйлчилгээний хугацаа дуусахад ${days} хоног үлдсэн`, icon: '🖖' };
        if (days === 3) return { color: '#F1C232', message: `Үйлчилгээний хугацаа дуусахад ${days} хоног үлдсэн`, icon: '🤟' };
        if (days === 2) return { color: '#f57c00', message: `Үйлчилгээний хугацаа дуусахад ${days} хоног үлдсэн`, icon: '✌️' };
        if (days === 1) return { color: '#F44336', message: `Үйлчилгээний хугацаа дуусахад ${days} хоног үлдсэн`, icon: '☝️' };
        if (days > 0) return { color: '#d32f2f', message: `Үйлчилгээний хугацаа дуусахад ${days} хоног үлдсэн`, icon: '👆' };
        return { color: '#721c24', message: 'Гэрээ дууссан', icon: '❌' };
    };

    const { color, message, icon } = getContractStatus(daysLeft);

    return (
        <div style={{
            margin: '12px 16px', padding: '8px 12px', background: '#fff',
            color, borderRadius: '6px', fontSize: '12px', fontWeight: '600',
            textAlign: 'center', border: `1px solid ${color}20`
        }}>
            {icon} {message}
        </div>
    );
};

export default StatementScreen;