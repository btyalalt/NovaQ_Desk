/**
 * CAPTCHA цонхны Chrome fingerprint shim (Electron 11 ≈ Chromium 87).
 * contextIsolation: false — page-тай нэг world-д ажиллана (E11-д шаардлагатай).
 *
 * Зорилго: Khan Bank-ийн bot/automation шалгалтад Chrome 87 шиг харагдах.
 * Chrome 120 гэж хэлбэл JS feature mismatch → цагаан дэлгэц (UA-г main process тохируулна).
 */
(() => {
    const defineNav = (key, value) => {
        try {
            Object.defineProperty(navigator, key, {
                get: () => value,
                configurable: true,
            });
        } catch (_) { /* */ }
    };

    try {
        // Automation илрүүлэлт
        try {
            delete Object.getPrototypeOf(navigator).webdriver;
        } catch (_) { /* */ }
        defineNav('webdriver', false);

        // Chrome 87 desktop
        defineNav('vendor', 'Google Inc.');
        defineNav('platform', 'Win32');
        defineNav('maxTouchPoints', 0);
        defineNav('hardwareConcurrency', navigator.hardwareConcurrency || 4);
        defineNav('deviceMemory', navigator.deviceMemory || 8);

        defineNav('languages', ['mn-MN', 'mn', 'en-US', 'en']);
        defineNav('language', 'mn-MN');

        // Electron UA-д "Electron/x.x" үлдсэн бол арилгах
        const ua = navigator.userAgent || '';
        if (/Electron\//i.test(ua)) {
            defineNav(
                'userAgent',
                ua.replace(/\s*Electron\/[\d.]+\s*/i, ' ').replace(/\s+/g, ' ').trim()
            );
        }

        const pluginData = [
            { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
            { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
            { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
        ];
        const fakePlugins = pluginData.map((p) => ({ ...p, length: 1 }));
        fakePlugins.item = (i) => fakePlugins[i] || null;
        fakePlugins.namedItem = (name) => fakePlugins.find((p) => p.name === name) || null;
        fakePlugins.refresh = () => {};
        defineNav('plugins', fakePlugins);

        const mimeData = [
            { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
            { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format' },
            { type: 'application/x-nacl', suffixes: '', description: 'Native Client Executable' },
            { type: 'application/x-pnacl', suffixes: '', description: 'Portable Native Client Executable' },
        ];
        const fakeMimeTypes = mimeData.map((m, i) => ({
            ...m,
            enabledPlugin: fakePlugins[Math.min(i, fakePlugins.length - 1)],
        }));
        fakeMimeTypes.item = (i) => fakeMimeTypes[i] || null;
        fakeMimeTypes.namedItem = (name) => fakeMimeTypes.find((m) => m.type === name) || null;
        defineNav('mimeTypes', fakeMimeTypes);

        if (!window.chrome) {
            window.chrome = {};
        }
        if (!window.chrome.runtime) {
            window.chrome.runtime = {
                connect: () => ({ onMessage: { addListener: () => {} }, postMessage: () => {} }),
                sendMessage: () => {},
                id: undefined,
            };
        }
        if (!window.chrome.loadTimes) {
            window.chrome.loadTimes = () => ({
                commitLoadTime: Date.now() / 1000,
                connectionInfo: 'http/1.1',
                finishDocumentLoadTime: Date.now() / 1000,
                finishLoadTime: Date.now() / 1000,
                firstPaintAfterLoadTime: 0,
                firstPaintTime: Date.now() / 1000,
                navigationType: 'Other',
                npnNegotiatedProtocol: 'unknown',
                requestTime: Date.now() / 1000 - 0.3,
                startLoadTime: Date.now() / 1000 - 0.5,
                wasAlternateProtocolAvailable: false,
                wasFetchedViaSpdy: false,
                wasNpnNegotiated: false,
            });
        }
        if (!window.chrome.csi) {
            window.chrome.csi = () => ({
                onloadT: Date.now(),
                pageT: Date.now(),
                startE: Date.now(),
                tran: 15,
            });
        }
        if (!window.chrome.app) {
            window.chrome.app = {
                isInstalled: false,
                getDetails: () => null,
                getIsInstalled: () => false,
                installState: () => 'not_installed',
                runningState: () => 'cannot_run',
            };
        }

        // Electron-specific global-уудыг нуух
        try {
            if (typeof window.process !== 'undefined') {
                Object.defineProperty(window, 'process', {
                    get: () => undefined,
                    configurable: true,
                });
            }
        } catch (_) { /* */ }
    } catch (_) {
        /* fingerprint patch алдааг CAPTCHA урсгалд саатуулахгүй */
    }
})();
