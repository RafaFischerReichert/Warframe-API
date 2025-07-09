const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3001;
const TradingCalculator = require('./tradingCalculator');
const authHandler = require('./authHandler');
const fetch = require('node-fetch');
const RateLimiter = require('./rateLimiter');

app.use(cors());
app.use(express.json());

// Initialize rate limiter (5 requests per second, 10 concurrent)
const rateLimiter = new RateLimiter(5, 10);

// Placeholder route for health check
app.get('/', (req, res) => {
  res.send('Node.js backend is running');
});

// Trading calculator endpoint
app.post('/api/trading-calc', (req, res) => {
  const { allItems, ordersData, minProfit, maxInvestment, maxOrderAge } = req.body;
  if (!allItems || !ordersData) {
    return res.status(400).json({ error: 'Missing allItems or ordersData' });
  }
  const calculator = new TradingCalculator(minProfit, maxInvestment, maxOrderAge);
  const opportunities = calculator.analyzePrimeItems(allItems, ordersData, null, maxOrderAge);
  res.json({ opportunities });
});

// Authentication endpoints
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Missing email or password' });
  }
  const result = await authHandler.login(email, password);
  res.json(result);
});

app.post('/auth/logout', (req, res) => {
  const result = authHandler.logout();
  res.json(result);
});

app.get('/auth/status', (req, res) => {
  const status = authHandler.getAuthStatus();
  res.json(status);
});

// Rate limit status endpoint
app.get('/rate-limit-status', (req, res) => {
  res.json(rateLimiter.getStatus());
});

// Proxy all requests starting with /api to Warframe Market API
app.use('/api', async (req, res, next) => {
  try {
    // Acquire rate limit slot
    await rateLimiter.acquire();
    
    const apiPath = req.url; // includes the leading /
    const apiUrl = `https://api.warframe.market/v1${apiPath}`;
    
    const headers = {
      'User-Agent': 'Warframe-Market-Proxy/1.0',
      'Accept': 'application/json',
    };
    // Add auth headers if logged in
    const authHeaders = authHandler.getAuthHeaders();
    if (authHeaders) {
      Object.assign(headers, authHeaders);
    }
    
    const apiRes = await fetch(apiUrl, { headers, method: req.method });
    
    // Check for rate limiting from API
    if (apiRes.status === 429) {
      rateLimiter.setRateLimited();
      console.log(`[RATE LIMIT] HTTP 429 detected for ${apiUrl}`);
    } else if (apiRes.status === 200) {
      rateLimiter.clearRateLimit();
    }
    
    const data = await apiRes.text();
    res.status(apiRes.status);
    res.set('Content-Type', apiRes.headers.get('content-type') || 'application/json');
    res.send(data);
  } catch (err) {
    if (err.message === 'Rate limit active, please wait') {
      res.status(429).json({ error: 'Rate limit active', message: err.message });
    } else {
      res.status(500).json({ error: 'Proxy error', details: err.message });
    }
  } finally {
    // Always release the rate limit slot
    rateLimiter.release();
  }
});

// TODO: Add trading calculator, auth, and proxy routes here

app.listen(PORT, () => {
  console.log(`Node.js backend listening on port ${PORT}`);
}); 