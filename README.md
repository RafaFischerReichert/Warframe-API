# Warframe Syndicate Mod Market

A web application to search for Warframe syndicate mods and check their current market prices using the Warframe Market API.

## Features

- **Syndicate Mod Search**: Search for mods from any of the 6 major syndicates
- **Real-time Pricing**: Get current lowest prices from the Warframe Market
- **Price Sorting**: Results automatically sorted by lowest price
- **Order Count**: See how many active orders are available for each mod
- **Dark Theme**: Modern dark mode interface
- **Responsive Design**: Works on desktop and mobile devices
- **CORS Proxy**: Built-in proxy server to handle API requests

## Supported Syndicates

- **Steel Meridian** - Red-themed syndicate
- **Arbiters of Hexis** - Blue-themed syndicate  
- **Cephalon Suda** - Cyan-themed syndicate
- **Perrin Sequence** - Green-themed syndicate
- **Red Veil** - Dark red syndicate
- **New Loka** - Light green syndicate

## Setup

### Prerequisites

- Python 3.x
- A modern web browser

### Running the Application

1. **Clone or download this repository**

2. **Start the proxy server:**
   ```bash
   python proxy_server.py
   ```

3. **Open your browser and navigate to:**
   ```
   http://localhost:8000
   ```

## Usage

1. Enter a syndicate name in the search box (e.g., "Steel Meridian", "Red Veil", "Suda")
2. Click "Search Mods" or press Enter
3. View the results showing:
   - Mod names and categories
   - Current lowest prices
   - Number of active orders
   - Results sorted by price (lowest first)

## How It Works

The application uses a **proxy server** (`proxy_server.py`) that:
- Serves the web application files
- Handles CORS (Cross-Origin Resource Sharing) headers
- Proxies API requests to the Warframe Market API
- Prevents network errors that occur when calling the API directly from browsers

## Troubleshooting

### Network Error Issues
- **Make sure you're using the proxy server**: Run `python proxy_server.py` and access via `http://localhost:8000`
- **Don't open the HTML file directly**: This will cause CORS errors
- **Check if the server is running**: The terminal should show "Proxy server running on http://localhost:8000"

### Common Issues
- **"NetworkError when attempting to fetch resource"**: Use the proxy server instead of opening the file directly
- **No results found**: Try different syndicate names or check your internet connection
- **Server won't start**: Make sure port 8000 is not in use by another application

## API Information

This application uses the **Warframe Market API**:
- **Base URL**: `https://api.warframe.market/v1`
- **Authentication**: Not required for public endpoints
- **Rate Limits**: Please be respectful of the API's rate limits

## Files

- `index.html` - Main web page
- `style.css` - Dark theme styling
- `script.js` - Application logic and API integration
- `proxy_server.py` - CORS proxy server
- `README.md` - This documentation

## License

This project is open source and available under the MIT License. 