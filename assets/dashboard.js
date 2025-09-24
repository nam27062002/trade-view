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
            const previousBalanceLength = this.balanceData.length;
            const previousTradesLength = this.tradesData.length;

            await Promise.all([
                this.loadBalanceData(),
                this.loadTradesData()
            ]);

            // Smart update logic
            const hasNewBalance = this.balanceData.length > previousBalanceLength;
            const hasNewTrades = this.tradesData.length > previousTradesLength;

            if (hasNewBalance || hasNewTrades) {
                this.smartUpdateDashboard(hasNewBalance, hasNewTrades);
            }
        } catch (error) {
            console.error('Error loading data:', error);
            this.updateStatus('error', 'Failed to load data');
        } finally {
            this.isUpdating = false;
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
        const snapshot = await this.database.ref('/live_demo/balance_logs').once('value');
        const data = snapshot.val();

        if (!data) {
            this.balanceData = [];
            return;
        }

        // Convert to array and sort by timestamp
        this.balanceData = Object.entries(data)
            .map(([key, value]) => ({
                id: key,
                ...value,
                timestamp: new Date(value.ts || value.timestamp || Date.now())
            }))
            .sort((a, b) => a.timestamp - b.timestamp);
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
        const limit = parseInt(document.getElementById('tradeLimit').value);

        if (this.dataSource === 'rtdb') {
            return this.loadTradesDataRTDB(limit);
        } else {
            return this.loadTradesDataFirestore(limit);
        }
    }

    async loadTradesDataRTDB(limit) {
        const snapshot = await this.database.ref('/live_demo/trades').once('value');
        const data = snapshot.val();

        if (!data) {
            this.tradesData = [];
            return;
        }

        // Convert to array and sort by timestamp
        this.tradesData = Object.entries(data)
            .map(([sid, trade]) => ({
                sid,
                ...trade,
                timestamp: new Date(trade.ts || trade.timestamp || Date.now())
            }))
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }

    async loadTradesDataFirestore(limit) {
        const snapshot = await this.firestore
            .collection('live_demo_trades')
            .orderBy('ts', 'desc')
            .limit(limit)
            .get();

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

    smartUpdateDashboard(hasNewBalance, hasNewTrades) {
        // Always update balance and stats if there's new balance data
        if (hasNewBalance) {
            this.smartUpdateBalanceDisplay();
            this.smartUpdateStatsDisplay();
            this.smartUpdateBalanceChart();
        }

        // Update trades and results chart if there's new trade data
        if (hasNewTrades) {
            this.smartUpdateResultsChart();
            this.smartUpdateTradesDisplay();
        }
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
            // Add smooth transition
            balanceEl.style.transition = 'all 0.3s ease';
            changeEl.style.transition = 'all 0.3s ease';

            // Flash effect for new data
            balanceEl.style.background = 'rgba(88, 166, 255, 0.2)';
            setTimeout(() => {
                balanceEl.style.background = 'transparent';
            }, 500);

            this.updateBalanceDisplay();
            this.previousBalance = balance;
        }
    }

    updateStatsDisplay() {
        const latest = this.balanceData[this.balanceData.length - 1];
        const performance = latest?.performance || {};

        // Extract stats
        const wins = performance.wins || 0;
        const losses = performance.losses || 0;
        const refunds = performance.refunds || 0;
        const totalTrades = wins + losses + refunds;
        const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : 0;

        // Update display
        document.getElementById('winRate').textContent = winRate + '%';
        document.getElementById('totalTrades').textContent = totalTrades;
        document.getElementById('wins').textContent = wins;
        document.getElementById('losses').textContent = losses;
        document.getElementById('refunds').textContent = refunds;
        document.getElementById('lastResult').textContent = performance.last_result || '--';

        // Store for other uses
        this.currentStats = { wins, losses, refunds, totalTrades, winRate };
    }

    smartUpdateStatsDisplay() {
        const latest = this.balanceData[this.balanceData.length - 1];
        const performance = latest?.performance || {};

        const newStats = {
            wins: performance.wins || 0,
            losses: performance.losses || 0,
            refunds: performance.refunds || 0,
            lastResult: performance.last_result || '--'
        };

        // Check if any stats changed
        const statsChanged = JSON.stringify(this.previousStats) !== JSON.stringify(newStats);

        if (statsChanged) {
            // Add pulse animation to changed stats
            const statElements = ['winRate', 'totalTrades', 'wins', 'losses', 'refunds', 'lastResult'];
            statElements.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.style.transition = 'all 0.3s ease';
                    el.style.transform = 'scale(1.05)';
                    setTimeout(() => {
                        el.style.transform = 'scale(1)';
                    }, 300);
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

        // Smooth update with animation
        this.charts.balance.update('none'); // No animation for smooth experience
    }

    updateResultsChart() {
        const ctx = document.getElementById('resultsChart').getContext('2d');
        const { wins, losses, refunds } = this.currentStats;

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

        const { wins, losses, refunds } = this.currentStats;

        // Update data smoothly
        this.charts.results.data.datasets[0].data = [wins, losses, refunds];
        this.charts.results.update('none'); // No animation for smooth experience
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
                <div class="trade-item mobile-trade">
                    <div class="trade-header">
                        <span class="trade-time">${this.formatDateTime(trade.timestamp)}</span>
                        <span class="trade-side ${this.convertSide(trade.bet_side)?.toLowerCase() || ''}">${this.convertSide(trade.bet_side) || '--'}</span>
                        <span class="trade-result ${trade.result || ''}">${trade.result?.toUpperCase() || '--'}</span>
                    </div>
                    <div class="trade-details">
                        <div class="trade-detail">
                            <span class="detail-label">P&L:</span>
                            <span class="trade-delta ${this.getDeltaClass(trade.delta)}">${this.formatDelta(trade.delta)}</span>
                        </div>
                        <div class="trade-detail">
                            <span class="detail-label">Balance:</span>
                            <span>${this.formatNumber(trade.balance_after || 0)}</span>
                        </div>
                        <div class="trade-detail">
                            <span class="detail-label">Outcome:</span>
                            <span>${this.convertSide(trade.outcome) || '--'}</span>
                        </div>
                    </div>
                </div>
            `).join('');
            container.innerHTML = tradesHtml;
        } else {
            // Desktop layout: table format
            const tradesHtml = this.tradesData.map(trade => `
                <div class="trade-item">
                    <div class="trade-time">${this.formatDateTime(trade.timestamp)}</div>
                    <div class="trade-side ${this.convertSide(trade.bet_side)?.toLowerCase() || ''}">${this.convertSide(trade.bet_side) || '--'}</div>
                    <div class="trade-result ${trade.result || ''}">${trade.result?.toUpperCase() || '--'}</div>
                    <div class="trade-balance">${this.formatNumber(trade.balance_after || 0)}</div>
                    <div class="trade-delta ${this.getDeltaClass(trade.delta)}">${this.formatDelta(trade.delta)}</div>
                    <div class="trade-session">${trade.sid || '--'}</div>
                    <div class="trade-outcome">${this.convertSide(trade.outcome) || '--'}</div>
                </div>
            `).join('');

            const headerHtml = `
                <div class="trade-item" style="font-weight: 600; background: #f8f9fa;">
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

        // Add fade-in animation for new trades
        const currentChildren = container.children.length;

        // Update the display
        this.updateTradesDisplay();

        // Animate new trades if any
        if (container.children.length > currentChildren) {
            const newTrades = Array.from(container.children).slice(0, container.children.length - currentChildren);
            newTrades.forEach((trade, index) => {
                trade.style.opacity = '0';
                trade.style.transform = 'translateY(-10px)';
                setTimeout(() => {
                    trade.style.transition = 'all 0.3s ease';
                    trade.style.opacity = '1';
                    trade.style.transform = 'translateY(0)';
                }, index * 100);
            });
        }
    }


    startAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        // Refresh every 10 seconds for more responsive updates
        this.refreshInterval = setInterval(() => {
            this.loadAllData();
        }, 10000);
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
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TradingDashboard();
});