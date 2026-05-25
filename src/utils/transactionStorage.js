/**
 * Гүйлгээний localStorage — банк бүрээр сүүлийн огноо, delta sync-д ашиглана.
 */

const STORAGE_PREFIX = 'nq_transactions_';

const normalizeBankId = (bankId) => String(bankId || '').trim().toUpperCase();

const txKey = (tx) => {
    const bankId = normalizeBankId(tx?.bankId);
    const id = String(tx?.id ?? '').trim();
    if (id) return `${bankId}|id|${id}`;
    return `${bankId}|${tx?.amount}|${tx?.from}|${tx?.date}|${tx?.accountNumber}`;
};

/** "2026-05-19 18:26:03" → ms (Улаанбаатарын ханш цаг, timezone шилжүүлэхгүй) */
const parseTxDateMs = (value) => {
    if (!value) return null;
    const s = String(value).trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
    if (m) {
        return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 8, +m[5], +m[6]);
    }
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
};

const formatTxDate = (ms) => {
    const pad = (n) => String(n).padStart(2, '0');
    const ubMs = ms + 8 * 60 * 60 * 1000;
    const d = new Date(ubMs);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
};

const storageKey = (userOid) => `${STORAGE_PREFIX}${String(userOid || '').trim()}`;

/**
 * Бизнес огнооны цонх:
 * - start: тухайн өдрийн 05:00
 * - end:   маргаашийн 05:00
 * (хэрэв одоо 05:00-аас өмнө бол start=өчигдрийн 05:00)
 */
const getBusinessWindowBounds = () => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(6, 0, 0, 0);
    if (now.getTime() < start.getTime()) {
        start.setDate(start.getDate() - 1);
    }
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return {startMs: start.getTime(), endMs: end.getTime()};
};

const filterTransactionsToBusinessWindow = (transactions) => {
    const list = Array.isArray(transactions) ? transactions : [];
    const {startMs, endMs} = getBusinessWindowBounds();
    return list.filter((tx) => {
        const ms = parseTxDateMs(tx?.date);
        if (ms == null) return false;
        return ms >= startMs && ms < endMs;
    });
};

const readStore = (userOid) => {
    if (!userOid || typeof window === 'undefined' || !window.localStorage) return null;
    try {
        const raw = window.localStorage.getItem(storageKey(userOid));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        return {
            transactions: filterTransactionsToBusinessWindow(parsed.transactions),
            lastDateByBank:
                parsed.lastDateByBank && typeof parsed.lastDateByBank === 'object'
                    ? parsed.lastDateByBank
                    : {},
        };
    } catch {
        return null;
    }
};

const writeStore = (userOid, store) => {
    if (!userOid || typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(
        storageKey(userOid),
        JSON.stringify({
            transactions: store.transactions || [],
            lastDateByBank: store.lastDateByBank || {},
            updatedAt: new Date().toISOString(),
        }),
    );
};

/** Банк бүрээр сүүлийн гүйлгээний огноо — API sinceByBank query */
const buildSinceByBank = (userOid) => {
    const store = readStore(userOid);
    if (!store?.lastDateByBank) return null;
    const out = {};
    for (const [bankId, dateStr] of Object.entries(store.lastDateByBank)) {
        const id = normalizeBankId(bankId);
        const s = String(dateStr || '').trim();
        if (id && s) out[id] = s;
    }
    return Object.keys(out).length > 0 ? out : null;
};

const recomputeLastDateByBank = (transactions) => {
    const lastDateByBank = {};
    for (const tx of transactions || []) {
        const bankId = normalizeBankId(tx?.bankId);
        const ms = parseTxDateMs(tx?.date);
        if (!bankId || ms == null) continue;
        const prev = parseTxDateMs(lastDateByBank[bankId]);
        if (prev == null || ms > prev) {
            lastDateByBank[bankId] = formatTxDate(ms);
        }
    }
    return lastDateByBank;
};

const loadStoredTransactions = (userOid) => readStore(userOid);

const saveStoredTransactions = (userOid, transactions) => {
    if (!userOid) return;
    const list = filterTransactionsToBusinessWindow(transactions);
    writeStore(userOid, {
        transactions: list,
        lastDateByBank: recomputeLastDateByBank(list),
    });
};

const mergeTransactionLists = (existing, incoming) => {
    const map = new Map();
    for (const tx of filterTransactionsToBusinessWindow(existing)) {
        map.set(txKey(tx), tx);
    }
    for (const tx of filterTransactionsToBusinessWindow(incoming)) {
        map.set(txKey(tx), tx);
    }
    return Array.from(map.values()).sort((a, b) => {
        const am = parseTxDateMs(a?.date) ?? 0;
        const bm = parseTxDateMs(b?.date) ?? 0;
        return bm - am;
    });
};

const calculateAccountTotalsFromTransactions = (transactions) => {
    const sums = new Map();
    for (const tx of transactions || []) {
        const accountNumber = String(tx?.accountNumber || '').trim();
        if (!accountNumber) continue;
        const amount = Number(tx?.amount) || 0;
        if (!Number.isFinite(amount)) continue;
        sums.set(accountNumber, (sums.get(accountNumber) || 0) + amount);
    }
    return Array.from(sums.entries()).map(([accountNumber, amountSum]) => ({
        accountNumber,
        amountSum,
    }));
};

const clearStoredTransactions = (userOid) => {
    if (!userOid || typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(storageKey(userOid));
};

/** Бүх `nq_transactions_*` түлхүүрүүдийг устгана (олон userOid-ийн үлдэгдэл) */
const clearAllTransactionCaches = () => {
    if (typeof window === 'undefined' || !window.localStorage) return 0;
    const keys = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(STORAGE_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
    return keys.length;
};

export {
    buildSinceByBank,
    loadStoredTransactions,
    saveStoredTransactions,
    mergeTransactionLists,
    calculateAccountTotalsFromTransactions,
    clearStoredTransactions,
    clearAllTransactionCaches,
};
