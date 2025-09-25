class TradingDashboard {
    constructor() {
        this.firebase = null;
        this.database = null;
        this.firestore = null;
        this.dataSource = 'rtdb'; // 'rtdb' or 'firestore'
        this.charts = {};
        this.refreshInterval = null;

        // Data cache
        this.balanceData = [];
        this.tradesData = [];
        this.currentStats = {};

        // Previous data for smart updates
        this.previousBalance = null;
        this.previousStats = {};
        this.lastDataTimestamp = 0;
        this.isUpdating = false;

        // Chart colors
        this.colors = {
            primary: 'rgba(255, 255, 255, 0.8)',
            success: '#4caf50',
            danger: '#f44336',
            warning: '#ff9800',
            info: '#2196f3',
            background: 'rgba(255, 255, 255, 0.1)',
            gradient: {
                primary: ['rgba(255, 255, 255, 0.3)', 'rgba(255, 255, 255, 0.1)'],
                success: ['rgba(76, 175, 80, 0.3)', 'rgba(76, 175, 80, 0.1)'],
                danger: ['rgba(244, 67, 54, 0.3)', 'rgba(244, 67, 54, 0.1)'],
                warning: ['rgba(255, 152, 0, 0.3)', 'rgba(255, 152, 0, 0.1)']
            }
        };

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupThemeToggle();
        this.checkConfig();
    }

    setupEventListeners() {
        // Config modal
        const modal = document.getElementById('configModal');
        const closeBtn = document.querySelector('.close');
        const configForm = document.getElementById('configForm');

        closeBtn.onclick = () => modal.style.display = 'none';
        window.onclick = (event) => {
            if (event.target === modal) modal.style.display = 'none';
        };

        configForm.onsubmit = (e) => {
            e.preventDefault();
            this.saveConfig();
        };

        // Controls
        document.getElementById('timeRange').onchange = () => this.updateBalanceChart();
        document.getElementById('refreshTrades').onclick = () => this.loadTradesData();
        document.getElementById('tradeLimit').onchange = () => this.loadTradesData();
        const viewModeEl = document.getElementById('viewMode');
        if (viewModeEl) {
            viewModeEl.onchange = () => this.loadTradesData();
        }
        const historyDateEl = document.getElementById('historyDate');
        if (historyDateEl) {
            // Default to today
            if (!historyDateEl.value) {
                const today = new Date();
                const yyyy = today.getFullYear();
                const mm = String(today.getMonth() + 1).padStart(2, '0');
                const dd = String(today.getDate()).padStart(2, '0');
                historyDateEl.value = `${yyyy}-${mm}-${dd}`;
            }
            historyDateEl.onchange = () => this.loadTradesData();
        }

        // Handle window resize for responsive layout
        window.addEventListener('resize', () => {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = setTimeout(() => {
                this.updateTradesDisplay();
                if (this.charts.balance) this.charts.balance.resize();
                if (this.charts.results) this.charts.results.resize();
            }, 150);
        });
    }

    setupThemeToggle() {
        const themeToggle = document.getElementById('themeToggle');
        const themeIcon = document.getElementById('themeIcon');
        
        // Load saved theme or default to dark
        const savedTheme = localStorage.getItem('theme') || 'dark';
        this.setTheme(savedTheme);
        
        themeToggle.addEventListener('click', () => {
            const currentTheme = document.body.classList.contains('light-mode') ? 'light' : 'dark';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            this.setTheme(newTheme);
            localStorage.setItem('theme', newTheme);
        });
    }

    setTheme(theme) {
        const themeIcon = document.getElementById('themeIcon');
        
        if (theme === 'light') {
            document.body.classList.add('light-mode');
            // Change icon to moon
            themeIcon.innerHTML = `
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            `;
        } else {
            document.body.classList.remove('light-mode');
            // Change icon to sun
            themeIcon.innerHTML = `
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            `;
        }
    }

    checkConfig() {
        // Try to load config from firebase-config.json first
        this.loadConfigFromFile()
            .then(config => {
                if (config) {
                    const dataSource = config.dataSource || 'rtdb';
                    this.initFirebase(config, dataSource);
                } else {
                    // Fallback to localStorage
                    const storedConfig = localStorage.getItem('firebaseConfig');
                    if (!storedConfig) {
                        this.showConfigModal();
                    } else {
                        try {
                            const parsedConfig = JSON.parse(storedConfig);
                            const dataSource = localStorage.getItem('dataSource') || 'rtdb';
                            this.initFirebase(parsedConfig, dataSource);
                        } catch (error) {
                            console.error('Invalid stored config:', error);
                            this.showConfigModal();
                        }
                    }
                }
            })
            .catch(error => {
                console.warn('Could not load config from file:', error);
                // Fallback to localStorage
                const storedConfig = localStorage.getItem('firebaseConfig');
                if (!storedConfig) {
                    this.showConfigModal();
                } else {
                    try {
                        const parsedConfig = JSON.parse(storedConfig);
                        const dataSource = localStorage.getItem('dataSource') || 'rtdb';
                        this.initFirebase(parsedConfig, dataSource);
                    } catch (error) {
                        console.error('Invalid stored config:', error);
                        this.showConfigModal();
                    }
                }
            });
    }

    async loadConfigFromFile() {
        try {
            const response = await fetch('./firebase-config.json');
            if (response.ok) {
                const config = await response.json();
                // Validate that it's a real config (not the example)
                if (config.apiKey && config.apiKey !== 'your-api-key-here') {
                    return config;
                }
            }
            return null;
        } catch (error) {
            console.warn('Config file not found or invalid:', error);
            return null;
        }
    }

    showConfigModal() {
        document.getElementById('configModal').style.display = 'block';
        this.updateStatus('error', 'Configuration required');
    }

    saveConfig() {
        const configText = document.getElementById('firebaseConfig').value.trim();
        const dataSource = document.getElementById('dataSource').value;

        try {
            const config = JSON.parse(configText);
            localStorage.setItem('firebaseConfig', JSON.stringify(config));
            localStorage.setItem('dataSource', dataSource);

            document.getElementById('configModal').style.display = 'none';
            this.initFirebase(config, dataSource);
        } catch (error) {
            alert('Invalid JSON configuration: ' + error.message);
        }
    }

    async initFirebase(config, dataSource) {
        try {
            this.updateStatus('connecting', 'Initializing Firebase...');

            this.firebase = firebase.initializeApp(config);
            this.dataSource = dataSource;

            if (dataSource === 'rtdb') {
                this.database = firebase.database();
                await this.testRTDBConnection();
            } else {
                this.firestore = firebase.firestore();
                await this.testFirestoreConnection();
            }

            this.updateStatus('connected', `Connected to ${dataSource.toUpperCase()}`);
            await this.loadAllData();
            this.startAutoRefresh();

        } catch (error) {
            console.error('Firebase init error:', error);
            this.updateStatus('error', 'Connection failed: ' + error.message);
        }
    }

    async testRTDBConnection() {
        // Test connection by reading the root
        await this.database.ref('/live_demo').once('value');
    }

    async testFirestoreConnection() {
        // Test connection by reading collections
        await this.firestore.collection('live_demo_balance_logs').limit(1).get();
    }

    updateStatus(status, text) {
        const dot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');

        dot.className = `status-dot ${status}`;
        statusText.textContent = text;
    }

    async loadAllData() {
        if (this.isUpdating) return; // Prevent concurrent updates

        try {
            this.isUpdating = true;
            
            // Show subtle loading indicator
            this.showLoadingIndicator();
            
            // Store previous data for comparison
            const previousBalanceData = [...this.balanceData];
            const previousTradesData = [...this.tradesData];
            const previousStats = { ...this.currentStats };

            await Promise.all([
                this.loadBalanceData(),
                this.loadTradesData()
            ]);

            // If no explicit balance logs came back, synthesize from trades
            if (this.balanceData.length === 0 && this.tradesData.length > 0) {
                this._buildBalanceFromTrades();
            }

            // Always recompute aggregate stats from current balanceData + trades (bet history)
            this._recomputeStatsFromTrades();

            // Smart update logic - only update what actually changed
            const balanceChanged = this._hasBalanceChanged(previousBalanceData);
            const tradesChanged = this._hasTradesChanged(previousTradesData);
            const statsChanged = this._hasStatsChanged(previousStats);

            // Force update stats display and charts
            this.updateStatsDisplay();
            this.updateResultsChart();

            if (balanceChanged || tradesChanged || statsChanged) {
                this.smartUpdateDashboard(balanceChanged, tradesChanged, statsChanged);
            }
        } catch (error) {
            console.error('Error loading data:', error);
            this.updateStatus('error', 'Failed to load data');
        } finally {
            this.isUpdating = false;
            this.hideLoadingIndicator();
        }
    }

    showLoadingIndicator() {
        const statusText = document.getElementById('statusText');
        if (statusText) {
            statusText.textContent = 'Updating...';
        }
    }

    hideLoadingIndicator() {
        const statusText = document.getElementById('statusText');
        if (statusText && this.firebase) {
            statusText.textContent = `Connected to ${this.dataSource.toUpperCase()}`;
        }
    }

    async loadBalanceData() {
        if (this.dataSource === 'rtdb') {
            return this.loadBalanceDataRTDB();
        } else {
            return this.loadBalanceDataFirestore();
        }
    }

    async loadBalanceDataRTDB() {
        try {
            const snapshot = await this.database.ref('/live_demo/balance_logs').once('value');
            const data = snapshot.val();
            if (!data) {
                this.balanceData = [];
                // Fallback: fetch current balance snapshot if exists
                try {
                    const balSnap = await this.database.ref('/live_demo_balance').once('value');
                    const balVal = balSnap.val();
                    if (balVal && typeof balVal === 'object') {
                        const ts = new Date();
                        this.balanceData = [{
                            id: 'current_balance',
                            balance: balVal.balance ?? balVal.current_balance ?? 0,
                            performance: balVal.stats || balVal.performance || {},
                            timestamp: ts
                        }];
                    }
                } catch { /* ignore fallback errors */ }
                return;
            }
            this.balanceData = Object.entries(data)
                .map(([key, value]) => ({
                    id: key,
                    ...value,
                    timestamp: new Date(value.ts || value.timestamp || Date.now())
                }))
                .sort((a, b) => a.timestamp - b.timestamp);
        } catch (e) {
            // If permissions or path missing, silently fallback
            this.balanceData = [];
        }
    }

    async loadBalanceDataFirestore() {
        const snapshot = await this.firestore
            .collection('live_demo_balance_logs')
            .orderBy('ts', 'desc')
            .limit(1000)
            .get();

        this.balanceData = snapshot.docs
            .map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: new Date(doc.data().ts || doc.data().timestamp || Date.now())
            }))
            .sort((a, b) => a.timestamp - b.timestamp);
    }

    async loadTradesData() {
        const limitValue = document.getElementById('tradeLimit').value;
        const limit = limitValue === 'all' ? null : parseInt(limitValue);

        if (this.dataSource === 'rtdb') {
            return this.loadTradesDataRTDB(limit);
        } else {
            return this.loadTradesDataFirestore(limit);
        }
    }

    async loadTradesDataRTDB(limit) {
        // New schema: /live_demo_bet_history/YYYYMMDD/{session_id}/{push_key}: record
        const historyDateEl = document.getElementById('historyDate');
        const viewModeEl = document.getElementById('viewMode');
        const dateStr = historyDateEl && historyDateEl.value ? historyDateEl.value.replace(/-/g, '') : this._todayYMD();
        const modeFilter = viewModeEl ? viewModeEl.value : 'simulation';

        const path = `/live_demo_bet_history/${dateStr}`;
        const snapshot = await this.database.ref(path).once('value');
        const dateBucketData = snapshot.val();

        if (!dateBucketData) {
            this.tradesData = [];
            return;
        }

        // Flatten: for each session id => for each push key => record
        const flattened = [];
        Object.entries(dateBucketData).forEach(([sessionId, sessionRecords]) => {
            if (sessionRecords && typeof sessionRecords === 'object') {
                Object.entries(sessionRecords).forEach(([pushKey, rec]) => {
                    if (rec && typeof rec === 'object') {
                        // Mode filtering
                        if (modeFilter !== 'all' && rec.mode && rec.mode !== modeFilter) return;
                        const decisionTime = rec.decision_time || rec.decisionTime;
                        const settlementTime = rec.settlement_time || rec.settlementTime;
                        const tsStr = settlementTime || decisionTime;
                        let tsDate;
                        try { tsDate = tsStr ? new Date(tsStr) : new Date(); } catch { tsDate = new Date(); }
                        flattened.push({
                            id: pushKey,
                            sid: rec.session_id || sessionId,
                            bet_side: rec.bet_side,
                            result_status: rec.result_status,
                            pnl: rec.pnl,
                            balance_after: rec.balance_after_settlement,
                            outcome: rec.outcome,
                            stake: rec.stake,
                            bet_idx: rec.bet_idx,
                            bet_countdown: rec.bet_countdown,
                            final_tai_total: rec.final_tai_total,
                            final_xiu_total: rec.final_xiu_total,
                            refunded_amount: rec.refunded_amount,
                            effective_bet_amount: rec.effective_bet_amount,
                            strategy: rec.strategy,
                            timepoint: rec.timepoint,
                            mode: rec.mode,
                            timestamp: tsDate
                        });
                    }
                });
            }
        });

        // Sort newest first and apply limit
        this.tradesData = flattened.sort((a, b) => b.timestamp - a.timestamp);
        if (limit !== null) {
            this.tradesData = this.tradesData.slice(0, limit);
        }
    }

    async loadTradesDataFirestore(limit) {
        let query = this.firestore
            .collection('live_demo_trades')
            .orderBy('ts', 'desc');
        
        // Only apply limit if it's not null (i.e., not "all")
        if (limit !== null) {
            query = query.limit(limit);
        }
        
        const snapshot = await query.get();

        this.tradesData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: new Date(doc.data().ts || doc.data().timestamp || Date.now())
        }));
    }

    updateDashboard() {
        this.updateBalanceDisplay();
        this.updateStatsDisplay();
        this.updateBalanceChart();
        this.updateResultsChart();
        this.updateTradesDisplay();
    }

    smartUpdateDashboard(balanceChanged, tradesChanged, statsChanged) {
        // Only update balance display if balance actually changed
        if (balanceChanged) {
            this.smartUpdateBalanceDisplay();
            this.smartUpdateBalanceChart();
        }

        // Only update stats if they actually changed
        if (statsChanged) {
            this.smartUpdateStatsDisplay();
        }

        // Only update trades and results chart if trade data changed
        if (tradesChanged) {
            this.smartUpdateResultsChart();
            this.smartUpdateTradesDisplay();
        }
    }

    _hasBalanceChanged(previousData) {
        if (previousData.length !== this.balanceData.length) return true;
        
        // Check if latest balance value changed
        if (previousData.length > 0 && this.balanceData.length > 0) {
            const prevLatest = previousData[previousData.length - 1];
            const currentLatest = this.balanceData[this.balanceData.length - 1];
            return prevLatest.balance !== currentLatest.balance;
        }
        
        return false;
    }

    _hasTradesChanged(previousData) {
        if (previousData.length !== this.tradesData.length) return true;
        
        // Check if latest trade changed
        if (previousData.length > 0 && this.tradesData.length > 0) {
            const prevLatest = previousData[0]; // trades are sorted newest first
            const currentLatest = this.tradesData[0];
            return prevLatest.id !== currentLatest.id || 
                   prevLatest.result_status !== currentLatest.result_status ||
                   prevLatest.pnl !== currentLatest.pnl;
        }
        
        return false;
    }

    _hasStatsChanged(previousStats) {
        return JSON.stringify(previousStats) !== JSON.stringify(this.currentStats);
    }

    updateBalanceDisplay() {
        const balanceEl = document.getElementById('currentBalance');
        const changeEl = document.getElementById('balanceChange');

        if (this.balanceData.length === 0) {
            balanceEl.textContent = '--';
            changeEl.textContent = '--';
            return;
        }

        const latest = this.balanceData[this.balanceData.length - 1];
        const previous = this.balanceData.length > 1 ? this.balanceData[this.balanceData.length - 2] : null;

        // Format balance
        const balance = latest.balance || 0;
        balanceEl.textContent = this.formatNumber(balance) + ' VND';

        // Calculate change
        if (previous) {
            const change = balance - (previous.balance || 0);
            const changePercent = previous.balance ? ((change / previous.balance) * 100).toFixed(2) : 0;

            changeEl.textContent = `${change >= 0 ? '+' : ''}${this.formatNumber(change)} VND (${changePercent}%)`;
            changeEl.className = `balance-change ${change >= 0 ? 'positive' : 'negative'}`;
        } else {
            changeEl.textContent = 'No previous data';
            changeEl.className = 'balance-change';
        }
    }

    smartUpdateBalanceDisplay() {
        const balanceEl = document.getElementById('currentBalance');
        const changeEl = document.getElementById('balanceChange');

        if (this.balanceData.length === 0) return;

        const latest = this.balanceData[this.balanceData.length - 1];
        const balance = latest.balance || 0;

        // Only update if balance actually changed
        if (this.previousBalance !== balance) {
            // Add smooth transition with CSS classes
            balanceEl.classList.add('balance-flash');
            changeEl.classList.add('balance-flash');

            // Update the display
            this.updateBalanceDisplay();

            // Remove flash class after animation
            setTimeout(() => {
                balanceEl.classList.remove('balance-flash');
                changeEl.classList.remove('balance-flash');
            }, 600);

            this.previousBalance = balance;
        }
    }

    updateStatsDisplay() {
        // Prefer derived stats (this.derivedStats) built from bet history; fallback to last balance performance
        const latest = this.balanceData[this.balanceData.length - 1];
        const performance = this.derivedStats || latest?.performance || {};

        const wins = performance.wins || 0;
        const losses = performance.losses || 0;
        const refunds = performance.refunds || 0;
        const totalTrades = wins + losses + refunds;
        const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : 0;

        // Debug logging
        console.log('Stats Update:', {
            derivedStats: this.derivedStats,
            performance,
            wins,
            losses,
            refunds,
            totalTrades,
            winRate,
            tradesDataLength: this.tradesData.length
        });

        // Update display with fallback values
        document.getElementById('winRate').textContent = totalTrades > 0 ? winRate + '%' : '0%';
        document.getElementById('totalTrades').textContent = totalTrades || 0;
        document.getElementById('wins').textContent = wins || 0;
        document.getElementById('losses').textContent = losses || 0;
        document.getElementById('refunds').textContent = refunds || 0;
        document.getElementById('lastResult').textContent = performance.last_result || 'N/A';

        this.currentStats = { wins, losses, refunds, totalTrades, winRate };
    }

    smartUpdateStatsDisplay() {
        const latest = this.balanceData[this.balanceData.length - 1];
        const performance = this.derivedStats || latest?.performance || {};

        const newStats = {
            wins: performance.wins || 0,
            losses: performance.losses || 0,
            refunds: performance.refunds || 0,
            lastResult: performance.last_result || '--'
        };

        // Check if any stats changed
        const statsChanged = JSON.stringify(this.previousStats) !== JSON.stringify(newStats);

        if (statsChanged) {
            // Add smooth animation to changed stats
            const statElements = ['winRate', 'totalTrades', 'wins', 'losses', 'refunds', 'lastResult'];
            statElements.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.classList.add('stat-updating');
                    setTimeout(() => {
                        el.classList.remove('stat-updating');
                    }, 400);
                }
            });

            this.updateStatsDisplay();
            this.previousStats = { ...newStats };
        }
    }

    updateBalanceChart() {
        const ctx = document.getElementById('balanceChart').getContext('2d');
        const timeRange = document.getElementById('timeRange').value;

        // Filter data by time range
        const now = new Date();
        const cutoff = new Date(now);

        switch (timeRange) {
            case '1h': cutoff.setHours(now.getHours() - 1); break;
            case '6h': cutoff.setHours(now.getHours() - 6); break;
            case '24h': cutoff.setDate(now.getDate() - 1); break;
            case '7d': cutoff.setDate(now.getDate() - 7); break;
            case '30d': cutoff.setDate(now.getDate() - 30); break;
        }

        let filteredData = this.balanceData.filter(item => item.timestamp >= cutoff);

        // Sample data to reduce chart density
        filteredData = this.sampleChartData(filteredData, timeRange);

        if (this.charts.balance) {
            this.charts.balance.destroy();
        }

        // Create gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, this.colors.gradient.primary[0]);
        gradient.addColorStop(1, this.colors.gradient.primary[1]);

        // Find max and min values with their indices
        const balanceValues = filteredData.map(item => item.balance || 0);
        const maxBalance = Math.max(...balanceValues);
        const minBalance = Math.min(...balanceValues);
        const maxIndex = balanceValues.indexOf(maxBalance);
        const minIndex = balanceValues.indexOf(minBalance);

        // Create datasets with markers for max/min points
        const datasets = [{
            label: 'Balance (VND)',
            data: filteredData.map(item => item.balance || 0),
            borderColor: this.colors.primary,
            backgroundColor: gradient,
            borderWidth: 3,
            tension: 0.4,
            fill: true,
            pointBackgroundColor: this.colors.primary,
            pointBorderColor: 'rgba(255, 255, 255, 1)',
            pointBorderWidth: 2,
            pointRadius: 2,
            pointHoverRadius: 4
        }];

        // Add max balance marker (green dot)
        if (maxIndex !== -1) {
            datasets.push({
                label: `Max: ${this.formatNumber(maxBalance)} VND`,
                data: filteredData.map((_, index) => index === maxIndex ? maxBalance : null),
                borderColor: '#4caf50',
                backgroundColor: '#4caf50',
                borderWidth: 3,
                pointRadius: 8,
                pointHoverRadius: 10,
                pointBorderWidth: 3,
                pointBorderColor: 'rgba(255, 255, 255, 1)',
                showLine: false,
                fill: false
            });
        }

        // Add min balance marker (red dot)
        if (minIndex !== -1) {
            datasets.push({
                label: `Min: ${this.formatNumber(minBalance)} VND`,
                data: filteredData.map((_, index) => index === minIndex ? minBalance : null),
                borderColor: '#f44336',
                backgroundColor: '#f44336',
                borderWidth: 3,
                pointRadius: 8,
                pointHoverRadius: 10,
                pointBorderWidth: 3,
                pointBorderColor: 'rgba(255, 255, 255, 1)',
                showLine: false,
                fill: false
            });
        }

        this.charts.balance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: filteredData.map(item => this.formatTime(item.timestamp)),
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 750,
                    easing: 'easeInOutQuart'
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: 'rgba(255, 255, 255, 0.8)',
                            padding: 15,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            filter: function(legendItem) {
                                // Only show max/min markers in legend
                                return legendItem.text.includes('Max:') || legendItem.text.includes('Min:');
                            },
                            font: {
                                size: 12,
                                weight: '600'
                            }
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(33, 38, 45, 0.95)',
                        titleColor: '#e6edf3',
                        bodyColor: '#e6edf3',
                        borderColor: 'rgba(88, 166, 255, 0.3)',
                        borderWidth: 1,
                        cornerRadius: 8,
                        displayColors: true,
                        callbacks: {
                            label: function(context) {
                                if (context.dataset.label.includes('Max:') || context.dataset.label.includes('Min:')) {
                                    return context.dataset.label;
                                }
                                return `Balance: ${context.parsed.y.toLocaleString('vi-VN')} VND`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.7)',
                            callback: value => this.formatNumber(value)
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.7)',
                            maxTicksLimit: 10
                        }
                    }
                },
                interaction: {
                    intersect: false
                }
            }
        });
    }

    smartUpdateBalanceChart() {
        if (!this.charts.balance || this.balanceData.length === 0) {
            this.updateBalanceChart();
            return;
        }

        // Add subtle loading indicator
        const chartContainer = document.querySelector('.chart-container');
        chartContainer.classList.add('chart-updating');

        const timeRange = document.getElementById('timeRange').value;
        const now = new Date();
        const cutoff = new Date(now);

        switch (timeRange) {
            case '1h': cutoff.setHours(now.getHours() - 1); break;
            case '6h': cutoff.setHours(now.getHours() - 6); break;
            case '24h': cutoff.setDate(now.getDate() - 1); break;
            case '7d': cutoff.setDate(now.getDate() - 7); break;
            case '30d': cutoff.setDate(now.getDate() - 30); break;
        }

        let filteredData = this.balanceData.filter(item => item.timestamp >= cutoff);
        filteredData = this.sampleChartData(filteredData, timeRange);

        // Find max and min values with their indices
        const balanceValues = filteredData.map(item => item.balance || 0);
        const maxBalance = Math.max(...balanceValues);
        const minBalance = Math.min(...balanceValues);
        const maxIndex = balanceValues.indexOf(maxBalance);
        const minIndex = balanceValues.indexOf(minBalance);

        // Update labels
        this.charts.balance.data.labels = filteredData.map(item => this.formatTime(item.timestamp));

        // Update main balance line
        this.charts.balance.data.datasets[0].data = balanceValues;

        // Update or add max marker dataset
        if (this.charts.balance.data.datasets.length > 1) {
            this.charts.balance.data.datasets[1].data = filteredData.map((_, index) => index === maxIndex ? maxBalance : null);
            this.charts.balance.data.datasets[1].label = `Max: ${this.formatNumber(maxBalance)} VND`;
        }

        // Update or add min marker dataset
        if (this.charts.balance.data.datasets.length > 2) {
            this.charts.balance.data.datasets[2].data = filteredData.map((_, index) => index === minIndex ? minBalance : null);
            this.charts.balance.data.datasets[2].label = `Min: ${this.formatNumber(minBalance)} VND`;
        }

        // Smooth update with subtle animation
        this.charts.balance.update('active'); // Subtle animation for smooth experience

        // Remove loading indicator
        setTimeout(() => {
            chartContainer.classList.remove('chart-updating');
        }, 300);
    }

    updateResultsChart() {
        const ctx = document.getElementById('resultsChart').getContext('2d');
        
        // Get stats from derivedStats or currentStats
        const performance = this.derivedStats || this.currentStats || {};
        const wins = performance.wins || 0;
        const losses = performance.losses || 0;
        const refunds = performance.refunds || 0;

        console.log('Updating Results Chart:', { wins, losses, refunds, performance });

        if (this.charts.results) {
            this.charts.results.destroy();
        }

        this.charts.results = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Wins', 'Losses', 'Refunds'],
                datasets: [{
                    data: [wins, losses, refunds],
                    backgroundColor: [
                        this.colors.success,
                        this.colors.danger,
                        this.colors.warning
                    ],
                    borderWidth: 3,
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    hoverBorderWidth: 5,
                    hoverBorderColor: 'rgba(255, 255, 255, 0.8)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: 'rgba(255, 255, 255, 0.8)',
                            padding: 20,
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    }
                },
                animation: {
                    animateRotate: true,
                    animateScale: true,
                    duration: 1000,
                    easing: 'easeInOutQuart'
                }
            }
        });
    }

    smartUpdateResultsChart() {
        if (!this.charts.results) {
            this.updateResultsChart();
            return;
        }

        // Get stats from derivedStats or currentStats
        const performance = this.derivedStats || this.currentStats || {};
        const wins = performance.wins || 0;
        const losses = performance.losses || 0;
        const refunds = performance.refunds || 0;

        console.log('Smart updating Results Chart:', { wins, losses, refunds, performance });

        // Add subtle loading indicator
        const resultsChartContainer = document.querySelector('#resultsChart').closest('.chart-container');
        resultsChartContainer.classList.add('chart-updating');

        // Update data smoothly
        this.charts.results.data.datasets[0].data = [wins, losses, refunds];
        this.charts.results.update('active'); // Subtle animation for smooth experience

        // Remove loading indicator
        setTimeout(() => {
            resultsChartContainer.classList.remove('chart-updating');
        }, 300);
    }

    updateTradesDisplay() {
        const container = document.getElementById('tradesContainer');

        if (this.tradesData.length === 0) {
            container.innerHTML = '<div class="loading">No trades found</div>';
            return;
        }

        const isMobile = window.innerWidth < 768;

        if (isMobile) {
            // Mobile layout: stacked format
            const tradesHtml = this.tradesData.map(trade => `
                <div class="trade-item mobile-trade" data-trade-id="${trade.id}">
                    <div class="trade-header">
                        <span class="trade-time">${this.formatDateTime(trade.timestamp)}</span>
                        <span class="trade-side ${this.convertSide(trade.bet_side)?.toLowerCase() || ''}">${this.convertSide(trade.bet_side) || '--'}</span>
                        <span class="trade-result ${this._mapResultClass(trade.result_status) || ''}">${(trade.result_status || '--').toUpperCase()}</span>
                    </div>
                    <div class="trade-details">
                        <div class="trade-detail">
                            <span class="detail-label">P&L:</span>
                            <span class="trade-delta ${this.getDeltaClass(trade.pnl)}">${this.formatDelta(trade.pnl)}</span>
                        </div>
                        <div class="trade-detail">
                            <span class="detail-label">Balance:</span>
                            <span>${this.formatNumber(trade.balance_after || 0)}</span>
                        </div>
                        <div class="trade-detail">
                            <span class="detail-label">Outcome:</span>
                            <span>${this.convertSide(trade.outcome) || '--'}</span>
                        </div>
                        <div class="trade-detail">
                            <span class="detail-label">Mode:</span>
                            <span>${trade.mode || '-'}</span>
                        </div>
                    </div>
                </div>
            `).join('');
            container.innerHTML = tradesHtml;
        } else {
            // Desktop layout: table format
            const tradesHtml = this.tradesData.map(trade => `
                <div class="trade-item" data-trade-id="${trade.id}">
                    <div class="trade-time">${this.formatDateTime(trade.timestamp)}</div>
                    <div class="trade-side ${this.convertSide(trade.bet_side)?.toLowerCase() || ''}">${this.convertSide(trade.bet_side) || '--'}</div>
                    <div class="trade-result ${this._mapResultClass(trade.result_status) || ''}">${(trade.result_status || '--').toUpperCase()}</div>
                    <div class="trade-balance">${this.formatNumber(trade.balance_after || 0)}</div>
                    <div class="trade-delta ${this.getDeltaClass(trade.pnl)}">${this.formatDelta(trade.pnl)}</div>
                    <div class="trade-session">${trade.sid || '--'}</div>
                    <div class="trade-outcome">${this.convertSide(trade.outcome) || '--'}</div>
                </div>
            `).join('');

            const headerHtml = `
                <div class="trade-item trade-header" style="font-weight: 600; background: var(--glass-bg); border: 1px solid var(--glass-border); color: var(--text-primary);">
                    <div>Time</div>
                    <div>Side</div>
                    <div>Result</div>
                    <div>Balance After</div>
                    <div>P&L</div>
                    <div>Session ID</div>
                    <div>Outcome</div>
                </div>
            `;
            container.innerHTML = headerHtml + tradesHtml;
        }
    }

    smartUpdateTradesDisplay() {
        const container = document.getElementById('tradesContainer');

        // Only update if we have new trades
        if (this.tradesData.length === 0) return;

        // Store current trade IDs to detect new ones
        const currentTradeIds = Array.from(container.children)
            .filter(child => child.classList.contains('trade-item'))
            .map(child => child.dataset.tradeId)
            .filter(id => id);

        // Update the display
        this.updateTradesDisplay();

        // Add smooth animation for new trades
        const newTradeElements = Array.from(container.children)
            .filter(child => child.classList.contains('trade-item'))
            .filter(child => !currentTradeIds.includes(child.dataset.tradeId));

        newTradeElements.forEach((trade, index) => {
            trade.classList.add('new-trade');
            // Remove animation class after animation completes
            setTimeout(() => {
                trade.classList.remove('new-trade');
            }, 400);
        });

        // Add subtle pulse to existing trades that might have updated
        const existingTrades = Array.from(container.children)
            .filter(child => child.classList.contains('trade-item'))
            .filter(child => currentTradeIds.includes(child.dataset.tradeId));

        existingTrades.forEach((trade, index) => {
            trade.classList.add('trade-item-updated');
            setTimeout(() => {
                trade.classList.remove('trade-item-updated');
            }, 300);
        });
    }


    startAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        // Refresh every 5 seconds for more responsive updates
        this.refreshInterval = setInterval(() => {
            this.debouncedLoadData();
        }, 5000);
    }

    debouncedLoadData() {
        // Clear existing timeout
        if (this.loadDataTimeout) {
            clearTimeout(this.loadDataTimeout);
        }

        // Set new timeout
        this.loadDataTimeout = setTimeout(() => {
            this.loadAllData();
        }, 500); // 500ms debounce
    }

    // Utility functions
    formatNumber(num) {
        if (typeof num !== 'number') return '0';
        return new Intl.NumberFormat('vi-VN').format(num);
    }

    formatDelta(delta) {
        if (typeof delta !== 'number') return '0';
        const prefix = delta > 0 ? '+' : '';
        return prefix + this.formatNumber(delta);
    }

    getDeltaClass(delta) {
        if (typeof delta !== 'number') return 'neutral';
        if (delta > 0) return 'positive';
        if (delta < 0) return 'negative';
        return 'neutral';
    }

    formatTime(date) {
        return new Intl.DateTimeFormat('vi-VN', {
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    }

    formatDateTime(date) {
        return new Intl.DateTimeFormat('vi-VN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    }


    sampleChartData(data, timeRange) {
        if (data.length <= 50) return data;

        // Determine sampling interval based on time range and data density
        let sampleInterval;
        switch (timeRange) {
            case '1h': sampleInterval = Math.max(1, Math.floor(data.length / 30)); break;
            case '6h': sampleInterval = Math.max(1, Math.floor(data.length / 50)); break;
            case '24h': sampleInterval = Math.max(1, Math.floor(data.length / 60)); break;
            case '7d': sampleInterval = Math.max(1, Math.floor(data.length / 70)); break;
            case '30d': sampleInterval = Math.max(1, Math.floor(data.length / 80)); break;
            default: sampleInterval = Math.max(1, Math.floor(data.length / 50));
        }

        const sampledData = [];
        for (let i = 0; i < data.length; i += sampleInterval) {
            sampledData.push(data[i]);
        }

        // Always include the last data point
        if (data.length > 0 && sampledData[sampledData.length - 1] !== data[data.length - 1]) {
            sampledData.push(data[data.length - 1]);
        }

        return sampledData;
    }

    convertSide(side) {
        if (!side) return null;
        const sideStr = String(side).toLowerCase();
        if (sideStr === 'tai' || sideStr === 'tài') return 'Buy';
        if (sideStr === 'xiu' || sideStr === 'xỉu') return 'Sell';
        return side; // Return as-is if already converted or unknown
    }

    _mapResultClass(resultStatus) {
        if (!resultStatus) return '';
        const rs = String(resultStatus).toLowerCase();
        if (rs.includes('win')) return 'win';
        if (rs.includes('lose')) return 'lose';
        if (rs.includes('refund')) return 'refund';
        return rs;
    }

    _todayYMD() {
        const d = new Date();
        return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    }

    _buildBalanceFromTrades() {
        // Reconstruct a cumulative balance series if each trade has balance_after OR by summing pnl from a synthetic start.
        if (this.tradesData.length === 0) return;
        // Sort ascending by time to build series
        const asc = [...this.tradesData].sort((a, b) => a.timestamp - b.timestamp);
        const series = [];
        let lastBalance = asc[0].balance_after || null;
        let synthetic = false;
        if (lastBalance == null) {
            // If not provided, start at 0 and accumulate pnl
            synthetic = true;
            lastBalance = 0;
        }
        asc.forEach(tr => {
            if (synthetic && typeof tr.pnl === 'number') {
                lastBalance += tr.pnl;
            } else if (!synthetic && typeof tr.balance_after === 'number') {
                lastBalance = tr.balance_after;
            }
            series.push({
                id: tr.id || tr.sid,
                balance: lastBalance,
                performance: {}, // filled by stats recompute later
                timestamp: tr.timestamp
            });
        });
        this.balanceData = series;
        // If we have no performance stats yet but there is a current balance snapshot in RTDB, we could merge later
    }

    _recomputeStatsFromTrades() {
        const stats = { wins: 0, losses: 0, refunds: 0, last_result: null };
        
        console.log('Recomputing stats from trades:', {
            tradesDataLength: this.tradesData.length,
            tradesData: this.tradesData.slice(0, 3) // Log first 3 trades for debugging
        });
        
        if (this.tradesData.length === 0) {
            this.derivedStats = stats;
            console.log('No trades data, setting default stats:', stats);
            return;
        }
        
        // Most recent trade decides last_result
        this.tradesData.forEach(tr => {
            const rs = (tr.result_status || '').toLowerCase();
            console.log('Processing trade:', { id: tr.id, result_status: tr.result_status, rs });
            if (rs.includes('win')) stats.wins += 1;
            else if (rs.includes('lose')) stats.losses += 1;
            else if (rs.includes('refund')) stats.refunds += 1;
        });
        
        const latest = this.tradesData[0]; // tradesData sorted desc
        const rsLatest = (latest?.result_status || '').toLowerCase();
        if (rsLatest.includes('win')) stats.last_result = 'win';
        else if (rsLatest.includes('lose')) stats.last_result = 'lose';
        else if (rsLatest.includes('refund')) stats.last_result = 'refund';
        
        this.derivedStats = stats;
        console.log('Computed stats:', stats);

        // Propagate stats progressively into balanceData performance for chart tooltips if desired
        if (this.balanceData.length > 0) {
            const cumulative = { wins: 0, losses: 0, refunds: 0 };
            const byTime = [...this.tradesData].sort((a, b) => a.timestamp - b.timestamp);
            let i = 0;
            this.balanceData.forEach(point => {
                while (i < byTime.length && byTime[i].timestamp <= point.timestamp) {
                    const rs = (byTime[i].result_status || '').toLowerCase();
                    if (rs.includes('win')) cumulative.wins += 1;
                    else if (rs.includes('lose')) cumulative.losses += 1;
                    else if (rs.includes('refund')) cumulative.refunds += 1;
                    i++;
                }
                const total = cumulative.wins + cumulative.losses + cumulative.refunds;
                point.performance = {
                    wins: cumulative.wins,
                    losses: cumulative.losses,
                    refunds: cumulative.refunds,
                    last_result: stats.last_result,
                    win_rate: total > 0 ? (cumulative.wins / total) * 100 : 0
                };
            });
        }
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TradingDashboard();
});