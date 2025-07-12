# Warframe Market API Tools

A collection of tools for interacting with the Warframe Market API, including a Prime Items Trading Analyzer, authentication system, and order management. Available as both a web app and a native desktop application using Tauri.

> **🚀 New to the project?** Check out the [Quick Start Guide](QUICK_START.md) to get up and running in minutes!

---

## Features

### 🔐 Authentication System
- **Login/Logout functionality** using Warframe Market v1 API
- **JWT token management** with automatic session handling
- **Authentication status indicators** on all pages
- **Secure credential handling** with proper session management

### 📊 Prime Items Trading Analyzer
- **Comprehensive Prime Analysis:** Scans ALL Prime items (sets, weapons, frames, parts, accessories) for trading opportunities
- **Live Market Data:** Fetches real-time public orders from Warframe.market
- **Smart Filtering:**
  - Only considers "ingame" (active) orders
  - Adjustable max order age (slider, in days)
  - Minimum profit and max investment filters
- **Realistic Trading Logic:**
  - Buy at (highest WTB + 1), sell at (lowest WTS - 1)
  - Shows only actionable, realistic opportunities
- **Order Age Visualization:**
  - Buy price cell is color-coded by order age (green = fresh, red = stale)
  - Table shows the age (in days) of the best WTB order
- **Top Opportunities Table:**
  - Ranks and displays the top 20 arbitrage opportunities
  - Includes ROI, net profit, quantity, and total investment
- **Rate Limiting Protection:**
  - Real-time rate limit detection and warnings
  - Automatic request throttling
  - Visual indicators when API limits are hit
- **One-Click Analysis:**
  - Simple UI: set your filters, click "Analyze All Prime Items," and see results
- **Stop Analysis:**
  - Cancel a long scan at any time with the "Stop Analysis" button

### 🛒 WTB Order Management
- **Create WTB Orders:** One-click creation of WTB orders from top opportunities
- **Order Lifecycle Management:** Track orders from pending → bought → sold
- **Portfolio Tracking:** Maintain a local portfolio of bought items
- **Pending Orders Panel:** View and manage active WTB orders
- **Portfolio Panel:** Track bought items and mark them as sold
- **Real-time Updates:** Order status updates reflect immediately in the UI

### 🔍 Syndicate Mod Search
- **Search syndicate mods** by syndicate name
- **Real-time pricing** from Warframe Market
- **Filter by mod type** and rank
- **Time range filtering** for order age
- **Order mode selection** (online only vs all orders)

### 🖥️ Desktop Application (Tauri)
- **Native Desktop App:** Cross-platform desktop application built with Tauri
- **Offline Capable:** Works without internet connection for local features
- **System Integration:** Native window controls and system tray support
- **Fast Performance:** Rust-based backend with React frontend
- **Modern UI:** Built with React and Vite for a responsive experience

---

## Setup Instructions

### Prerequisites
- Python 3.x (for backend API)
- Node.js 18+ (for React frontend)
- Rust (for Tauri desktop app)
- Modern web browser (for web version)

### Web Application Setup
1. **Clone or download this repository.**
2. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
3. **Start the Python proxy server:**
   ```bash
   python -m backend.proxy_server
   ```
4. **Start the Vite React frontend:**
   ```bash
   cd frontend-vite
   npm install
   npm run dev
   ```
5. **Open your browser** and go to the address shown by Vite (usually `http://localhost:5173`).

### Desktop Application Setup (Tauri)
1. **Install Rust and Tauri prerequisites:**
   ```bash
   # Install Rust
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   
   # Install Tauri CLI
   cargo install tauri-cli
   ```
2. **Install frontend dependencies:**
   ```bash
   cd frontend-vite
   npm install
   ```
3. **Build and run the desktop app:**
   ```bash
   npm run tauri dev
   ```
4. **For production builds:**
   ```bash
   npm run tauri build
   ```

### Environment Configuration
Create a `.env` file in the `frontend-vite` directory:
```env
VITE_API_URL=http://localhost:8000
```

---

## How to Use

### Authentication
1. **Navigate to the Login page** using the navigation menu
2. **Enter your Warframe Market credentials** (email and password)
3. **Check authentication status** - a green indicator shows when logged in
4. **Logout** when finished using the logout button

### Trading Calculator
1. **Set your filters:**
   - Minimum profit (platinum)
   - Maximum investment (platinum)
   - Max order age (slider)
2. **Click "Analyze All Prime Items"**
3. **Watch the progress bar** and see the top opportunities populate the table
4. **Review results:**
   - Buy/Sell prices, order age, ROI, net profit, and more
5. **Create WTB Orders:**
   - Click "Create WTB Order" on any opportunity
   - Orders appear in the "Pending Orders" panel
6. **Manage Orders:**
   - Mark pending orders as "Bought" when you purchase items
   - Move bought items to "Portfolio" and mark as "Sold" when sold
7. **Stop analysis** at any time with the "Stop Analysis" button
8. **Clear the table** with the "Clear Table" button

### Order Management Workflow
1. **Create WTB Orders** from top opportunities
2. **Track Pending Orders** in the left panel
3. **Mark as Bought** when you purchase items
4. **Move to Portfolio** to track owned items
5. **Mark as Sold** when you sell items for profit

### Syndicate Search
1. **Enter a syndicate name** (e.g., "Steel Meridian", "Red Veil")
2. **Adjust filters** as needed (rank, order mode, time range)
3. **View results** sorted by price and availability

---

## Configuration

### Request Rate Limiting
The application includes configurable request rates to avoid API rate limiting:

**Backend (proxy_server.py):**
```python
REQUESTS_PER_SECOND = 5  # Adjust this value (recommended: 3-10)
```

**Frontend (Vite React):**
- Configuration is handled in the React app and backend.

**Speed Tuning Guide:**
- **Conservative:** 3 requests/second (recommended for server safety)
- **Balanced:** 5 requests/second (current setting, maximum safe limit)
- **Aggressive:** 10+ requests/second (may trigger rate limits)

---

## Authentication Details

The authentication system uses the Warframe Market v1 API:
- **JWT-based authentication** with automatic token refresh
- **Session management** with 1-hour validity
- **Secure credential handling** - credentials are not stored locally
- **CORS handling** through the proxy server

**Note:** Authentication is currently independent of the trading features. Logged-in sessions may be used for future authenticated API calls.

---

## Rate Limiting Protection

The application includes comprehensive rate limiting protection:
- **Real-time detection** of HTTP 429 responses
- **Visual warnings** when rate limited
- **Automatic throttling** to prevent rate limit triggers
- **Countdown timers** showing estimated wait times
- **Button disabling** during rate limit periods

---

## Limitations & Known Issues

- **No Order Creation:** This tool does not create or manage orders on Warframe.market (feature coming soon)
- **Some Orders Missing:** Some orders visible on the Warframe.market website (notably those with a special icon next to the profile picture) may not appear in this app. These orders are not present in the public API and cannot be fetched programmatically
- **API Rate Limits:** The tool is rate-limited to avoid being blocked by Warframe.market. Large scans may take several minutes
- **Data Freshness:** Results are only as fresh as the public API allows. Some stale orders may appear if not yet purged from the API
- **Authentication Scope:** Currently, authentication is separate from trading features. Future updates may integrate authenticated API calls
- **Portfolio Persistence:** Portfolio and order data is currently stored in frontend state only. Data will be lost on page refresh (backend persistence coming soon)

---

## Project Structure

```
Warframe-API/
├── backend/                 # Python backend API
│   ├── __init__.py
│   ├── auth_handler.py     # Authentication logic
│   ├── proxy_server.py     # Main API server
│   └── trading_calculator.py # Trading analysis logic
├── frontend-vite/          # React + Vite frontend with Tauri
│   ├── src/               # React components and application logic
│   │   ├── App.jsx        # Main application component
│   │   ├── Login.jsx      # Authentication component
│   │   ├── TradingCalculator.jsx # Trading analysis component
│   │   ├── SyndicateScreen.jsx # Syndicate search component
│   │   └── api.js         # API client utilities
│   ├── src-tauri/         # Tauri configuration and Rust backend
│   │   ├── src/           # Rust source code
│   │   ├── Cargo.toml     # Rust dependencies
│   │   ├── tauri.conf.json # Tauri configuration
│   │   └── icons/         # Application icons
│   ├── public/            # Static assets
│   ├── package.json       # Node.js dependencies
│   └── vite.config.js     # Vite configuration
├── data/                  # Data files
│   ├── syndicate_items.json
│   └── SYNDICATE_ITEMS_README.md
├── tests/                 # Test files for backend components
├── requirements.txt       # Python dependencies
└── README.md             # This file
```

---

## API Endpoints

### Backend Endpoints (via proxy server)
- `GET /auth/status` - Check authentication status
- `POST /auth/login` - Login with credentials
- `POST /auth/logout` - Logout and clear session
- `GET /rate-limit-status` - Check rate limiting status
- `POST /api/trading-calc` - Start trading analysis job
- `GET /api/trading-calc-progress?job_id=...` - Poll trading analysis progress/results
- `POST /api/orders/wtb` - Create WTB order
- `POST /api/orders/wts` - Create WTS order
- `DELETE /api/orders/:order_id` - Delete order
- `GET /api/orders/user` - Get user's orders

### Frontend Routes
- `/` - Login (React)
- `/syndicate` - Syndicate Analysis (React)
- `/trading` - Trading Calculator (React)

---

## Development

### Building for Production
```bash
# Web version
cd frontend-vite
npm run build

# Desktop version
npm run tauri build
```

### Development Commands
```bash
# Web development
cd frontend-vite
npm run dev

# Desktop development
npm run tauri dev

# Backend development (from root directory)
python -m backend.proxy_server
```

### Testing
```bash
# Run Python backend tests
python -m pytest tests/

# Run frontend tests (if configured)
cd frontend-vite
npm test
```

---

## Credits & Acknowledgments

- **Warframe.market** for their public API and market data
- **Digital Extremes** for Warframe and the Warframe API
- **Tauri** for the desktop application framework
- **React** and **Vite** for the modern frontend experience
- **You!** For using, testing, and improving this tool

---

## License

MIT License — see LICENSE for details

---

## Disclaimer

This tool is for educational and personal use only. Use at your own risk. The developers are not responsible for any trading losses, account issues, or market changes. Not affiliated with Digital Extremes or Warframe.market. 