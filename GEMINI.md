# Project: Trading Dashboard

## Project Overview

This project is a standalone, client-side web application that serves as a trading dashboard. It is built with vanilla HTML, CSS, and JavaScript, and it uses Chart.js for data visualization. The application connects to a Firebase backend (either Realtime Database or Firestore) to fetch and display live trading data.

The dashboard is designed as a Progressive Web App (PWA), featuring a service worker for offline capabilities and a web app manifest that allows users to install it on their devices. The user interface is modern and responsive, with a glassmorphism design, animated gradients, and a dark/light theme toggle.

## How to Run

This is a static web project with no build process. To run it, you can simply open the `index.html` file in a web browser.

For local development, it is recommended to use a simple HTTP server to avoid potential issues with browser security policies, especially for the service worker to function correctly.

### Using Python's built-in server:
```bash
python -m http.server 8000
```
Then, open `http://localhost:8000` in your browser.

Refer to `DEPLOY.md` for detailed instructions on deploying to various platforms like GitHub Pages, Netlify, Vercel, and Firebase Hosting.

## Development Conventions

*   **Configuration**: The application loads its Firebase configuration from `firebase-config.json`. If this file is not found, a configuration modal will appear, allowing the user to enter their Firebase credentials, which are then stored in the browser's `localStorage`.
*   **Styling**: The project uses CSS variables for theming, making it easy to customize colors, gradients, and other visual aspects. The main stylesheet is located at `assets/styles.css`.
*   **JavaScript**: The core application logic is encapsulated within the `TradingDashboard` class in `assets/dashboard.js`.
*   **Data Schema**: The expected Firebase data structure for balance logs and trade history is documented in `SCHEMA_README.md`.
*   **Progressive Web App (PWA)**: The project includes a `manifest.json` file and a service worker (`sw.js`) to provide PWA features, such as offline access and the ability to be installed on a user's home screen.
