# 📊 Trading Dashboard

A standalone web dashboard for monitoring live trading performance with professional analytics. This dashboard connects directly to Firebase to display real-time balance, trade history, and performance metrics with mobile-optimized design.

## ✨ Features

- 📊 **Real-time Balance Tracking** - Live balance updates with change indicators
- 📈 **Interactive Charts** - Balance history and trade results visualization
- 🔄 **Recent Trades Table** - Detailed trade history with filtering
- 📊 **Performance Statistics** - Win/loss ratios, total trades, and success metrics
- ⚙️ **Strategy Information** - Current trading strategy and ML status
- 🔧 **Easy Configuration** - Web-based Firebase configuration setup
- 📱 **Mobile-First Design** - Optimized touch interface with responsive layouts
- 🔄 **Buy/Sell Terminology** - Professional trading interface with clear Buy/Sell indicators

## 🚀 Quick Start

### 1. Deploy to GitHub Pages

1. **Fork or create a new repository**
2. **Upload the entire `view_trade` folder contents** to your repository
3. **Enable GitHub Pages** in repository settings (Settings > Pages > Source: Deploy from a branch > main)

### 2. Configure Firebase

1. **Open the deployed website** (`https://yourusername.github.io/repository-name/`)
2. **Configuration modal will appear automatically** on first visit
3. **Fill in your Firebase configuration:**

   ```json
   {
     "apiKey": "your-api-key-here",
     "authDomain": "your-project-id.firebaseapp.com",
     "databaseURL": "https://your-project-id-default-rtdb.asia-southeast1.firebasedatabase.app",
     "projectId": "your-project-id",
     "storageBucket": "your-project-id.appspot.com",
     "messagingSenderId": "123456789012",
     "appId": "1:123456789012:web:abcdef1234567890"
   }
   ```

4. **Select data source:**
   - **Firebase Realtime Database** (default) - for RTDB data structure
   - **Firebase Firestore** - for Firestore collections

5. **Save and connect** - Dashboard will initialize and start loading data

### 3. Firebase Security Rules

#### For Realtime Database (RTDB):
```json
{
  "rules": {
    "live_demo": {
      ".read": true,
      ".write": false
    }
  }
}
```

#### For Firestore:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /live_demo_balance_logs/{document} {
      allow read: if true;
      allow write: if false;
    }
    match /live_demo_trades/{document} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

## 📁 File Structure

```
view_trade/
├── index.html                     # Main dashboard page
├── assets/
│   ├── dashboard.js              # Main JavaScript logic
│   └── styles.css               # CSS styling
├── firebase-config.example.json  # Firebase config template
└── README.md                     # This file
```

## 🔧 Configuration Options

### Data Sources

The dashboard supports two Firebase data sources:

#### 1. Firebase Realtime Database (Recommended)
- **Balance data:** `/live_demo/balance_logs`
- **Trade data:** `/live_demo/trades/{session_id}`
- **Real-time updates:** Yes
- **Performance:** Better for live data

#### 2. Firebase Firestore
- **Balance data:** `live_demo_balance_logs` collection
- **Trade data:** `live_demo_trades` collection
- **Real-time updates:** Polling every 30 seconds
- **Performance:** Better for large datasets

### Chart Time Ranges

- Last 1 Hour
- Last 6 Hours
- **Last 24 Hours** (default)
- Last 7 Days
- Last 30 Days

### Trade History Limits

- Last 10 trades
- **Last 25 trades** (default)
- Last 50 trades
- Last 100 trades

## 📊 Data Structure

The dashboard expects the following data structure from your Firebase:

### Balance Log Entry
```json
{
  "balance": 1050000,
  "performance": {
    "wins": 15,
    "losses": 8,
    "refunds": 2,
    "total_bet_sessions": 25,
    "last_result": "win"
  },
  "summary": "last=win | W/L/R=15/8/2 | win_rate=60.00% | trades=25",
  "ts": "2024-01-15T10:30:00.000Z"
}
```

### Trade Entry
```json
{
  "sid": "session_123456",
  "bet_side": "Tai",
  "bet_cd": 40,
  "Y_at_bet": 125000,
  "Z_at_bet": 89000,
  "payout_rule": "bet_time_vs_final_min",
  "result": "win",
  "delta": 9800,
  "balance_after": 1059800,
  "outcome": "Tai",
  "ml_debug": "P(Tai)=0.765 | P(Tai)=0.765 | tau=0.6 | total=214,000",
  "ts": "2024-01-15T10:35:00.000Z"
}
```

*Note: The dashboard automatically converts "Tai" to "Buy" and "Xiu" to "Sell" for professional display.*

## 🎨 Customization

### Colors and Theme
Edit `assets/styles.css` to customize colors:

```css
:root {
  --primary-color: #1e3c72;
  --success-color: #4caf50;
  --danger-color: #f44336;
  --warning-color: #ff9800;
  --info-color: #2196f3;
}
```

### Chart Configuration
Modify `assets/dashboard.js` to customize chart appearance:

```javascript
this.colors = {
    primary: '#1e3c72',
    success: '#4caf50',
    danger: '#f44336',
    warning: '#ff9800',
    info: '#2196f3',
    background: 'rgba(30, 60, 114, 0.1)'
};
```

## 🔄 Auto-Refresh

The dashboard automatically refreshes data every **30 seconds** when connected. You can modify this interval in `dashboard.js`:

```javascript
// Change refresh interval (in milliseconds)
this.refreshInterval = setInterval(() => {
    this.loadAllData();
}, 30000); // 30 seconds
```

## 🐛 Troubleshooting

### Connection Issues
1. **Check Firebase config** - Ensure all fields are correct
2. **Verify Firebase rules** - Make sure read access is enabled
3. **Check browser console** - Look for JavaScript errors
4. **Test data structure** - Verify data exists in Firebase

### No Data Displayed
1. **Confirm data source** - Switch between RTDB and Firestore
2. **Check data paths** - Ensure `/live_demo/` paths exist
3. **Verify timestamps** - Ensure `ts` field format is correct
4. **Test with sample data** - Add test records to Firebase

### Performance Issues
1. **Reduce data limits** - Lower trade history limit
2. **Adjust time range** - Use shorter time periods
3. **Optimize Firebase rules** - Add indexing for Firestore
4. **Use RTDB for live data** - Better performance for real-time updates

## 📱 Mobile-First Design

The dashboard is built with mobile-first approach and features:
- **Touch-optimized controls** - 44px minimum touch targets
- **Responsive grid layouts** - Single column on mobile, multi-column on desktop
- **Mobile-specific trade cards** - Stacked layout instead of tables
- **Smooth scrolling** - Native iOS/Android scroll behavior
- **Professional color scheme** - Dark blue gradient background
- **Automatic layout switching** - Desktop table view, mobile card view

## 🔒 Security Notes

- **Firebase rules** are configured for **read-only access**
- **No sensitive data** is stored in the web app
- **Config is stored locally** in browser localStorage
- **HTTPS required** for GitHub Pages deployment

## 🤝 Contributing

This is a standalone web app designed for deployment independence. To customize:

1. **Fork the repository**
2. **Modify the files** in `view_trade/` directory
3. **Test locally** by opening `index.html` in browser
4. **Deploy to GitHub Pages** or any static hosting service

## 📄 License

This project is part of the B52 crawler system and follows the same licensing terms.