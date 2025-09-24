# 🚀 Deployment Guide

## Option 1: GitHub Pages (Recommended)

### Step 1: Create Repository
```bash
# Create a new repository on GitHub
# Name it something like "b52-trading-dashboard"
```

### Step 2: Upload Files
1. **Clone your new repository** or create files directly on GitHub
2. **Upload all files** from the `view_trade` folder to the root of your repository
3. **Commit and push** changes

### Step 3: Enable GitHub Pages
1. Go to **Settings** in your repository
2. Scroll to **Pages** section
3. Select **Source**: Deploy from a branch
4. Choose **Branch**: main (or master)
5. **Save** - Your site will be available at: `https://yourusername.github.io/repository-name/`

### Step 4: Configure Firebase
1. **Visit your deployed site**
2. **Configuration modal** will appear
3. **Enter your Firebase config** (get from Firebase Console > Project Settings)
4. **Select data source** (RTDB recommended)
5. **Save and connect**

---

## Option 2: Netlify

### Deploy via Drag & Drop
1. **Visit [netlify.com](https://netlify.com)**
2. **Drag the entire `view_trade` folder** to the deploy area
3. **Site will be live immediately** at a random subdomain
4. **Optional**: Configure custom domain

### Deploy via Git
1. **Push `view_trade` contents** to a GitHub repository
2. **Connect repository** to Netlify
3. **Set build settings**:
   - Build command: (empty)
   - Publish directory: `/`
4. **Deploy**

---

## Option 3: Vercel

### Deploy via GitHub
1. **Push to GitHub** repository
2. **Import project** on [vercel.com](https://vercel.com)
3. **Configure**:
   - Framework Preset: Other
   - Root Directory: `/` (if view_trade is in root)
4. **Deploy**

---

## Option 4: Firebase Hosting

### Setup
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
```

### Configure firebase.json
```json
{
  "hosting": {
    "public": ".",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

### Deploy
```bash
firebase deploy --only hosting
```

---

## Option 5: Simple HTTP Server (Local Testing)

### Python
```bash
cd view_trade
python -m http.server 8000
# Visit: http://localhost:8000
```

### Node.js
```bash
cd view_trade
npx http-server
# Visit: http://localhost:8080
```

### PHP
```bash
cd view_trade
php -S localhost:8000
# Visit: http://localhost:8000
```

---

## 🔧 Configuration After Deployment

### 1. Get Firebase Config
1. **Go to Firebase Console** > Your Project
2. **Click Settings gear** > Project settings
3. **Scroll to "Your apps"** section
4. **Click "Config"** radio button
5. **Copy the config object**

### 2. Configure Web App
1. **Open your deployed dashboard**
2. **Configuration modal appears** automatically
3. **Paste Firebase config JSON**
4. **Select data source**:
   - **RTDB**: For `/live_demo/balance_logs` and `/live_demo/trades/`
   - **Firestore**: For `live_demo_balance_logs` and `live_demo_trades` collections
5. **Save & Connect**

### 3. Set Firebase Security Rules

#### Realtime Database Rules:
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

#### Firestore Rules:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /live_demo_balance_logs/{document} {
      allow read: if true;
    }
    match /live_demo_trades/{document} {
      allow read: if true;
    }
  }
}
```

---

## 🔒 Security Considerations

### Public Deployment Checklist
- [ ] **Firebase rules** set to read-only
- [ ] **No sensitive data** in JavaScript files
- [ ] **Config stored locally** (localStorage)
- [ ] **HTTPS enabled** (automatic with most hosts)
- [ ] **Real firebase-config.json** in .gitignore

### Firebase Config Security
```javascript
// ✅ Safe - Config can be public (with proper rules)
const firebaseConfig = {
  apiKey: "AIzaSyC...", // Public API key
  authDomain: "project.firebaseapp.com",
  databaseURL: "https://project-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "project-id"
};
```

The **API key** in Firebase web config is **safe to be public** because:
- It only identifies your project
- Security is handled by **Firebase Rules**
- Domain restrictions can be set in Firebase Console

---

## 🐛 Troubleshooting Deployment

### GitHub Pages Issues
- **404 Error**: Check if `index.html` is in root directory
- **JS/CSS not loading**: Ensure relative paths in HTML
- **Firebase connection fails**: Check HTTPS requirement

### Netlify Issues
- **Build fails**: Ensure no build step required (static site)
- **404 on refresh**: Add `_redirects` file with: `/* /index.html 200`

### Firebase Connection Issues
- **CORS errors**: Check Firebase console for domain restrictions
- **Connection timeout**: Verify database URL format
- **No data**: Check Firebase Rules and data structure

### Mobile Issues
- **Charts not responsive**: Ensure Chart.js responsive: true
- **Touch not working**: Check CSS touch-action properties
- **Layout broken**: Test with mobile viewport meta tag

---

## ✅ Post-Deployment Checklist

- [ ] **Site loads** without errors
- [ ] **Configuration modal** appears on first visit
- [ ] **Firebase connection** establishes successfully
- [ ] **Balance data** displays correctly
- [ ] **Charts render** properly
- [ ] **Trades table** populates
- [ ] **Mobile responsive** layout works
- [ ] **Auto-refresh** works (check after 30 seconds)
- [ ] **Time range filters** work on charts
- [ ] **Trade limit filters** work on table