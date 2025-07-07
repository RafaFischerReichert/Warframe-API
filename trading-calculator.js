// Warframe Trading Calculator - Prime Items Analysis with Trading Workflow
const API_BASE_URL = '/api'; // Use Python proxy server to avoid CORS issues

// ===== CONFIGURATION =====
const CONFIG = {
    BATCH_SIZE: 5,           // Change from 3 to 5 (process 5 items simultaneously)
    BATCH_DELAY: 200,        // Change from 333 to 200ms (1000ms ÷ 5 = 200ms)
    ITEM_DELAY: 200,         // Change from 333 to 200ms
    MAX_OPPORTUNITIES: 20    // Maximum number of opportunities to display
};
// ========================

// DOM elements
const minProfitInput = document.getElementById('minProfitInput');
const maxInvestmentInput = document.getElementById('maxInvestmentInput');
const analyzePrimeSetsBtn = document.getElementById('analyzePrimeSetsBtn');
const clearTableBtn = document.getElementById('clearTableBtn');
const tradingResultsDiv = document.getElementById('trading-results');
const tradingTableBody = document.getElementById('tradingTableBody');
const primeSetsAnalyzedSpan = document.getElementById('primeSetsAnalyzed');
const totalOpportunitiesSpan = document.getElementById('totalOpportunities');
const analysisProgressDiv = document.getElementById('analysis-progress');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const currentItem = document.getElementById('currentItem');
const stopAnalysisBtn = document.getElementById('stopAnalysisBtn');
const maxOrderAgeSlider = document.getElementById('maxOrderAgeSlider');
const maxOrderAgeValue = document.getElementById('maxOrderAgeValue');

// Trading workflow elements
const pendingItemsContainer = document.getElementById('pendingItemsContainer');
const boughtItemsContainer = document.getElementById('boughtItemsContainer');

// Global state
let allOpportunities = [];
let primeSetsAnalyzed = 0;
let isAnalyzing = false;
let maxOrderAge = parseInt(maxOrderAgeSlider?.value) || 30;
let rateLimitStatus = { rate_limited: false, elapsed_seconds: 0, estimated_wait: 0 };
let rateLimitCheckInterval = null;

// Trading workflow state
let pendingItems = [];
let boughtItems = [];

// Local storage keys
const STORAGE_KEYS = {
    PENDING_ITEMS: 'warframe_trading_pending_items',
    BOUGHT_ITEMS: 'warframe_trading_bought_items'
};

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    if (analyzePrimeSetsBtn) {
        analyzePrimeSetsBtn.addEventListener('click', analyzeAllPrimeSets);
    }
    if (clearTableBtn) {
        clearTableBtn.addEventListener('click', clearTable);
    }
    if (stopAnalysisBtn) {
        stopAnalysisBtn.addEventListener('click', stopAnalysis);
    }
    // Initialize empty table
    updateTable();
    if (maxOrderAgeSlider) {
        maxOrderAgeSlider.addEventListener('input', function() {
            maxOrderAge = parseInt(this.value);
            if (maxOrderAgeValue) maxOrderAgeValue.textContent = this.value;
        });
    }
    // Check authentication status on page load
    checkAuthStatus();
    // Start rate limit monitoring
    startRateLimitMonitoring();
    // Load trading workflow data
    loadTradingWorkflowData();
    updateTradingWorkflowUI();
});

// Authentication status checking
async function checkAuthStatus() {
    try {
        const response = await fetch('/auth/status', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        const result = await response.json();
        
        // Add auth status indicator to the page
        addAuthStatusIndicator(result);
    } catch (error) {
        console.error('Auth status check error:', error);
    }
}

function addAuthStatusIndicator(authStatus) {
    // Remove existing auth indicator if present
    const existingIndicator = document.getElementById('auth-indicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }
    
    // Create auth status indicator
    const authIndicator = document.createElement('div');
    authIndicator.id = 'auth-indicator';
    authIndicator.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 10px 15px;
        border-radius: 5px;
        font-size: 0.8em;
        font-weight: bold;
        z-index: 1000;
        transition: all 0.3s ease;
    `;
    
    if (authStatus.logged_in) {
        authIndicator.style.background = 'rgba(0, 255, 0, 0.2)';
        authIndicator.style.border = '1px solid #00ff00';
        authIndicator.style.color = '#00ff00';
        authIndicator.innerHTML = `
            <span>✓ Logged In</span>
            <br><small>Session: ${Math.floor(authStatus.session_age / 60)}m</small>
        `;
    } else {
        authIndicator.style.background = 'rgba(255, 0, 0, 0.2)';
        authIndicator.style.border = '1px solid #ff0000';
        authIndicator.style.color = '#ff0000';
        authIndicator.innerHTML = `
            <span>✗ Not Logged In</span>
            <br><small><a href="login.html" style="color: #ff0000;">Login</a></small>
        `;
    }
    
    document.body.appendChild(authIndicator);
}

async function analyzeAllPrimeSets() {
    if (isAnalyzing) return;
    
    const minProfit = parseInt(minProfitInput.value) || 10;
    let maxInvestment = parseInt(maxInvestmentInput.value);
    if (!maxInvestment || maxInvestment < 0) maxInvestment = 0; // 0 means no limit
    
    isAnalyzing = true;
    analyzePrimeSetsBtn.disabled = true;
    analyzePrimeSetsBtn.textContent = 'Analyzing...';
    
    // Reset state
    allOpportunities = [];
    primeSetsAnalyzed = 0;
    updateTable();
    
    // Show progress
    analysisProgressDiv.style.display = 'block';
    tradingResultsDiv.innerHTML = '';
    
    try {
        // Step 1: Get all items from Warframe Market
        currentItem.textContent = 'Fetching all items from market...';
        progressText.textContent = 'Step 1/3: Getting item list';
        progressBar.style.width = '10%';
        
        const itemsResponse = await fetch(`${API_BASE_URL}/items`);
        if (!itemsResponse.ok) {
            throw new Error(`Failed to fetch items: ${itemsResponse.status}`);
        }
        
        const itemsData = await itemsResponse.json();
        const allItems = itemsData.payload?.items || [];
        
        // Step 2: Filter for ALL Prime items (not just sets)
        currentItem.textContent = 'Filtering Prime items...';
        progressText.textContent = 'Step 2/3: Filtering Prime items';
        progressBar.style.width = '30%';
        
        const primeItems = allItems.filter(item => {
            const itemName = item.item_name?.toLowerCase() || '';
            return itemName.includes('prime');
        });
        
        console.log(`Found ${primeItems.length} Prime items to analyze`);
        
        // Step 3: Analyze each Prime item
        currentItem.textContent = 'Analyzing Prime items...';
        progressText.textContent = 'Step 3/3: Analyzing trading opportunities';
        
        // Process items in batches for parallel processing
        const batchSize = CONFIG.BATCH_SIZE; // Use the configured batch size
        for (let i = 0; i < primeItems.length; i += batchSize) {
            if (!isAnalyzing) break; // Allow cancellation
            
            const batch = primeItems.slice(i, i + batchSize);
            const batchPromises = batch.map(async (primeItem, batchIndex) => {
                const itemIndex = i + batchIndex;
                const progress = 30 + (itemIndex / primeItems.length) * 70;
                progressBar.style.width = `${progress}%`;
                currentItem.textContent = `Analyzing: ${primeItem.item_name}`;
                
                try {
                    // Get orders for this Prime item
                    const urlName = primeItem.url_name;
                    console.log(`[DEBUG] Processing item: ${primeItem.item_name}, _id: ${primeItem._id}, url_name: ${urlName}`);
                    
                    // First, get the item details to get the ObjectId
                    let itemId = primeItem.id || primeItem._id;
                    console.log(`[DEBUG] Initial itemId for ${primeItem.item_name}: ${itemId}`);
                    if (!itemId) {
                        try {
                            const itemDetailsResponse = await fetch(`${API_BASE_URL}/items/${urlName}`);
                            if (itemDetailsResponse.ok) {
                                const itemDetails = await itemDetailsResponse.json();
                                itemId = itemDetails.payload?.item?.id;
                                console.log(`[DEBUG] Fetched item details for ${primeItem.item_name}, ObjectId: ${itemId}`);
                            } else {
                                console.error(`[DEBUG] Failed to fetch item details for ${primeItem.item_name}, status: ${itemDetailsResponse.status}`);
                            }
                        } catch (error) {
                            console.error(`[DEBUG] Failed to fetch item details for ${primeItem.item_name}:`, error);
                        }
                    }
                    console.log(`[DEBUG] Final itemId for ${primeItem.item_name}: ${itemId}`);
                    
                    const ordersResponse = await fetch(`${API_BASE_URL}/items/${urlName}/orders`);
                    if (ordersResponse.ok) {
                        const ordersData = await ordersResponse.json();
                        const orders = ordersData.payload?.orders || [];
                        if (orders.length > 0) {
                            const opportunities = analyzePrimeItemOrders(orders, primeItem.item_name, itemId, minProfit, maxInvestment);
                            if (opportunities.length > 0) {
                                console.log(`[DEBUG] Created opportunities for ${primeItem.item_name} with itemId: ${itemId}`);
                                console.log(`[DEBUG] First opportunity:`, opportunities[0]);
                                return opportunities;
                            }
                        }
                    }
                    primeSetsAnalyzed++;
                } catch (error) {
                    console.error(`Error analyzing ${primeItem.item_name}:`, error);
                }
                // Small delay between individual items
                await new Promise(resolve => setTimeout(resolve, CONFIG.ITEM_DELAY));
                return [];
            });
            
            // Wait for all items in the batch to complete
            const batchResults = await Promise.all(batchPromises);
            
            // Add all opportunities from this batch
            for (const opportunities of batchResults) {
                if (opportunities.length > 0) {
                    allOpportunities = allOpportunities.concat(opportunities);
                    allOpportunities.sort((a, b) => b.netProfit - a.netProfit);
                    allOpportunities = allOpportunities.slice(0, CONFIG.MAX_OPPORTUNITIES);
                    updateTable();
                }
            }
            
            // Small delay between batches to avoid overwhelming the server
            await new Promise(resolve => setTimeout(resolve, CONFIG.BATCH_DELAY));
        }
        currentItem.textContent = 'Analysis complete!';
        progressText.textContent = `Analyzed ${primeSetsAnalyzed} Prime items, found ${allOpportunities.length} opportunities`;
        progressBar.style.width = '100%';
        setTimeout(() => {
            analysisProgressDiv.style.display = 'none';
        }, 3000);
    } catch (error) {
        console.error('Error during analysis:', error);
        currentItem.textContent = `Error: ${error.message}`;
        progressText.textContent = 'Analysis failed';
        showMessage(`Analysis failed: ${error.message}`, 'error');
    } finally {
        isAnalyzing = false;
        analyzePrimeSetsBtn.disabled = false;
        analyzePrimeSetsBtn.textContent = 'Analyze All Prime Items';
    }
}

function analyzePrimeSetOrders(orders, primeSetName, minProfit, maxInvestment) {
    const now = new Date();
    // Only consider orders from users who are strictly 'ingame'
    const ingameOrders = orders.filter(order => order.user?.status === 'ingame');
    const wtsOrders = ingameOrders.filter(order => order.order_type === 'sell' && order.quantity > 0);
    const wtbOrders = ingameOrders.filter(order => order.order_type === 'buy' && order.quantity > 0);
    if (wtsOrders.length === 0 || wtbOrders.length === 0) {
        return [];
    }
    const bestWTS = wtsOrders.reduce((min, o) => o.platinum < min.platinum ? o : min, wtsOrders[0]);
    const bestWTB = wtbOrders.reduce((max, o) => o.platinum > max.platinum ? o : max, wtbOrders[0]);
    // Check age of best WTB
    const lastSeen = new Date(bestWTB.last_update || bestWTB.last_seen || 0);
    const daysSinceUpdate = (now - lastSeen) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate > maxOrderAge) {
        return [];
    }
    const buyPrice = bestWTB.platinum + 1;
    const sellPrice = bestWTS.platinum - 1;
    const quantity = Math.min(bestWTS.quantity, bestWTB.quantity);
    let profit = sellPrice - buyPrice;
    if (profit <= 0) {
        return [];
    }
    if (maxInvestment > 0 && buyPrice > maxInvestment) {
        return [];
    }
    if (profit < minProfit) {
        return [];
    }
    const roi = (profit / buyPrice) * 100;
    return [{
        primeSetName,
        buyPrice,
        sellPrice,
        grossProfit: profit,
        taxAmount: 0,
        netProfit: profit,
        roi,
        quantity,
        totalInvestment: buyPrice * quantity,
        _wtbOrder: bestWTB // Attach for coloring
    }];
}

function analyzePrimeItemOrders(orders, itemName, itemId, minProfit, maxInvestment) {
    const now = new Date();
    // Only consider orders from users who are strictly 'ingame'
    const ingameOrders = orders.filter(order => order.user?.status === 'ingame');
    const wtsOrders = ingameOrders.filter(order => order.order_type === 'sell' && order.quantity > 0);
    const wtbOrders = ingameOrders.filter(order => order.order_type === 'buy' && order.quantity > 0);
    if (wtsOrders.length === 0 || wtbOrders.length === 0) {
        return [];
    }
    const bestWTS = wtsOrders.reduce((min, o) => o.platinum < min.platinum ? o : min, wtsOrders[0]);
    const bestWTB = wtbOrders.reduce((max, o) => o.platinum > max.platinum ? o : max, wtbOrders[0]);
    // Check age of best WTB
    const lastSeen = new Date(bestWTB.last_update || bestWTB.last_seen || 0);
    const daysSinceUpdate = (now - lastSeen) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate > maxOrderAge) {
        return [];
    }
    const buyPrice = bestWTB.platinum + 1;
    const sellPrice = bestWTS.platinum - 1;
    const quantity = Math.min(bestWTS.quantity, bestWTB.quantity);
    let profit = sellPrice - buyPrice;
    if (profit <= 0) {
        return [];
    }
    if (maxInvestment > 0 && buyPrice > maxInvestment) {
        return [];
    }
    if (profit < minProfit) {
        return [];
    }
    const roi = (profit / buyPrice) * 100;
    return [{
        itemName,
        itemId,
        buyPrice,
        sellPrice,
        grossProfit: profit,
        taxAmount: 0,
        netProfit: profit,
        roi,
        quantity,
        totalInvestment: buyPrice * quantity,
        _wtbOrder: bestWTB // Attach for coloring
    }];
}

function updateTable() {
    const tbody = document.querySelector('#tradingTableBody');
    if (!tbody) {
        console.error('Table body not found');
        return;
    }
    
    tbody.innerHTML = '';
    
    if (allOpportunities.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" class="empty-table">
                    <h3>No Trading Opportunities Yet</h3>
                    <p>Click "Analyze All Prime Items" to find profitable trading opportunities.</p>
                </td>
            </tr>
        `;
        return;
    }
    
    allOpportunities.forEach((opp, index) => {
        const row = document.createElement('tr');
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => selectRow(row));
        
        const roiClass = getROIClass(opp.roi);
        // Calculate age of the highest WTB order for this set
        const now = new Date();
        const lastSeen = new Date(opp._wtbOrder.last_update || opp._wtbOrder.last_seen || 0);
        const daysSinceUpdate = ((now - lastSeen) / (1000 * 60 * 60 * 24));
        const orderAgeStr = isFinite(daysSinceUpdate) ? daysSinceUpdate.toFixed(1) : '?';
        
        let buyCellStyle = '';
        if (opp._wtbOrder) {
            const color = getAgeColor(daysSinceUpdate);
            buyCellStyle = `background: ${color}; color: #222; font-weight: bold;`;
        }
        
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${opp.itemName || opp.primeSetName}</td>
            <td style="${buyCellStyle}">${opp.buyPrice}</td>
            <td>${opp.sellPrice}</td>
            <td>${orderAgeStr}</td>
            <td>${opp.taxAmount}</td>
            <td>${opp.netProfit}</td>
            <td class="${roiClass}">${opp.roi.toFixed(1)}%</td>
            <td>${opp.quantity}</td>
            <td>${opp.totalInvestment}</td>
            <td>
                <button class="action-btn bought" onclick="createWTBOrder(${JSON.stringify(opp).replace(/"/g, '&quot;')})" style="font-size: 0.8em; padding: 4px 8px;">
                    Create WTB
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
    
    // Update counters - only update elements that exist
    const totalOpportunitiesElement = document.getElementById('totalOpportunities');
    if (totalOpportunitiesElement) {
        totalOpportunitiesElement.textContent = allOpportunities.length;
    }
    
    const primeSetsAnalyzedElement = document.getElementById('primeSetsAnalyzed');
    if (primeSetsAnalyzedElement) {
        primeSetsAnalyzedElement.textContent = `Prime items analyzed: ${primeSetsAnalyzed}`;
    }
    
    // Calculate and display summary stats if we have opportunities
    if (allOpportunities.length > 0) {
        const totalProfit = allOpportunities.reduce((sum, opp) => sum + opp.netProfit, 0);
        const averageROI = (allOpportunities.reduce((sum, opp) => sum + opp.roi, 0) / allOpportunities.length).toFixed(1);
        
        console.log(`Found ${allOpportunities.length} opportunities with total profit: ${totalProfit}, average ROI: ${averageROI}%`);
    }
}

function getROIClass(roi) {
    if (roi >= 50) return 'roi-high';
    if (roi >= 25) return 'roi-medium';
    return 'roi-low';
}

function getAgeColor(days) {
    // 0 days: green (#00d46e), maxOrderAge days: red (#ff6b6b)
    if (days <= 0) return '#00d46e';
    if (days >= maxOrderAge) return '#ff6b6b';
    // Interpolate green to red
    return interpolateColor([0, 212, 110], [255, 107, 107], days / maxOrderAge);
}

function interpolateColor(rgb1, rgb2, t) {
    // t in [0,1]
    const r = Math.round(rgb1[0] + (rgb2[0] - rgb1[0]) * t);
    const g = Math.round(rgb1[1] + (rgb2[1] - rgb1[1]) * t);
    const b = Math.round(rgb1[2] + (rgb2[2] - rgb1[2]) * t);
    return `rgb(${r},${g},${b})`;
}

function clearTable() {
    allOpportunities = [];
    primeSetsAnalyzed = 0;
    updateTable();
    analysisProgressDiv.style.display = 'none';
    showMessage('Table cleared successfully', 'success');
}

function showMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
        text-align: center;
        padding: 15px;
        margin: 10px 0;
        border-radius: 8px;
        font-weight: 600;
        background: ${type === 'error' ? 'rgba(255, 107, 107, 0.1)' : 
                     type === 'warning' ? 'rgba(255, 215, 0, 0.1)' : 
                     'rgba(0, 212, 255, 0.1)'};
        border: 1px solid ${type === 'error' ? 'rgba(255, 107, 107, 0.3)' : 
                           type === 'warning' ? 'rgba(255, 215, 0, 0.3)' : 
                           'rgba(0, 212, 255, 0.3)'};
        color: ${type === 'error' ? '#ff6b6b' : 
                type === 'warning' ? '#ffd700' : 
                '#00d4ff'};
    `;
    messageDiv.textContent = message;
    
    tradingResultsDiv.appendChild(messageDiv);
    
    // Remove after 5 seconds
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 5000);
}

function stopAnalysis() {
    isAnalyzing = false;
    currentItem.textContent = 'Analysis stopped by user';
    progressText.textContent = `Analysis stopped. Analyzed ${primeSetsAnalyzed} Prime items, found ${allOpportunities.length} opportunities`;
    
    // Re-enable the analyze button
    analyzePrimeSetsBtn.disabled = false;
    analyzePrimeSetsBtn.textContent = 'Analyze All Prime Items';
    
    // Hide progress after 3 seconds
    setTimeout(() => {
        analysisProgressDiv.style.display = 'none';
    }, 3000);
    
    showMessage('Analysis stopped by user', 'warning');
}

function selectRow(clickedRow) {
    // Remove selection from all rows
    document.querySelectorAll('#opportunities-table tbody tr').forEach(row => {
        row.classList.remove('selected');
        row.style.background = '';
    });
    
    // Add selection to clicked row
    clickedRow.classList.add('selected');
    clickedRow.style.background = 'rgba(0, 212, 255, 0.2)';
}

// Rate limit monitoring
async function checkRateLimitStatus() {
    try {
        const response = await fetch('/rate-limit-status', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('[RATE LIMIT] Status check result:', result);
            rateLimitStatus = result;
            updateRateLimitDisplay();
        }
    } catch (error) {
        console.error('Rate limit status check error:', error);
    }
}

function startRateLimitMonitoring() {
    console.log('[RATE LIMIT] Starting rate limit monitoring');
    // Check rate limit status every 2 seconds
    rateLimitCheckInterval = setInterval(checkRateLimitStatus, 2000);
    // Initial check
    checkRateLimitStatus();
}

function stopRateLimitMonitoring() {
    if (rateLimitCheckInterval) {
        clearInterval(rateLimitCheckInterval);
        rateLimitCheckInterval = null;
    }
}

function updateRateLimitDisplay() {
    console.log('[RATE LIMIT] Updating display, status:', rateLimitStatus);
    
    // Remove existing rate limit indicator if present
    const existingIndicator = document.getElementById('rate-limit-indicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }
    
    if (rateLimitStatus.rate_limited) {
        console.log('[RATE LIMIT] Creating rate limit indicator');
        // Create rate limit indicator
        const rateLimitIndicator = document.createElement('div');
        rateLimitIndicator.id = 'rate-limit-indicator';
        rateLimitIndicator.style.cssText = `
            position: fixed;
            top: 60px;
            right: 20px;
            padding: 15px;
            border-radius: 8px;
            font-size: 0.9em;
            font-weight: bold;
            z-index: 1000;
            background: rgba(255, 165, 0, 0.9);
            border: 2px solid #ff6600;
            color: #fff;
            text-align: center;
            box-shadow: 0 4px 12px rgba(255, 165, 0, 0.3);
            animation: pulse 2s infinite;
        `;
        
        const waitTime = Math.ceil(rateLimitStatus.estimated_wait);
        rateLimitIndicator.innerHTML = `
            <div style="font-size: 1.1em; margin-bottom: 5px;">⚠️ Rate Limited</div>
            <div style="font-size: 0.8em;">Wait: ${waitTime}s</div>
            <div style="font-size: 0.7em; margin-top: 5px;">API requests paused</div>
        `;
        
        document.body.appendChild(rateLimitIndicator);
        
        // Disable analyze button if rate limited
        if (analyzePrimeSetsBtn) {
            analyzePrimeSetsBtn.disabled = true;
            analyzePrimeSetsBtn.textContent = 'Rate Limited - Please Wait';
            analyzePrimeSetsBtn.style.background = 'rgba(255, 165, 0, 0.7)';
        }
    } else {
        console.log('[RATE LIMIT] Clearing rate limit indicator');
        // Re-enable analyze button if not rate limited
        if (analyzePrimeSetsBtn && !isAnalyzing) {
            analyzePrimeSetsBtn.disabled = false;
            analyzePrimeSetsBtn.textContent = 'Analyze All Prime Items';
            analyzePrimeSetsBtn.style.background = '';
        }
    }
}

// Trading Workflow Functions
function loadTradingWorkflowData() {
    try {
        const pendingData = localStorage.getItem(STORAGE_KEYS.PENDING_ITEMS);
        const boughtData = localStorage.getItem(STORAGE_KEYS.BOUGHT_ITEMS);
        
        pendingItems = pendingData ? JSON.parse(pendingData) : [];
        boughtItems = boughtData ? JSON.parse(boughtData) : [];
    } catch (error) {
        console.error('Error loading trading workflow data:', error);
        pendingItems = [];
        boughtItems = [];
    }
}

function saveTradingWorkflowData() {
    try {
        localStorage.setItem(STORAGE_KEYS.PENDING_ITEMS, JSON.stringify(pendingItems));
        localStorage.setItem(STORAGE_KEYS.BOUGHT_ITEMS, JSON.stringify(boughtItems));
    } catch (error) {
        console.error('Error saving trading workflow data:', error);
    }
}

function updateTradingWorkflowUI() {
    updatePendingItemsUI();
    updateBoughtItemsUI();
}

function updatePendingItemsUI() {
    if (!pendingItemsContainer) return;
    
    if (pendingItems.length === 0) {
        pendingItemsContainer.innerHTML = '<div class="empty-state"><p style="color: #666; text-align: center; font-style: italic;">No pending orders</p></div>';
        return;
    }
    
    const itemsHTML = pendingItems.map(item => createPendingItemCard(item)).join('');
    pendingItemsContainer.innerHTML = itemsHTML;
}

function updateBoughtItemsUI() {
    if (!boughtItemsContainer) return;
    
    if (boughtItems.length === 0) {
        boughtItemsContainer.innerHTML = '<div class="empty-state"><p style="color: #666; text-align: center; font-style: italic;">No bought items</p></div>';
        return;
    }
    
    const itemsHTML = boughtItems.map(item => createBoughtItemCard(item)).join('');
    boughtItemsContainer.innerHTML = itemsHTML;
}

function createPendingItemCard(item) {
    return `
        <div class="trading-item-card pending" data-item-id="${item.id}">
            <div class="item-card-header">
                <div class="item-name">${item.itemName}</div>
                <div class="item-status pending">Pending</div>
            </div>
            <div class="item-details">
                <div class="detail-row">
                    <span class="detail-label">Buy Price:</span>
                    <span class="detail-value">${item.buyPrice} plat</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Sell Price:</span>
                    <span class="detail-value">${item.sellPrice} plat</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Quantity:</span>
                    <span class="detail-value">${item.quantity}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Expected Profit:</span>
                    <span class="detail-value">${item.expectedProfit} plat</span>
                </div>
            </div>
            <div class="item-actions">
                <button class="action-btn bought" onclick="markAsBought('${item.id}')">Bought</button>
                <button class="action-btn delete" onclick="removePendingItem('${item.id}')">Delete</button>
            </div>
        </div>
    `;
}

function createBoughtItemCard(item) {
    return `
        <div class="trading-item-card bought" data-item-id="${item.id}">
            <div class="item-card-header">
                <div class="item-name">${item.itemName}</div>
                <div class="item-status bought">Bought</div>
            </div>
            <div class="item-details">
                <div class="detail-row">
                    <span class="detail-label">Buy Price:</span>
                    <span class="detail-value">${item.buyPrice} plat</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Sell Price:</span>
                    <span class="detail-value">${item.sellPrice} plat</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Quantity:</span>
                    <span class="detail-value">${item.quantity}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Expected Profit:</span>
                    <span class="detail-value">${item.expectedProfit} plat</span>
                </div>
            </div>
            <div class="item-actions">
                <button class="action-btn sold" onclick="markAsSold('${item.id}')">Sold</button>
                <button class="action-btn delete" onclick="removeBoughtItem('${item.id}')">Delete</button>
            </div>
        </div>
    `;
}

async function createWTBOrder(opportunity) {
    try {
        console.log(`[DEBUG] Creating WTB order for opportunity:`, opportunity);
        
        // Get the proper ObjectId for this item
        let itemId = opportunity.itemId;
        if (!itemId || itemId === opportunity.itemName) {
            console.log(`[DEBUG] Need to fetch ObjectId for: ${opportunity.itemName}`);
            try {
                const urlName = opportunity.itemName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                const itemDetailsResponse = await fetch(`${API_BASE_URL}/items/${urlName}`);
                if (itemDetailsResponse.ok) {
                    const itemDetails = await itemDetailsResponse.json();
                    itemId = itemDetails.payload?.item?.id;
                    console.log(`[DEBUG] Fetched ObjectId for ${opportunity.itemName}: ${itemId}`);
                } else {
                    console.error(`[DEBUG] Failed to fetch item details for ${opportunity.itemName}, status: ${itemDetailsResponse.status}`);
                }
            } catch (error) {
                console.error(`[DEBUG] Error fetching ObjectId for ${opportunity.itemName}:`, error);
            }
        }
        
        const requestBody = {
            item_id: itemId,
            price: opportunity.buyPrice,
            quantity: opportunity.quantity
        };
        console.log(`[DEBUG] Request body:`, requestBody);
        
        const response = await fetch('/trading/create-wtb', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Add to pending items
            const pendingItem = {
                id: generateItemId(),
                itemName: opportunity.itemName,
                buyPrice: opportunity.buyPrice,
                sellPrice: opportunity.sellPrice,
                quantity: opportunity.quantity,
                expectedProfit: opportunity.netProfit,
                orderId: result.order_id || null,
                createdAt: new Date().toISOString()
            };
            
            pendingItems.push(pendingItem);
            saveTradingWorkflowData();
            updateTradingWorkflowUI();
            
            showMessage(`WTB order created for ${opportunity.itemName} at ${opportunity.buyPrice} plat`, 'success');
        } else {
            showMessage(`Failed to create WTB order: ${result.message}`, 'error');
        }
    } catch (error) {
        console.error('Error creating WTB order:', error);
        showMessage('Error creating WTB order. Please try again.', 'error');
    }
}

async function createWTSOrder(item) {
    try {
        // Get the proper ObjectId for this item
        let itemId = item.itemId;
        if (!itemId || itemId === item.itemName) {
            console.log(`[DEBUG] Need to fetch ObjectId for WTS: ${item.itemName}`);
            try {
                const urlName = item.itemName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                const itemDetailsResponse = await fetch(`${API_BASE_URL}/items/${urlName}`);
                if (itemDetailsResponse.ok) {
                    const itemDetails = await itemDetailsResponse.json();
                    itemId = itemDetails.payload?.item?.id;
                    console.log(`[DEBUG] Fetched ObjectId for WTS ${item.itemName}: ${itemId}`);
                } else {
                    console.error(`[DEBUG] Failed to fetch item details for WTS ${item.itemName}, status: ${itemDetailsResponse.status}`);
                }
            } catch (error) {
                console.error(`[DEBUG] Error fetching ObjectId for WTS ${item.itemName}:`, error);
            }
        }
        
        const response = await fetch('/trading/create-wts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                item_id: itemId,
                price: item.sellPrice,
                quantity: item.quantity
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Update item with WTS order ID
            item.wtsOrderId = result.order_id || null;
            saveTradingWorkflowData();
            updateTradingWorkflowUI();
            
            showMessage(`WTS order created for ${item.itemName} at ${item.sellPrice} plat`, 'success');
        } else {
            showMessage(`Failed to create WTS order: ${result.message}`, 'error');
        }
    } catch (error) {
        console.error('Error creating WTS order:', error);
        showMessage('Error creating WTS order. Please try again.', 'error');
    }
}

async function deleteOrder(orderId) {
    if (!orderId) return;
    
    try {
        const response = await fetch('/trading/delete-order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                order_id: orderId
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage('Order deleted successfully', 'success');
        } else {
            showMessage(`Failed to delete order: ${result.message}`, 'error');
        }
    } catch (error) {
        console.error('Error deleting order:', error);
        showMessage('Error deleting order. Please try again.', 'error');
    }
}

async function markAsBought(itemId) {
    const itemIndex = pendingItems.findIndex(item => item.id === itemId);
    if (itemIndex === -1) return;
    
    const item = pendingItems[itemIndex];
    
    // Delete WTB order if it exists
    if (item.orderId) {
        await deleteOrder(item.orderId);
    }
    
    // Move to bought items
    pendingItems.splice(itemIndex, 1);
    boughtItems.push(item);
    
    saveTradingWorkflowData();
    updateTradingWorkflowUI();
    
    // Automatically create WTS order
    await createWTSOrder(item);
    
    showMessage(`${item.itemName} marked as bought and WTS order created`, 'success');
}

function markAsSold(itemId) {
    const itemIndex = boughtItems.findIndex(item => item.id === itemId);
    if (itemIndex === -1) return;
    
    const item = boughtItems[itemIndex];
    
    // Delete WTS order if it exists
    if (item.wtsOrderId) {
        deleteOrder(item.wtsOrderId);
    }
    
    // Remove from bought items
    boughtItems.splice(itemIndex, 1);
    
    saveTradingWorkflowData();
    updateTradingWorkflowUI();
    
    showMessage(`${item.itemName} marked as sold`, 'success');
}

function removePendingItem(itemId) {
    const itemIndex = pendingItems.findIndex(item => item.id === itemId);
    if (itemIndex === -1) return;
    
    const item = pendingItems[itemIndex];
    
    // Delete WTB order if it exists
    if (item.orderId) {
        deleteOrder(item.orderId);
    }
    
    pendingItems.splice(itemIndex, 1);
    saveTradingWorkflowData();
    updateTradingWorkflowUI();
    
    showMessage(`${item.itemName} removed from pending items`, 'success');
}

function removeBoughtItem(itemId) {
    const itemIndex = boughtItems.findIndex(item => item.id === itemId);
    if (itemIndex === -1) return;
    
    const item = boughtItems[itemIndex];
    
    // Delete WTS order if it exists
    if (item.wtsOrderId) {
        deleteOrder(item.wtsOrderId);
    }
    
    boughtItems.splice(itemIndex, 1);
    saveTradingWorkflowData();
    updateTradingWorkflowUI();
    
    showMessage(`${item.itemName} removed from bought items`, 'success');
}

function generateItemId() {
    return 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
} 