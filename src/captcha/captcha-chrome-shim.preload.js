/**
 * CAPTCHA цонхны Chrome fingerprint shim (Electron 11).
 * contextIsolation: false — page-тай нэг world-д ажиллана (E11-д шаардлагатай).
 */
(() => {
    try {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => false,
            configurable: true,
        });

        if (!window.chrome) {
            window.chrome = {
                runtime: {},
                loadTimes: () => ({
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
                }),
                csi: () => ({ onloadT: Date.now(), pageT: Date.now(), startE: Date.now(), tran: 15 }),
            };
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
        Object.defineProperty(navigator, 'plugins', {
            get: () => fakePlugins,
            configurable: true,
        });

        Object.defineProperty(navigator, 'languages', {
            get: () => ['mn-MN', 'mn', 'en-US', 'en'],
            configurable: true,
        });

        Object.defineProperty(navigator, 'language', {
            get: () => 'mn-MN',
            configurable: true,
        });
    } catch (_) {
        /* fingerprint patch алдааг CAPTCHA урсгалд саатуулахгүй */
    }
})();
