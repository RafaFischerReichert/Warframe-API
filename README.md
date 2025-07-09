# Warframe Market API Tools

A collection of tools for interacting with the Warframe Market API, including a Prime Items Trading Analyzer and authentication system.

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

### 🔍 Syndicate Mod Search
- **Search syndicate mods** by syndicate name
- **Real-time pricing** from Warframe Market
- **Filter by mod type** and rank
- **Time range filtering** for order age
- **Order mode selection** (online only vs all orders)

---

## Setup Instructions

### Prerequisites
- Python 3.x
- Modern web browser

### Installation & Running
1. **Clone or download this repository.**
2. **Start the Python proxy server:**
   ```bash
   python -m backend.proxy_server
   ```
3. **Open your browser** and go to:
   ```
   http://localhost:8000
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
5. **Stop analysis** at any time with the "Stop Analysis" button
6. **Clear the table** with the "Clear Table" button

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

**Frontend (trading-calculator.js):**
```javascript
const CONFIG = {
    BATCH_SIZE: 5,           // Items processed simultaneously
    BATCH_DELAY: 200,        // Delay between batches (ms)
    ITEM_DELAY: 200,         // Delay between items (ms)
    MAX_OPPORTUNITIES: 20    // Max results to show
};
```

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

- **No Order Creation:** This tool does not create or manage orders on Warframe.market
- **Some Orders Missing:** Some orders visible on the Warframe.market website (notably those with a special icon next to the profile picture) may not appear in this app. These orders are not present in the public API and cannot be fetched programmatically
- **API Rate Limits:** The tool is rate-limited to avoid being blocked by Warframe.market. Large scans may take several minutes
- **Data Freshness:** Results are only as fresh as the public API allows. Some stale orders may appear if not yet purged from the API
- **Authentication Scope:** Currently, authentication is separate from trading features. Future updates may integrate authenticated API calls

---

## Project Structure (Refactored)

- `backend/` — Python backend code (auth_handler.py, proxy_server.py)
- `frontend/` — All frontend code
    - `index.html`, `login.html`, `trading-calculator.html`
    - `js/` — JavaScript files
    - `css/` — CSS files
- `data/` — Data files (syndicate_items.json, SYNDICATE_ITEMS_README.md)
- `tests/` — (For future test files)

All file references in HTML have been updated to match this structure.

---

## API Endpoints

### Backend Endpoints (via proxy server)
- `GET /auth/status` - Check authentication status
- `POST /auth/login` - Login with credentials
- `POST /auth/logout` - Logout and clear session
- `GET /rate-limit-status` - Check rate limiting status

### Frontend Pages
- `/` - Syndicate search (index.html)
- `/trading-calculator.html` - Trading calculator
- `/login.html` - Authentication page

---

## Credits & Acknowledgments

- **Warframe.market** for their public API and market data
- **Digital Extremes** for Warframe and the Warframe API
- **You!** For using, testing, and improving this tool

---

## License

MIT License — see LICENSE for details

---

## Disclaimer

This tool is for educational and personal use only. Use at your own risk. The developers are not responsible for any trading losses, account issues, or market changes. Not affiliated with Digital Extremes or Warframe.market. 