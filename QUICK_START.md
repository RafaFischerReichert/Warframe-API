# Quick Start Guide

Get up and running with Warframe Market API Tools in minutes!

## 🚀 Quick Setup

### 1. Start the Backend
```bash
# From project root
python -m backend.proxy_server
```
*Server runs on http://localhost:8000*

### 2. Start the Frontend

**Web Version:**
```bash
cd frontend-vite
npm install
echo "VITE_API_URL=http://localhost:8000" > .env
npm run dev
```
*Open http://localhost:5173*

**Desktop Version:**
```bash
cd frontend-vite
npm install
echo "VITE_API_URL=http://localhost:8000" > .env
npm run tauri dev
```

---

## 🎯 Quick Usage

### Trading Calculator
1. **Go to Trading Calculator** (click "Trading" in nav)
2. **Set your filters:**
   - Min Profit: 10 platinum
   - Max Investment: 1000 platinum  
   - Max Order Age: 3 days
3. **Click "Analyze All Prime Items"**
4. **Wait for results** (progress bar shows status)
5. **Review top opportunities** in the table
6. **Create WTB orders** by clicking "Create WTB Order" on good deals

### Order Management
1. **Pending Orders** (left panel): Track your WTB orders
2. **Click "Mark as Bought"** when you purchase items
3. **Portfolio** (right panel): Track owned items
4. **Click "Mark as Sold"** when you sell for profit

### Syndicate Search
1. **Go to Syndicate Analysis** (click "Syndicate" in nav)
2. **Enter syndicate name** (e.g., "Steel Meridian")
3. **View results** sorted by best value

---

## ⚡ Pro Tips

- **Start with small filters** (min profit: 5-10p) to see more opportunities
- **Use "Stop Analysis"** if scan takes too long
- **Check order age** - green = fresh, red = stale
- **Portfolio data is local** - will reset on page refresh
- **Rate limits apply** - be patient with large scans

---

## 🔧 Troubleshooting

**Backend won't start?**
- Check Python is installed: `python --version`
- Install requirements: `pip install -r requirements.txt`

**Frontend won't connect?**
- Verify backend is running on port 8000
- Check `.env` file has correct API URL
- Try refreshing the page

**Desktop app issues?**
- Install Rust: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- Install Tauri CLI: `cargo install tauri-cli`

---

## 📱 What You Can Do

✅ **Analyze all Prime items** for trading opportunities  
✅ **Create and track WTB orders** from opportunities  
✅ **Manage portfolio** of bought/sold items  
✅ **Search syndicate mods** by value  
✅ **Login with Warframe Market** credentials  
✅ **Use as web app or desktop app**  

---

*Need more details? See the full [README.md](README.md) for comprehensive documentation.* 