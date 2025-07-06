# Warframe Prime Set Trading Analyzer

A powerful, privacy-friendly tool for analyzing arbitrage and trading opportunities for Warframe Prime Sets using public Warframe.market data. No login, no account, no order creation—just pure market intelligence.

---

## Features

- **Prime Set Analysis:** Scans all Warframe Prime sets for the best buy/sell gaps.
- **Live Market Data:** Fetches real-time public orders from Warframe.market.
- **Smart Filtering:**
  - Only considers "ingame" (active) orders.
  - Adjustable max order age (slider, in days).
  - Minimum profit and max investment filters.
- **Realistic Trading Logic:**
  - Buy at (highest WTB + 1), sell at (lowest WTS - 1).
  - Shows only actionable, realistic opportunities.
- **Order Age Visualization:**
  - Buy price cell is color-coded by order age (green = fresh, red = stale).
  - Table shows the age (in days) of the best WTB order.
- **Top Opportunities Table:**
  - Ranks and displays the top 20 arbitrage opportunities.
  - Includes ROI, net profit, quantity, and total investment.
- **No Login Required:**
  - No account, no cookies, no tracking, no order creation.
- **One-Click Analysis:**
  - Simple UI: set your filters, click "Analyze All Prime Sets," and see results.
- **Stop Analysis:**
  - Cancel a long scan at any time with the "Stop Analysis" button.

---

## Setup Instructions

### Prerequisites
- Python 3.x
- Modern web browser

### Installation & Running
1. **Clone or download this repository.**
2. **Start the Python proxy server:**
   ```bash
   python proxy_server.py
   ```
3. **Open your browser** and go to:
   ```
   http://localhost:8000
   ```

---

## How to Use

1. **Set your filters:**
   - Minimum profit (platinum)
   - Maximum investment (platinum)
   - Max order age (slider)
2. **Click "Analyze All Prime Sets"**
3. **Watch the progress bar** and see the top opportunities populate the table.
4. **Review results:**
   - Buy/Sell prices, order age, ROI, net profit, and more.
5. **Stop analysis** at any time with the "Stop Analysis" button.
6. **Clear the table** with the "Clear Table" button.

---

## Limitations & Known Issues

- **No Order Creation:** This tool does not create or manage orders on Warframe.market.
- **No Login/Account:** You cannot log in or see your own orders.
- **Some Orders Missing:** Some orders visible on the Warframe.market website (notably those with a special icon next to the profile picture) may not appear in this app. These orders are not present in the public API and cannot be fetched programmatically.
- **API Rate Limits:** The tool is rate-limited to avoid being blocked by Warframe.market. Large scans may take a minute or two.
- **Data Freshness:** Results are only as fresh as the public API allows. Some stale orders may appear if not yet purged from the API.

---

## Project Structure

```
warframe-prime-trading/
├── trading-calculator.html    # Main UI
├── trading-calculator.js      # Frontend logic
├── style.css                 # App styling
├── proxy_server.py           # Python proxy server (CORS + API proxy)
├── README.md                 # This file
├── LICENSE                   # License info
```

---

## Credits & Acknowledgments

- **Warframe.market** for their public API and market data.
- **Digital Extremes** for Warframe and the Warframe API.
- **You!** For using, testing, and improving this tool.

---

## License

MIT License — see LICENSE for details.

---

## Disclaimer

This tool is for educational and personal use only. Use at your own risk. The developers are not responsible for any trading losses, account issues, or market changes. Not affiliated with Digital Extremes or Warframe.market. 