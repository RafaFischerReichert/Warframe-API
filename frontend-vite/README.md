# Warframe Market API Frontend

This is the React + Vite frontend for the Warframe Market API Tools project. It provides a modern web interface for trading analysis, syndicate mod search, and order management.

## Features

- **Trading Calculator**: Analyze all Prime items for arbitrage opportunities
- **WTB Order Management**: Create and track WTB orders from opportunities
- **Portfolio Tracking**: Manage bought items and track sales
- **Syndicate Mod Search**: Search and price syndicate mods
- **Authentication**: Login/logout with Warframe Market credentials
- **Desktop App**: Available as a Tauri desktop application

## Development

### Prerequisites
- Node.js 18+
- Python 3.x (for backend)
- Rust (for Tauri desktop app)

### Setup
1. Install dependencies:
   ```bash
   npm install
   ```

2. Create environment file:
   ```bash
   echo "VITE_API_URL=http://localhost:8000" > .env
   ```

3. Start the backend server (from project root):
   ```bash
   python -m backend.proxy_server
   ```

### Development Commands

```bash
# Start web development server
npm run dev

# Start Tauri desktop development
npm run tauri dev

# Build for production (web)
npm run build

# Build Tauri desktop app
npm run tauri build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## Project Structure

```
src/
├── components/          # React components
├── utils/              # Utility functions
├── App.jsx             # Main app component
├── main.jsx            # App entry point
└── index.css           # Global styles

src-tauri/              # Tauri configuration
├── src/                # Rust backend code
├── Cargo.toml          # Rust dependencies
└── tauri.conf.json     # Tauri configuration

public/                 # Static assets
```

## API Integration

The frontend communicates with the Python backend proxy server for:
- Authentication (login/logout)
- Trading analysis (prime item scanning)
- Order management (WTB/WTS orders)
- Rate limit status
- Syndicate mod data

All API calls use the centralized `fetchApi` utility for consistent error handling and authentication.

## Environment Variables

- `VITE_API_URL`: Backend API URL (default: http://localhost:8000)

## Building for Production

### Web Version
```bash
npm run build
```
Outputs to `dist/` directory.

### Desktop Version
```bash
npm run tauri build
```
Outputs platform-specific executables to `src-tauri/target/release/`.

## Technologies Used

- **React 18**: UI framework
- **Vite**: Build tool and dev server
- **Tauri**: Desktop app framework
- **Rust**: Backend for desktop app
- **CSS**: Styling (no external UI libraries)

## Contributing

1. Follow the existing code style
2. Test both web and desktop versions
3. Ensure API integration works correctly
4. Update documentation as needed
