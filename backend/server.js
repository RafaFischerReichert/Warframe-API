const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3001;
const TradingCalculator = require('./tradingCalculator');
const authHandler = require('./authHandler');
const fetch = require('node-fetch');
const RateLimiter = require('./rateLimiter');
const { v4: uuidv4 } = require('uuid');
const session = require('./session');

app.use(cors());
app.use(express.json());

// Initialize rate limiter (5 requests per second, 10 concurrent)
const rateLimiter = new RateLimiter(5, 10);

// In-memory job store for batch processing
const tradingJobs = {};
const tradingJobsLock = new Map(); // Using Map for thread-safe operations

// Placeholder route for health check
app.get('/', (req, res) => {
  res.send('Node.js backend is running');
});

// Trading calculator endpoint with batch processing
app.post('/api/trading-calc', async (req, res) => {
  const { allItems, ordersData, minProfit, maxInvestment, maxOrderAge, batchSize = 3 } = req.body;
  
  if (!allItems) {
    return res.status(400).json({ error: 'Missing allItems' });
  }

  const calculator = new TradingCalculator(minProfit, maxInvestment, maxOrderAge);
  const primeItems = allItems.filter(item => 
    (item.item_name || '').toLowerCase().includes('prime')
  );

  console.log(`[DEBUG] Found ${primeItems.length} Prime items from API. Sample: ${primeItems.slice(0, 5).map(item => item.item_name)}`);

  // Assign a unique job ID
  const jobId = uuidv4();
  tradingJobs[jobId] = {
    status: 'running',
    progress: 0,
    total: primeItems.length,
    results: [],
    cancelled: false,
  };

  // Start batch processing in background
  batchWorker(jobId, primeItems, calculator, maxOrderAge, batchSize);

  // Respond with job ID immediately
  res.json({ job_id: jobId });
});

// Progress polling endpoint
app.get('/api/trading-calc-progress', (req, res) => {
  const { job_id } = req.query;
  
  if (!job_id) {
    return res.status(400).json({ error: 'Missing job_id' });
  }

  const job = tradingJobs[job_id];
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  console.log(`[DEBUG] POLL job_id=${job_id} progress=${job.progress}/${job.total} results=${job.results.length} status=${job.status}`);

  res.json({
    status: job.status,
    progress: job.progress,
    total: job.total,
    results: job.results,
    cancelled: job.cancelled,
  });
});

// Cancel analysis endpoint
app.post('/api/cancel-analysis', (req, res) => {
  console.log('[DEBUG] trading_analysis_cancelled set to True by cancel endpoint');
  
  // Cancel all running jobs
  Object.values(tradingJobs).forEach(job => {
    job.cancelled = true;
  });

  res.json({ success: true, message: 'Analysis cancelled.' });
});

// Trading workflow endpoints
app.post('/trading/create-wtb', async (req, res) => {
  try {
    const { item_id, price, quantity = 1 } = req.body;
    
    if (!item_id || price <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Item ID and valid price are required' 
      });
    }

    // Check if user is logged in
    const authStatus = authHandler.getAuthStatus();
    if (!authStatus.loggedIn) {
      return res.status(401).json({ 
        success: false, 
        message: 'Must be logged in to create orders' 
      });
    }

    // Create WTB order via Warframe Market API
    const orderData = {
      item: item_id,
      order_type: 'buy',
      platinum: price,
      quantity: quantity,
      visible: true
    };

    console.log(`[DEBUG] Order payload: ${JSON.stringify(orderData)}`);

    // Acquire rate limit slot
    await rateLimiter.acquire();

    try {
      const apiUrl = 'https://api.warframe.market/v1/profile/orders';
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'Warframe-Market-Proxy/1.0',
      };

      // Add auth headers
      const authHeaders = authHandler.getAuthHeaders();
      if (authHeaders) {
        Object.assign(headers, authHeaders);
      }

      const apiRes = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(orderData),
      });

      const data = await apiRes.text();
      
      // Check for rate limiting from API
      if (apiRes.status === 429) {
        rateLimiter.setRateLimited();
        console.log(`[RATE LIMIT] HTTP 429 detected for ${apiUrl}`);
      } else if (apiRes.status === 200) {
        rateLimiter.clearRateLimit();
      }

      res.status(apiRes.status);
      res.set('Content-Type', apiRes.headers.get('content-type') || 'application/json');
      res.send(data);
    } finally {
      rateLimiter.release();
    }
  } catch (error) {
    console.error('[ERROR] Error in create-wtb:', error);
    res.status(500).json({ 
      success: false, 
      message: `Server error: ${error.message}` 
    });
  }
});

app.post('/trading/create-wts', async (req, res) => {
  try {
    const { item_id, price, quantity = 1 } = req.body;
    
    if (!item_id || price <= 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Item ID and valid price are required' 
      });
    }

    // Check if user is logged in
    const authStatus = authHandler.getAuthStatus();
    if (!authStatus.loggedIn) {
      return res.status(401).json({ 
        success: false, 
        message: 'Must be logged in to create orders' 
      });
    }

    // Create WTS order via Warframe Market API
    const orderData = {
      item: item_id,
      order_type: 'sell',
      platinum: price,
      quantity: quantity,
      visible: true
    };

    // Acquire rate limit slot
    await rateLimiter.acquire();

    try {
      const apiUrl = 'https://api.warframe.market/v1/profile/orders';
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'Warframe-Market-Proxy/1.0',
      };

      // Add auth headers
      const authHeaders = authHandler.getAuthHeaders();
      if (authHeaders) {
        Object.assign(headers, authHeaders);
      }

      const apiRes = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(orderData),
      });

      const data = await apiRes.text();
      
      // Check for rate limiting from API
      if (apiRes.status === 429) {
        rateLimiter.setRateLimited();
        console.log(`[RATE LIMIT] HTTP 429 detected for ${apiUrl}`);
      } else if (apiRes.status === 200) {
        rateLimiter.clearRateLimit();
      }

      res.status(apiRes.status);
      res.set('Content-Type', apiRes.headers.get('content-type') || 'application/json');
      res.send(data);
    } finally {
      rateLimiter.release();
    }
  } catch (error) {
    console.error('[ERROR] Error in create-wts:', error);
    res.status(500).json({ 
      success: false, 
      message: `Server error: ${error.message}` 
    });
  }
});

app.post('/trading/delete-order', async (req, res) => {
  try {
    const { order_id } = req.body;
    
    if (!order_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Order ID is required' 
      });
    }

    // Check if user is logged in
    const authStatus = authHandler.getAuthStatus();
    if (!authStatus.loggedIn) {
      return res.status(401).json({ 
        success: false, 
        message: 'Must be logged in to delete orders' 
      });
    }

    console.log(`[DEBUG] Received delete order data: ${JSON.stringify({ order_id })}`);

    // Acquire rate limit slot
    await rateLimiter.acquire();

    try {
      const apiUrl = `https://api.warframe.market/v1/profile/orders/${order_id}`;
      const headers = {
        'User-Agent': 'Warframe-Market-Proxy/1.0',
      };

      // Add auth headers
      const authHeaders = authHandler.getAuthHeaders();
      if (authHeaders) {
        Object.assign(headers, authHeaders);
        
        // Also add JWT as a cookie if available
        const jwtToken = authHeaders.Authorization?.replace('Bearer ', '');
        if (jwtToken) {
          headers.Cookie = `JWT=${jwtToken}`;
          console.log(`[DEBUG] Added Cookie header for delete: JWT=${jwtToken}`);
        }
      } else {
        console.log('[DEBUG] No auth headers available for DELETE request.');
      }

      console.log(`[DEBUG] DELETE request headers:`, headers);

      const apiRes = await fetch(apiUrl, {
        method: 'DELETE',
        headers,
      });

      const data = await apiRes.text();
      
      // Check for rate limiting from API
      if (apiRes.status === 429) {
        rateLimiter.setRateLimited();
        console.log(`[RATE LIMIT] HTTP 429 detected for ${apiUrl}`);
      } else if (apiRes.status === 200) {
        rateLimiter.clearRateLimit();
      }

      // Transform the response for delete endpoints
      if (apiRes.status === 200) {
        const transformedResponse = {
          success: true,
          message: 'Order deleted successfully'
        };
        console.log(`[DEBUG] Delete response transformed: ${JSON.stringify(transformedResponse)}`);
        res.json(transformedResponse);
      } else {
        res.status(apiRes.status);
        res.set('Content-Type', apiRes.headers.get('content-type') || 'application/json');
        res.send(data);
      }
    } finally {
      rateLimiter.release();
    }
  } catch (error) {
    console.error('[ERROR] Error in delete-order:', error);
    res.status(500).json({ 
      success: false, 
      message: `Server error: ${error.message}` 
    });
  }
});

// Fetch user's WTB orders
app.get('/trading/my-wtb-orders', async (req, res) => {
  try {
    // Check authentication
    const authHeaders = authHandler.getAuthHeaders();
    const authStatus = authHandler.getAuthStatus();
    
    if (!authHeaders || !authStatus.loggedIn) {
      return res.status(401).json({ 
        success: false, 
        message: 'Not logged in' 
      });
    }

    const username = authStatus.username;
    if (!username) {
      return res.status(400).json({ 
        success: false, 
        message: 'Could not determine username for profile orders' 
      });
    }

    // Acquire rate limit slot
    await rateLimiter.acquire();

    try {
      const apiUrl = `https://api.warframe.market/v1/profile/${username}/orders`;
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0',
        'platform': 'pc',
        'language': 'en',
        'Origin': 'https://warframe.market',
        'Referer': 'https://warframe.market/',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      };

      // Only send JWT in Cookie header
      const jwtToken = authHeaders.Authorization?.replace('Bearer ', '');
      if (jwtToken) {
        headers.Cookie = `JWT=${jwtToken}`;
      }

      const apiRes = await fetch(apiUrl, { headers });
      const data = await apiRes.text();
      
      // Check for rate limiting from API
      if (apiRes.status === 429) {
        rateLimiter.setRateLimited();
        console.log(`[RATE LIMIT] HTTP 429 detected for ${apiUrl}`);
      } else if (apiRes.status === 200) {
        rateLimiter.clearRateLimit();
      }

      if (apiRes.status === 200) {
        const ordersJson = JSON.parse(data);
        console.log(`[DEBUG] Raw orders_json: ${JSON.stringify(ordersJson)}`);
        const buyOrders = ordersJson.payload?.buy_orders || [];
        console.log(`[DEBUG] buy_orders: ${JSON.stringify(buyOrders.slice(0, 2))} (total: ${buyOrders.length})`);
        res.json({ success: true, orders: buyOrders });
      } else {
        res.status(apiRes.status);
        res.set('Content-Type', apiRes.headers.get('content-type') || 'application/json');
        res.send(data);
      }
    } finally {
      rateLimiter.release();
    }
  } catch (error) {
    console.error('[ERROR] Exception in handle_my_wtb_orders_endpoint:', error);
    res.status(500).json({ 
      success: false, 
      message: `Error fetching WTB orders: ${error.message}` 
    });
  }
});

// My WTB orders endpoint
app.get('/trading/my-wtb-orders', async (req, res) => {
  // Check if user is logged in
  const authStatus = authHandler.getAuthStatus();
  if (!authStatus.loggedIn || !authStatus.username) {
    return res.status(401).json({
      success: false,
      message: 'Must be logged in to view WTB orders',
      orders: []
    });
  }

  try {
    // Fetch user's orders from Warframe Market API
    const apiUrl = `https://api.warframe.market/v1/profile/${authStatus.username}/orders`;
    const headers = {
      'Accept': 'application/json',
      'User-Agent': 'Warframe-Market-Proxy/1.0',
    };
    // Add auth headers
    const authHeaders = authHandler.getAuthHeaders();
    if (authHeaders) {
      Object.assign(headers, authHeaders);
    }
    const apiRes = await fetch(apiUrl, { headers });
    const data = await apiRes.json();
    if (apiRes.status !== 200) {
      return res.status(apiRes.status).json({
        success: false,
        message: data.error?.message || 'Failed to fetch orders',
        orders: []
      });
    }
    // Filter for WTB (buy) orders
    const allOrders = data.payload?.orders || [];
    const wtbOrders = allOrders.filter(order => order.order_type === 'buy');
    res.json({
      success: true,
      orders: wtbOrders
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Server error: ${error.message}`,
      orders: []
    });
  }
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

// Authentication status endpoint
app.get('/auth/status', (req, res) => {
  try {
    const status = session.getSessionStatus();
    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Server error: ${error.message}`
    });
  }
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

// Batch processing worker function
async function batchWorker(jobId, primeItems, calculator, maxOrderAge, batchSize) {
  const ordersData = {};
  
  async function fetchItemOrders(item) {
    const itemName = String(item.item_name || '');
    const itemId = String(item.id || '');
    const urlName = String(item.url_name || '');
    
    console.log(`[DEBUG] [Job ${jobId}] Processing: ${itemName} (ID: ${itemId}, URL: ${urlName})`);
    
    if (!urlName) {
      console.log(`[DEBUG] [Job ${jobId}] Skipping ${itemName}: no url_name`);
      return { itemId, orders: [] };
    }
    
    const apiUrl = `https://api.warframe.market/v1/items/${urlName}/orders?include=item`;
    
    try {
      // Acquire rate limit slot
      await rateLimiter.acquire();
      
      try {
        const headers = {
          'User-Agent': 'Warframe-Market-Proxy/1.0',
          'Platform': 'pc',
          'accept': 'application/json',
        };
        
        const response = await fetch(apiUrl, { headers });
        const data = await response.text();
        
        // Check for rate limiting from API
        if (response.status === 429) {
          rateLimiter.setRateLimited();
          console.log(`[RATE LIMIT] HTTP 429 detected for ${apiUrl}`);
        } else if (response.status === 200) {
          rateLimiter.clearRateLimit();
        }
        
        if (response.status === 200) {
          const ordersJson = JSON.parse(data);
          const allOrders = ordersJson.payload?.orders || [];
          const ingameOrders = allOrders.filter(o => o.user?.status === 'ingame');
          console.log(`[DEBUG] [Job ${jobId}] ${itemName}: ${allOrders.length} total orders, ${ingameOrders.length} ingame orders`);
          return { itemId, orders: ingameOrders };
        } else {
          console.log(`[DEBUG] [Job ${jobId}] HTTP ${response.status} for ${itemName}: ${data.substring(0, 200)}`);
          return { itemId, orders: [] };
        }
      } finally {
        rateLimiter.release();
      }
    } catch (error) {
      console.log(`[DEBUG] [Job ${jobId}] Error fetching orders for ${itemName}: ${error.message}`);
      return { itemId, orders: [] };
    }
  }
  
  for (let batchStart = 0; batchStart < primeItems.length; batchStart += batchSize) {
    if (tradingJobs[jobId].cancelled) {
      console.log(`[DEBUG] Job ${jobId} cancelled during batch processing`);
      tradingJobs[jobId].status = 'cancelled';
      return;
    }
    
    const batch = primeItems.slice(batchStart, batchStart + batchSize);
    const batchStartTime = Date.now();
    console.log(`[DEBUG] [Job ${jobId}] Starting concurrent batch ${Math.floor(batchStart / batchSize) + 1} with ${batch.length} items`);
    
    // Process batch concurrently
    const promises = batch.map(item => fetchItemOrders(item));
    const results = await Promise.all(promises);
    
    // Collect results
    results.forEach(({ itemId, orders }) => {
      ordersData[itemId] = orders;
    });
    
    // After each batch, analyze and update job results
    const batchOpps = calculator.analyzePrimeItems(batch, ordersData, null, maxOrderAge);
    tradingJobs[jobId].results.push(...batchOpps);
    tradingJobs[jobId].progress += batch.length;
    
    const batchTime = (Date.now() - batchStartTime) / 1000;
    console.log(`[DEBUG] [Job ${jobId}] Batch ${Math.floor(batchStart / batchSize) + 1} complete in ${batchTime.toFixed(2)}s, ${tradingJobs[jobId].progress}/${tradingJobs[jobId].total} items processed`);
  }
  
  tradingJobs[jobId].status = 'done';
  console.log(`[DEBUG] Job ${jobId} Analysis complete!`);
}

app.listen(PORT, () => {
  console.log(`Node.js backend listening on port ${PORT}`);
}); 