/* ============================================================
   Calculadora Comercial VE · v4.4 · Grupo FERSE
   © 2025 Grupo FERSE — Todos los derechos reservados.
   ============================================================ */
(function () {
    'use strict';

    let _SIG = "FERSE-CALCVE-v4.4-";
    try { _SIG += btoa("grupoferse").slice(0, 6); } catch(e) { _SIG += "SECURE"; }
    window.__FERSE_SIGNATURE = _SIG;
    
    const STORAGE_KEYS = {
        rates: 'calcve_rates_v3',
        manual: 'calcve_manual_v3',
        history: 'calcve_history_v3',
        theme: 'calcve_theme_v3',
        custom: 'calcve_custom_v3'
    };

    let bcvRates = { usd: 875.65, eur: 980.61 };
    let newWorker = null;

    const _k = {
        a: (x) => (typeof x === 'number' && isFinite(x)) ? x : 0,
        b: (x, y) => { const n = _k.a(x), d = _k.a(y); return d > 0 ? n / d : 0; },
        c: (x, y) => _k.a(x) * _k.a(y),
        d: (x, y) => _k.a(x) + _k.a(y),
        e: (x, y) => _k.a(x) - _k.a(y),
        f: (x, p) => _k.a(x) * (_k.a(p) / 100)
    };

    // ============================================================
    // PERSISTENCIA LOCALSTORAGE
    // ============================================================
    function loadStorage() {
        try {
            const r = JSON.parse(localStorage.getItem(STORAGE_KEYS.rates) || 'null');
            if (r && r.usd > 0) bcvRates.usd = r.usd;
            if (r && r.eur > 0) bcvRates.eur = r.eur;
            if (r && r.updated) updateRateTimestamp(r.updated);
        } catch (e) { /* ignore */ }

        try {
            const m = JSON.parse(localStorage.getItem(STORAGE_KEYS.manual) || '{}');
            if (m.rateSource) document.getElementById('rate-source').value = m.rateSource;
            if (m.manualRate) document.getElementById('manual-rate').value = m.manualRate;
            if (m.ivaRateMode) document.getElementById('iva-rate-mode').value = m.ivaRateMode;
            if (m.manualIvaRate) document.getElementById('manual-iva-rate').value = m.manualIvaRate;
            if (m.ivaPct) document.getElementById('iva-pct').value = m.ivaPct;
            if (m.ivaCustomPct) document.getElementById('iva-custom-pct').value = m.ivaCustomPct;
        } catch (e) { /* ignore */ }

        try {
            const c = JSON.parse(localStorage.getItem(STORAGE_KEYS.custom) || '{}');
            if (c.name) document.getElementById('custom-name').value = c.name;
            if (c.rif) document.getElementById('custom-rif').value = c.rif;
            if (c.address) document.getElementById('custom-address').value = c.address;
        } catch (e) { /* ignore */ }

        try {
            const t = localStorage.getItem(STORAGE_KEYS.theme);
            if (t === 'light') document.body.classList.add('light-theme');
        } catch (e) { /* ignore */ }
    }

    function saveRates() {
        try {
            localStorage.setItem(STORAGE_KEYS.rates, JSON.stringify({ usd: bcvRates.usd, eur: bcvRates.eur, updated: Date.now() }));
        } catch (e) { /* ignore */ }
    }

    function saveManual() {
        try {
            localStorage.setItem(STORAGE_KEYS.manual, JSON.stringify({
                rateSource: document.getElementById('rate-source').value,
                manualRate: document.getElementById('manual-rate').value,
                ivaRateMode: document.getElementById('iva-rate-mode').value,
                manualIvaRate: document.getElementById('manual-iva-rate').value,
                ivaPct: document.getElementById('iva-pct').value,
                ivaCustomPct: document.getElementById('iva-custom-pct').value
            }));
        } catch (e) { /* ignore */ }
        
        try {
            localStorage.setItem(STORAGE_KEYS.custom, JSON.stringify({
                name: document.getElementById('custom-name').value,
                rif: document.getElementById('custom-rif').value,
                address: document.getElementById('custom-address').value
            }));
        } catch (e) { /* ignore */ }
    }

    function updateRateTimestamp(ts) {
        const el = document.getElementById('rate-updated');
        if (!el || !ts) return;
        const d = new Date(ts);
        el.innerText = "Actualizada: " + d.toLocaleString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    // ============================================================
    // NAVEGACIÓN Y PANTALLAS
    // ============================================================
    window.alternarTema = function () {
        document.body.classList.toggle('light-theme');
        const isLight = document.body.classList.contains('light-theme');
        try { localStorage.setItem(STORAGE_KEYS.theme, isLight ? 'light' : 'dark'); } catch (e) {}
    };

    window.openAbout = function () { document.getElementById('about-screen').style.display = 'block'; };
    window.closeAbout = function () { document.getElementById('about-screen').style.display = 'none'; };
    
    window.openFaq = function () { document.getElementById('faq-screen').style.display = 'block'; };
    window.closeFaq = function () { document.getElementById('faq-screen').style.display = 'none'; };

    window.openPrivacy = function () { document.getElementById('privacy-screen').style.display = 'block'; };
    window.closePrivacy = function () { document.getElementById('privacy-screen').style.display = 'none'; };
    
    window.openTerms = function () { document.getElementById('terms-screen').style.display = 'block'; };
    window.closeTerms = function () { document.getElementById('terms-screen').style.display = 'none'; };

    window.switchTab = function (tabName) {
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
        if (tabName === 'fiscal') {
            document.getElementById('pane-fiscal').classList.add('active');
            const b = document.getElementById('btn-tab-fiscal'); b.classList.add('active'); b.setAttribute('aria-selected', 'true');
        } else {
            document.getElementById('pane-empaque').classList.add('active');
            const b = document.getElementById('btn-tab-empaque'); b.classList.add('active'); b.setAttribute('aria-selected', 'true');
        }
    };

    // ============================================================
    // SINCRONIZACIÓN BCV
    // ============================================================
    window.fetchBCV = async function () {
        const btn = document.getElementById('btn-sync');
        const spinner = document.getElementById('sync-spinner');
        const icon = document.getElementById('sync-icon');
        const text = document.getElementById('sync-text');
        const errBox = document.getElementById('sync-error');

        if (!navigator.onLine) {
            errBox.style.display = 'block';
            errBox.innerText = 'Sin conexión a internet. Usando la última tasa guardada.';
            setTimeout(() => { errBox.style.display = 'none'; }, 4000);
            return;
        }

        btn.disabled = true;
        spinner.classList.add('active');
        icon.style.display = 'none';
        text.innerText = 'Sincronizando...';
        errBox.style.display = 'none';

        try {
            const [resUsd, resEur] = await Promise.all([
                fetch('https://ve.dolarapi.com/v1/dolares/oficial', { cache: 'no-store' }),
                fetch('https://ve.dolarapi.com/v1/euros/oficial', { cache: 'no-store' })
            ]);
            
            let ok = false;
            if (resUsd.ok) {
                const d = await resUsd.json();
                if (d && d.promedio && !isNaN(parseFloat(d.promedio))) { bcvRates.usd = parseFloat(d.promedio); ok = true; }
            }
            if (resEur.ok) {
                const d = await resEur.json();
                if (d && d.promedio && !isNaN(parseFloat(d.promedio))) { bcvRates.eur = parseFloat(d.promedio); ok = true; }
            }
            
            if (!ok) throw new Error('API sin datos válidos');
            
            saveRates();
            updateRateTimestamp(Date.now());
        } catch (e) {
            errBox.style.display = 'block';
            errBox.innerText = 'No se pudo sincronizar. Se usará la última tasa guardada.';
            setTimeout(() => { errBox.style.display = 'none'; }, 5000);
        } finally {
            btn.disabled = false;
            spinner.classList.remove('active');
            icon.style.display = '';
            text.innerText = 'Sincronizar';
            actualizarDisplayTasas();
            calcularTodo();
        }
    };

    function actualizarDisplayTasas() {
        document.getElementById('rate-usd-display').innerText = `USD: Bs. ${bcvRates.usd.toFixed(2)}`;
        document.getElementById('rate-eur-display').innerText = `EUR: Bs. ${bcvRates.eur.toFixed(2)}`;
    }

    // ============================================================
    // TOGGLES
    // ============================================================
    window.toggleRateSource = function () {
        const s = document.getElementById('rate-source').value;
        document.getElementById('manual-rate-group').style.display = (s === 'manual') ? 'block' : 'none';
        saveManual();
        calcularTodo();
    };

    window.toggleDocType = function () {
        const t = document.getElementById('doc-type').value;
        document.getElementById('fiscal-options').style.display = (t === 'fiscal') ? 'block' : 'none';
        calcularTodo();
    };

    window.toggleIvaRateMode = function () {
        const m = document.getElementById('iva-rate-mode').value;
        document.getElementById('iva-manual-group').style.display = (m === 'custom') ? 'block' : 'none';
        saveManual();
        calcularTodo();
    };

    window.toggleIvaPct = function () {
        const v = document.getElementById('iva-pct').value;
        document.getElementById('iva-custom-group').style.display = (v === 'custom') ? 'block' : 'none';
        saveManual();
        calcularTodo();
    };

    window.togglePackMode = function () {
        const m = document.getElementById('pack-mode').value;
        document.getElementById('mode-box-container').style.display = (m === 'box') ? 'block' : 'none';
        document.getElementById('mode-pack-container').style.display = (m === 'pack') ? 'block' : 'none';
        document.getElementById('row-cost-pack').style.display = (m === 'box') ? 'flex' : 'none';
        calcularEmpaque();
    };

    // ============================================================
    // FORMATOS Y CÁLCULOS
    // ============================================================
    function formatBs(v) { return "Bs. " + (Number(v) || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    function formatUsd(v) { return "$" + (Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

    function getBaseRate() {
        const s = document.getElementById('rate-source').value;
        if (s === 'bcv-eur') return _k.a(bcvRates.eur);
        if (s === 'manual') {
            const m = _k.a(parseFloat(document.getElementById('manual-rate').value));
            return m > 0 ? m : _k.a(bcvRates.usd);
        }
        return _k.a(bcvRates.usd);
    }

    function getIvaRate() {
        const doc = document.getElementById('doc-type').value;
        if (doc !== 'fiscal') return getBaseRate();
        const mode = document.getElementById('iva-rate-mode').value;
        if (mode === 'custom') {
            const m = _k.a(parseFloat(document.getElementById('manual-iva-rate').value));
            return m > 0 ? m : _k.a(bcvRates.usd);
        }
        return _k.a(bcvRates.usd);
    }

    function getIvaPct() {
        const v = document.getElementById('iva-pct').value;
        if (v === 'custom') return _k.a(parseFloat(document.getElementById('iva-custom-pct').value));
        return _k.a(parseFloat(v));
    }

    window.calcularTodo = function () {
        calcularFiscal();
        calcularEmpaque();
        saveManual();
    };

    function calcularFiscal() {
        const baseRate = getBaseRate();
        const ivaRate = getIvaRate();
        const ivaPct = getIvaPct();
        const amountUsd = _k.a(parseFloat(document.getElementById('amount-usd').value));
        const discountPct = Math.min(100, Math.max(0, _k.a(parseFloat(document.getElementById('discount-pct').value))));
        const docType = document.getElementById('doc-type').value;

        const grossUsd = amountUsd;
        const grossBs = _k.c(grossUsd, baseRate);
        const discountUsd = _k.f(grossUsd, discountPct);
        const discountBs = _k.c(discountUsd, baseRate);
        const netUsd = _k.e(grossUsd, discountUsd);
        const netBs = _k.c(netUsd, baseRate);

        document.getElementById('row-discount').style.display = discountPct > 0 ? 'flex' : 'none';
        if (discountPct > 0) document.getElementById('res-discount').innerText = `- ${formatBs(discountBs)} (-${formatUsd(discountUsd)})`;

        let totalBs = netBs;
        const rowIva = document.getElementById('row-iva');
        const rowRet = document.getElementById('row-retention');
        const rowIgtf = document.getElementById('row-igtf');
        const rowIvaRate = document.getElementById('row-iva-rate');

        if (docType === 'fiscal') {
            rowIva.style.display = 'flex';
            rowRet.style.display = 'flex';
            document.getElementById('label-iva').innerText = `IVA (${ivaPct}%):`;

            const ivaMode = document.getElementById('iva-rate-mode').value;
            if (ivaMode === 'custom' || baseRate !== ivaRate) {
                rowIvaRate.style.display = 'flex';
                document.getElementById('res-iva-rate').innerText = formatBs(ivaRate);
            } else {
                rowIvaRate.style.display = 'none';
            }

            const ivaUsd = _k.c(netUsd, ivaPct / 100);
            const ivaBs = _k.c(ivaUsd, ivaRate);
            document.getElementById('res-iva').innerText = `${formatBs(ivaBs)} (${formatUsd(ivaUsd)})`;

            const retPct = _k.a(parseFloat(document.getElementById('retention-iva').value));
            const retUsd = _k.f(ivaUsd, retPct);
            const retBs = _k.f(ivaBs, retPct);
            document.getElementById('res-retention').innerText = `- ${formatBs(retBs)} (-${formatUsd(retUsd)})`;

            let igtfBs = 0;
            if (document.getElementById('apply-igtf').value === 'si') {
                igtfBs = _k.c(_k.d(netBs, ivaBs), 0.03);
                document.getElementById('res-igtf').innerText = formatBs(igtfBs);
                rowIgtf.style.display = 'flex';
            } else {
                rowIgtf.style.display = 'none';
            }

            totalBs = _k.d(_k.e(_k.d(netBs, ivaBs), retBs), igtfBs);
        } else {
            rowIva.style.display = 'none';
            rowRet.style.display = 'none';
            rowIgtf.style.display = 'none';
            rowIvaRate.style.display = 'none';
        }

        const totalUsd = _k.b(totalBs, baseRate);
        document.getElementById('res-rate').innerText = formatBs(baseRate);
        document.getElementById('res-gross').innerText = `${formatBs(grossBs)} (${formatUsd(grossUsd)})`;
        document.getElementById('res-base').innerText = `${formatBs(netBs)} (${formatUsd(netUsd)})`;
        document.getElementById('res-total-bs').innerText = formatBs(totalBs);
        document.getElementById('res-total-usd').innerText = formatUsd(totalUsd);

        window.__lastFiscal = { baseRate, ivaRate, ivaPct, grossUsd, netUsd, netBs, ivaUsd: docType === 'fiscal' ? _k.c(netUsd, ivaPct / 100) : 0, totalBs, totalUsd, docType, discountPct };
    }

    window.calcularEmpaque = function () {
        const baseRate = getBaseRate();
        const mode = document.getElementById('pack-mode').value;
        const retailPriceBag = _k.a(parseFloat(document.getElementById('retail-price-bag').value));

        let costPackUsd = 0, costBagUsd = 0, totalBags = 0;

        if (mode === 'box') {
            const costBoxUsd = _k.a(parseFloat(document.getElementById('cost-box-usd').value));
            const packsPerBox = _k.a(parseFloat(document.getElementById('packs-per-box').value));
            const bagsPerPack = _k.a(parseFloat(document.getElementById('bags-per-pack').value));
            if (packsPerBox > 0) costPackUsd = _k.b(costBoxUsd, packsPerBox);
            totalBags = _k.c(packsPerBox, bagsPerPack);
            if (totalBags > 0) costBagUsd = _k.b(costBoxUsd, totalBags);
            document.getElementById('res-cost-pack').innerText = `${formatBs(_k.c(costPackUsd, baseRate))} (${formatUsd(costPackUsd)})`;
        } else {
            const costPackDirect = _k.a(parseFloat(document.getElementById('cost-pack-usd').value));
            const bagsPerPackDirect = _k.a(parseFloat(document.getElementById('bags-per-pack-direct').value));
            totalBags = bagsPerPackDirect;
            if (bagsPerPackDirect > 0) costBagUsd = _k.b(costPackDirect, bagsPerPackDirect);
        }

        const profitBagUsd = _k.e(retailPriceBag, costBagUsd);
        const profitBagBs = _k.c(profitBagUsd, baseRate);
        const marginPct = retailPriceBag > 0 ? _k.c(_k.b(profitBagUsd, retailPriceBag), 100) : 0;
        const totalProfitUsd = _k.c(profitBagUsd, totalBags);
        const totalProfitBs = _k.c(totalProfitUsd, baseRate);

        document.getElementById('res-cost-bag').innerText = `${formatBs(_k.c(costBagUsd, baseRate))} (${formatUsd(costBagUsd)})`;
        const elP = document.getElementById('res-profit-bag');
        elP.innerText = `${formatBs(profitBagBs)} (${formatUsd(profitBagUsd)}) [${marginPct.toFixed(1)}%]`;
        elP.style.color = profitBagUsd < 0 ? 'var(--danger)' : 'var(--success)';
        document.getElementById('res-profit-total').innerText = `${formatUsd(totalProfitUsd)} (${formatBs(totalProfitBs)})`;

        window.__lastEmpaque = { costBagUsd, retailPriceBag, profitBagUsd, profitBagBs, marginPct, totalProfitUsd, totalProfitBs, totalBags, baseRate };
    };

    // ============================================================
    // COMPARTIR / PDF (ACTUALIZADO CON DISEÑO EXACTO)
    // ============================================================
    const URL_APP = "https://calculadoracomercialve.com/calculadora/";

    window.compartirResumen = async function () {
        const d = window.__lastFiscal || {};
        const name = document.getElementById('custom-name').value.trim();
        const rif = document.getElementById('custom-rif').value.trim();
        
        let header = '';
        if (name || rif) {
            header = `${name ? '*' + name + '*' : ''}\n`;
            if (rif) header += `RIF: ${rif}\n`;
            header += '---\n';
        }

        let texto = header;
        texto += `Tasa Base: ${formatBs(d.baseRate || 0)}\n`;
        texto += `Monto Bruto: ${formatUsd(d.grossUsd || 0)}\n`;
        texto += `Base Neta: ${formatUsd(d.netUsd || 0)}\n`;
        
        if (d.docType === 'fiscal') {
            texto += `IVA (${d.ivaPct || 0}%): ${formatUsd(d.ivaUsd || 0)}\n`;
        }
        
        texto += `Total Bs: ${formatBs(d.totalBs || 0)}\n`;
        texto += `Total USD: ${formatUsd(d.totalUsd || 0)}\n\n`;

        texto += `*Calculadora Comercial VE*\n`;
        texto += `🚀 *¡Únete a nuestra comunidad!*\n`;
        texto += `Esta herramienta es *100% gratis*. Si te sirvió, entra aquí para usar la calculadora y descubrir más herramientas:\n`;
        texto += `👉 ${URL_APP}`;

        if (navigator.share) {
            try { await navigator.share({ title: 'Resumen Calculadora VE', text: texto }); } catch (e) {}
        } else {
            try { await navigator.clipboard.writeText(texto); alert('Resumen copiado al portapapeles. ¡Ya puedes pegarlo!'); } catch (e) { alert(texto); }
        }
    };

    window.compartirResumenEmpaque = async function () {
        const d = window.__lastEmpaque || {};
        const name = document.getElementById('custom-name').value.trim();
        const rif = document.getElementById('custom-rif').value.trim();
        
        let header = '';
        if (name || rif) {
            header = `${name ? '*' + name + '*' : ''}\n`;
            if (rif) header += `RIF: ${rif}\n`;
            header += '---\n';
        }

        let texto = header;
        texto += `Costo/Bolsa: ${formatUsd(d.costBagUsd || 0)}\n`;
        texto += `Precio sugerido: ${formatUsd(d.retailPriceBag || 0)}\n`;
        texto += `Ganancia/Bolsa: ${formatUsd(d.profitBagUsd || 0)} (${(d.marginPct || 0).toFixed(1)}%)\n`;
        texto += `Ganancia Total: ${formatUsd(d.totalProfitUsd || 0)}\n\n`;

        texto += `*Empaques · Calculadora Comercial VE*\n`;
        texto += `🚀 *¡Únete a nuestra comunidad!*\n`;
        texto += `Esta herramienta es *100% gratis*. Si te sirvió, entra aquí para usar la calculadora y descubrir más herramientas:\n`;
        texto += `👉 ${URL_APP}`;

        if (navigator.share) {
            try { await navigator.share({ title: 'Resumen Empaques VE', text: texto }); } catch (e) {}
        } else {
            try { await navigator.clipboard.writeText(texto); alert('Resumen copiado al portapapeles. ¡Ya puedes pegarlo!'); } catch (e) { alert(texto); }
        }
    };

           function prepararPDF(tipo) {
        // FORZAR CÁLCULO ANTES DE IMPRIMIR
        calcularFiscal();
        calcularEmpaque();

        // VALIDACIÓN: Si no hay montos ingresados, no genera el PDF y avisa.
        if (tipo === 'fiscal') {
            const d = window.__lastFiscal;
            if (!d || !d.grossUsd || d.grossUsd <= 0) {
                alert('Por favor, ingresa un monto base en dólares antes de generar el PDF.');
                return; // Detiene la función aquí
            }
        } else {
            const d = window.__lastEmpaque;
            if (!d || !d.retailPriceBag || d.retailPriceBag <= 0) {
                alert('Por favor, ingresa el costo y el precio de venta antes de generar el PDF.');
                return; // Detiene la función aquí
            }
        }

        const contenedor = document.getElementById('pdf-content-data');
        
        const name = document.getElementById('custom-name').value.trim();
        const rif = document.getElementById('custom-rif').value.trim();
        const address = document.getElementById('custom-address').value.trim();
        
        const customBox = document.getElementById('pdf-custom-data');
        if (name || rif || address) {
            document.getElementById('pdf-custom-name').innerText = name || 'No especificado';
            document.getElementById('pdf-custom-rif').innerText = rif || 'No especificado';
            document.getElementById('pdf-custom-address').innerText = address || 'No especificada';
            customBox.style.display = 'block';
        } else {
            customBox.style.display = 'none';
        }

        if (tipo === 'fiscal') {
            const d = window.__lastFiscal || {};
            contenedor.innerHTML = `
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                    <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 8px 0;"><strong>Tasa Aplicada:</strong></td><td style="text-align: right;">${formatBs(d.baseRate || 0)}</td></tr>
                    <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 8px 0;"><strong>Monto Bruto:</strong></td><td style="text-align: right;">${formatUsd(d.grossUsd || 0)}</td></tr>
                    <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 8px 0;"><strong>Base Neta:</strong></td><td style="text-align: right;">${formatUsd(d.netUsd || 0)}</td></tr>
                    ${d.docType === 'fiscal' ? `<tr style="border-bottom: 1px solid #ddd;"><td style="padding: 8px 0;"><strong>IVA (${d.ivaPct || 0}%):</strong></td><td style="text-align: right;">${formatUsd(d.ivaUsd || 0)}</td></tr>` : ''}
                    <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 8px 0;"><strong>Total Bs:</strong></td><td style="text-align: right;">${formatBs(d.totalBs || 0)}</td></tr>
                    <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 8px 0;"><strong>Total USD:</strong></td><td style="text-align: right;">${formatUsd(d.totalUsd || 0)}</td></tr>
                </table>
            `;
        } else {
            const d = window.__lastEmpaque || {};
            contenedor.innerHTML = `
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                    <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 8px 0;"><strong>Costo por Bolsa:</strong></td><td style="text-align: right;">${formatUsd(d.costBagUsd || 0)}</td></tr>
                    <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 8px 0;"><strong>Precio Sugerido:</strong></td><td style="text-align: right;">${formatUsd(d.retailPriceBag || 0)}</td></tr>
                    <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 8px 0;"><strong>Ganancia por Bolsa:</strong></td><td style="text-align: right;">${formatUsd(d.profitBagUsd || 0)} (${(d.marginPct || 0).toFixed(1)}%)</td></tr>
                    <tr style="border-bottom: 1px solid #ddd;"><td style="padding: 8px 0;"><strong>Ganancia Total:</strong></td><td style="text-align: right;">${formatUsd(d.totalProfitUsd || 0)}</td></tr>
                </table>
            `;
        }

        const originalTitle = document.title;
        if (name) {
            const safeName = name.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ]/g, '').replace(/\s+/g, '-');
            document.title = `${safeName}-Calculadora-Comercial-VE`;
        } else {
            document.title = 'Calculadora-Comercial-VE';
        }

        window.onafterprint = function() {
            document.title = originalTitle;
            window.onafterprint = null;
        };
    }

    window.imprimirResumen = function () { 
        prepararPDF('fiscal');
        window.print(); 
    };
    
    window.imprimirEmpaque = function () { 
        prepararPDF('empaque');
        window.print(); 
    };

    // ============================================================
    // HISTORIAL
    // ============================================================
    function cargarHistorial() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.history) || '[]'); } catch (e) { return []; }
    }
    function guardarHistorialLista(lista) {
        try { localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(lista.slice(0, 10))); } catch (e) {}
    }

    window.guardarEnHistorial = function () {
        calcularFiscal(); 
        const d = window.__lastFiscal;
        if (!d || !d.totalBs) { alert('Realiza un cálculo primero.'); return; }
        const item = {
            fecha: new Date().toISOString(),
            tasa: d.baseRate,
            monto: d.grossUsd,
            neto: d.netUsd,
            docType: d.docType,
            iva: d.ivaUsd,
            totalBs: d.totalBs,
            totalUsd: d.totalUsd
        };
        const lista = cargarHistorial();
        lista.unshift(item);
        guardarHistorialLista(lista);
        alert('Cálculo guardado en el historial.');
    };

    window.abrirHistorial = function () {
        const lista = cargarHistorial();
        const cont = document.getElementById('history-list');
        if (!lista.length) {
            cont.innerHTML = '<p style="color:var(--text-tertiary);font-size:13px;">Aún no hay cálculos guardados.</p>';
        } else {
            cont.innerHTML = lista.map(it => {
                const f = new Date(it.fecha).toLocaleString('es-VE');
                return `<div class="history-item">
                    <div class="hi-date">${f}</div>
                    <div class="hi-line"><span>Monto:</span><span>${formatUsd(it.monto)}</span></div>
                    <div class="hi-line"><span>Base Neta:</span><span>${formatUsd(it.neto)}</span></div>
                    <div class="hi-line"><span>Documento:</span><span>${it.docType === 'fiscal' ? 'Fiscal' : 'Proforma'}</span></div>
                    <div class="hi-total"><span>Total:</span><span>${formatBs(it.totalBs)}</span></div>
                </div>`;
            }).join('');
        }
        document.getElementById('history-screen').style.display = 'block';
    };

    window.cerrarHistorial = function () { document.getElementById('history-screen').style.display = 'none'; };

    window.borrarHistorial = function () {
        if (!confirm('¿Borrar todo el historial?')) return;
        try { localStorage.removeItem(STORAGE_KEYS.history); } catch (e) {}
        window.abrirHistorial();
    };

    // ============================================================
    // SERVICE WORKER Y CONEXIÓN
    // ============================================================
    function registrarSW() {
        if (!('serviceWorker' in navigator)) return;
        navigator.serviceWorker.register('./sw.js').then((reg) => {
            reg.addEventListener('updatefound', () => {
                newWorker = reg.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        document.getElementById('update-banner').style.display = 'flex';
                    }
                });
            });
        }).catch(() => {});
    }

    window.actualizarApp = function () {
        if (newWorker) newWorker.postMessage({ action: 'skipWaiting' });
        window.location.reload();
    };

    function actualizarEstadoConexion() {
        const b = document.getElementById('offline-banner');
        b.style.display = navigator.onLine ? 'none' : 'flex';
    }
    window.addEventListener('online', actualizarEstadoConexion);
    window.addEventListener('offline', actualizarEstadoConexion);

    // ============================================================
    // TUTORIAL INTERACTIVO
    // ============================================================
    let tutorialPasoActual = 0;
    
    const tutorialPasos = [
        { element: '#rate-usd-display', title: 'Paso 1: Tasa BCV', text: 'Para calcular facturas con el neto al BCV, Euro o manual, primero verifica o sincroniza la tasa aquí.' },
        { element: '.personalization-card', title: 'Paso 2: Personalización', text: '¡Nuevo! Abre este panel para poner el nombre de tu empresa. Se reflejará en tus PDFs y al compartir.' },
        { element: '#rate-source', title: 'Paso 3: Elegir Tasa', text: 'Selecciona si calcularás con la tasa BCV Dólar, Euro, o si ingresarás una tasa manual personalizada.' },
        { element: '#amount-usd', title: 'Paso 4: Monto', text: 'Ingresa el monto en dólares. Puedes aplicar un descuento en el campo de al lado.' },
        { element: '#doc-type', title: 'Paso 5: Proforma', text: 'En este caso, selecciona "Proforma" si es un presupuesto sin IVA.' },
        { element: '.btn-action[onclick="guardarEnHistorial()"]', title: 'Guardar Cálculo', text: '¡Listo! Una vez calculado el neto, presiona aquí para guardarlo en tu historial.' },
        { element: '#doc-type', title: 'Factura Fiscal', text: 'Ahora cambia a "Factura Fiscal" para que se habiliten las opciones de IVA y Retención.' },
        { element: '#iva-pct', title: 'IVA', text: 'Selecciona la alícuota (16%, 8%, etc.).' },
        { element: '#retention-iva', title: 'Retención', text: 'Aquí decides si aplicas retención de IVA (75% o 100%).' },
        { element: '#btn-tab-empaque', title: 'Empaques y Ganancias', text: 'Ahora vamos a la pestaña de Empaques para calcular el margen de ganancia de cajas y bolsas.' },
        { element: '#cost-box-usd', title: 'Costo de Caja', text: 'Ingresa el costo de la caja completa.' },
        { element: '#packs-per-box', title: 'Cantidades', text: 'Indica cuántos paquetes hay por caja y cuántas bolsas por paquete.' },
        { element: '#retail-price-bag', title: 'Precio de Venta', text: 'Ingresa el precio de venta al público por cada bolsa.' },
        { element: '#res-profit-bag', title: 'Margen de Ganancia', text: 'La app calcula automáticamente tu ganancia neta por bolsa y el porcentaje de margen.' },
        { element: '#btn-history', title: 'Historial de Cálculos', text: 'Puedes ver todos los cálculos guardados aquí.' },
        { element: '.btn-info-about', title: 'Contacto', text: 'Finalmente, si necesitas soporte o contactar a Grupo FERSE, presiona aquí.' }
    ];

    window.iniciarTutorial = function() {
        tutorialPasoActual = 0;
        document.getElementById('tutorial-overlay').style.display = 'block';
        document.body.style.overflow = 'hidden'; 
        mostrarPaso();
    };

    function mostrarPaso() {
        document.querySelectorAll('.tutorial-focus').forEach(el => el.classList.remove('tutorial-focus'));
        
        if (tutorialPasoActual >= tutorialPasos.length) {
            saltarTutorial();
            return;
        }

        const paso = tutorialPasos[tutorialPasoActual];
        let target = document.querySelector(paso.element);

        if (paso.element === '.personalization-card') {
            target.setAttribute('open', 'true');
        }

        if (!target || target.offsetParent === null) {
            if (paso.element === '#cost-box-usd' || paso.element === '#packs-per-box' || paso.element === '#retail-price-bag' || paso.element === '#res-profit-bag') {
                document.getElementById('btn-tab-empaque').click();
            } else if (paso.element === '#iva-pct' || paso.element === '#retention-iva') {
                document.getElementById('btn-tab-fiscal').click();
                document.getElementById('doc-type').value = 'fiscal';
                document.getElementById('doc-type').dispatchEvent(new Event('change'));
            }
            
            setTimeout(() => { ejecutarFoco(paso); }, 300);
            return;
        }

        ejecutarFoco(paso);
    }

    function ejecutarFoco(paso) {
        let target = document.querySelector(paso.element);
        
        if(!target && paso.element.includes('guardarEnHistorial')) {
            target = document.querySelector('.btn-action[onclick="guardarEnHistorial()"]');
        }

        document.getElementById('tut-title').innerText = paso.title;
        document.getElementById('tut-text').innerText = paso.text;

        if (target) {
            target.classList.add('tutorial-focus');
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });

            setTimeout(() => {
                const tooltip = document.querySelector('.tutorial-tooltip');
                const rect = target.getBoundingClientRect();
                
                let top = rect.top - tooltip.offsetHeight - 15; 
                let left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2);

                if (top < 10) { top = rect.bottom + 15; }
                if (left < 10) left = 10;
                if (left + tooltip.offsetWidth > window.innerWidth - 10) { left = window.innerWidth - tooltip.offsetWidth - 10; }

                tooltip.style.position = 'fixed';
                tooltip.style.top = `${top}px`;
                tooltip.style.left = `${left}px`;
                tooltip.style.transform = 'none';
            }, 500); 
        }
    }

    window.siguientePaso = function() {
        tutorialPasoActual++;
        mostrarPaso();
    };

    window.saltarTutorial = function() {
        document.getElementById('tutorial-overlay').style.display = 'none';
        document.body.style.overflow = ''; 
        document.querySelectorAll('.tutorial-focus').forEach(el => el.classList.remove('tutorial-focus'));
        
        // Cerrar otras pantallas si quedaron abiertas
        window.closePrivacy();
        window.closeTerms();
        window.closeFaq();
        window.closeAbout();
        window.cerrarHistorial();

        let veces = parseInt(localStorage.getItem('calcve_tutorial_veces') || '0');
        veces++;
        localStorage.setItem('calcve_tutorial_veces', veces);
        
        if (veces >= 3) {
            localStorage.setItem('calcve_tutorial_visto', 'true');
        }
    };

    function verificarTutorial() {
        const vecesVisto = parseInt(localStorage.getItem('calcve_tutorial_veces') || '0');
        const yaNoMolestar = localStorage.getItem('calcve_tutorial_visto') === 'true';

        if (yaNoMolestar) return;

        setTimeout(() => {
            let mensaje = vecesVisto === 0 
                ? "¡Bienvenido a la Calculadora Comercial VE! ¿Deseas ver un tutorial rápido para aprender a usarla?"
                : "¿Quieres volver a ver el tutorial de la calculadora?";
            
            if (confirm(mensaje)) {
                window.iniciarTutorial();
            } else {
                let veces = vecesVisto + 1;
                localStorage.setItem('calcve_tutorial_veces', veces);
                if (veces >= 3) {
                    localStorage.setItem('calcve_tutorial_visto', 'true');
                }
            }
        }, 1000);
    }

    // ============================================================
    // INICIO
    // ============================================================
    function init() {
        loadStorage();
        actualizarDisplayTasas();
        toggleRateSource();
        toggleDocType();
        toggleIvaRateMode();
        toggleIvaPct();
        togglePackMode();
        actualizarEstadoConexion();
        calcularTodo();
        registrarSW();
        
        const r = localStorage.getItem(STORAGE_KEYS.rates);
        if (!r && navigator.onLine) {
            window.fetchBCV();
        } else if (!r) {
            saveRates();
        }

        verificarTutorial();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    window.addEventListener('appinstalled', () => {
        if (typeof gtag === 'function') gtag('event', 'pwa_installed', { event_category: 'PWA', event_label: 'CalcVE Instalada' });
    });
})();