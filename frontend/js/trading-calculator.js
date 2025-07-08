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
let analysisAbortController = null;
let myWTBOrders = [];

// Trading workflow state
let pendingItems = [];
let boughtItems = [];
let soldItems = [];

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
    // Load trading workflow data
    loadTradingWorkflowData();
    updateTradingWorkflowUI();
    const refreshWTBOrdersBtn = document.getElementById('refreshWTBOrdersBtn');
    if (refreshWTBOrdersBtn) {
        refreshWTBOrdersBtn.addEventListener('click', async function() {
            await fetchMyWTBOrders();
            showMessage('WTB orders refreshed!', 'success');
        });
    }
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

        // If logged in, fetch user's WTB orders
        if (result.logged_in) {
            await fetchMyWTBOrders();
        } else {
            myWTBOrders = [];
        }
        const refreshWTBOrdersBtn = document.getElementById('refreshWTBOrdersBtn');
        if (refreshWTBOrdersBtn) {
            refreshWTBOrdersBtn.disabled = !result.logged_in;
        }
    } catch (error) {
        console.error('Auth status check error:', error);
    }
}

async function fetchMyWTBOrders() {
    try {
        const response = await fetch('/trading/my-wtb-orders');
        const data = await response.json();
        if (data.success && Array.isArray(data.orders)) {
            // For each WTB order, fetch the best WTS price using the same logic as analyzePrimeItemOrders
            const pendingPromises = data.orders.map(async order => {
                const urlName = order.item?.url_name || order.item?.en?.item_name?.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || order.item_id;
                let sellPrice = '-';
                let netProfit = '-';
                let expectedProfit = '-';
                let bestWTS = null;
                let quantity = order.quantity || 1;
                if (urlName) {
                    try {
                        const itemOrdersResp = await fetch(`/api/items/${urlName}/orders`);
                        if (itemOrdersResp.ok) {
                            const itemOrdersData = await itemOrdersResp.json();
                            const allOrders = itemOrdersData.payload?.orders || [];
                            // Only consider ingame, visible sell orders with quantity > 0
                            const ingameWTS = allOrders.filter(o => o.order_type === 'sell' && o.user?.status === 'ingame' && o.visible && o.quantity > 0);
                            if (ingameWTS.length > 0) {
                                bestWTS = ingameWTS.reduce((min, o) => o.platinum < min.platinum ? o : min, ingameWTS[0]);
                                sellPrice = bestWTS.platinum;
                                // Use the minimum of available quantities
                                quantity = Math.min(quantity, bestWTS.quantity);
                                if (typeof sellPrice === 'number' && typeof order.platinum === 'number') {
                                    netProfit = sellPrice - order.platinum;
                                    expectedProfit = netProfit * quantity;
                                }
                            }
                        }
                    } catch (e) {
                        // Ignore errors, leave sellPrice as '-'
                    }
                }
                return {
                    id: order.id,
                    itemName: order.item?.en?.item_name || order.item?.item_name || order.item_id || order.item?.url_name || 'Unknown',
                    itemId: order.item_id || order.item?.id || order.item?.url_name || order.id,
                    buyPrice: order.platinum,
                    sellPrice,
                    netProfit,
                    expectedProfit,
                    totalInvestment: order.platinum * quantity,
                    quantity,
                    _wtbOrder: order,
                    isMyWTB: true,
                    orderId: order.id
                };
            });
            pendingItems = await Promise.all(pendingPromises);
            saveTradingWorkflowData();
            updateTradingWorkflowUI();
        } else {
            pendingItems = [];
            saveTradingWorkflowData();
            updateTradingWorkflowUI();
        }
    } catch (error) {
        console.error('Error fetching my WTB orders:', error);
        pendingItems = [];
        saveTradingWorkflowData();
        updateTradingWorkflowUI();
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
    
    // Set up AbortController for cancellation
    analysisAbortController = new AbortController();
    const { signal } = analysisAbortController;
    
    try {
        // Step 1: Get all items from Warframe Market
        currentItem.textContent = 'Fetching all items from market...';
        progressText.textContent = 'Step 1/2: Getting item list';
        progressBar.style.width = '10%';
        
        const itemsResponse = await fetch(`${API_BASE_URL}/items`);
        if (!itemsResponse.ok) {
            throw new Error(`Failed to fetch items: ${itemsResponse.status}`);
        }
        
        const itemsData = await itemsResponse.json();
        const allItems = itemsData.payload?.items || [];
        
        // Step 2: Start backend analysis job
        currentItem.textContent = 'Analyzing trading opportunities...';
        progressText.textContent = 'Step 2/2: Analyzing';
        progressBar.style.width = '20%';
        
        // Start backend job
        const startJobResponse = await fetch('/api/trading-calc', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                all_items: allItems,
                min_profit: minProfit,
                max_investment: maxInvestment,
                max_order_age: maxOrderAge,
                batch_size: CONFIG.BATCH_SIZE,
            }),
            signal
        });
        if (!startJobResponse.ok) {
            throw new Error('Failed to start backend analysis job');
        }
        const { job_id } = await startJobResponse.json();
        if (!job_id) throw new Error('No job_id returned from backend');

        // Poll for progress/results
        let lastResultsLength = 0;
        let polling = true;
        async function pollJob() {
            if (!polling) return;
            const pollResponse = await fetch(`/api/trading-calc-progress?job_id=${encodeURIComponent(job_id)}`);
            if (!pollResponse.ok) {
                throw new Error('Failed to poll backend job');
            }
            const pollData = await pollResponse.json();
            console.log('POLL DATA:', pollData); // Debug log
            // Update progress bar and text
            const { status, progress, total, results, cancelled } = pollData;
            primeSetsAnalyzed = progress;
            progressBar.style.width = `${Math.floor((progress/total)*100)}%`;
            progressText.textContent = `Analyzed ${progress} / ${total} items`;
            currentItem.textContent = status === 'done' ? 'Analysis complete!' : `Analyzing... (${progress}/${total})`;
            // Only add new results
            if (results && results.length > lastResultsLength) {
                allOpportunities = results;
                updateTable();
                lastResultsLength = results.length;
            }
            if (status === 'done' || cancelled) {
                isAnalyzing = false;
                analyzePrimeSetsBtn.disabled = false;
                analyzePrimeSetsBtn.textContent = 'Analyze All Prime Items';
                analysisProgressDiv.style.display = 'none';
                polling = false;
                return;
            }
            if (isAnalyzing) {
                setTimeout(pollJob, 1000);
            }
        }
        pollJob();
    } catch (error) {
        isAnalyzing = false;
        analyzePrimeSetsBtn.disabled = false;
        analyzePrimeSetsBtn.textContent = 'Analyze All Prime Items';
        analysisProgressDiv.style.display = 'none';
        showMessage(error.message || 'Analysis failed', 'error');
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
    // Only show trading opportunities (not myWTBOrders)
    if (allOpportunities.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-table">
                    <h3>No Trading Opportunities Yet</h3>
                    <p>Click "Analyze All Prime Items" to find profitable trading opportunities.</p>
                </td>
            </tr>
        `;
        return;
    }
    // Sort by netProfit descending
    const sorted = [...allOpportunities].sort((a, b) => {
        if (a.netProfit === '-' || b.netProfit === '-') return 0;
        return b.netProfit - a.netProfit;
    });
    sorted.slice(0, CONFIG.MAX_OPPORTUNITIES).forEach((opp, index) => {
        const row = document.createElement('tr');
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => selectRow(row));
        // Calculate age of the highest WTB order for this set
        const now = new Date();
        const lastSeen = new Date(opp._wtbOrder?.last_update || opp._wtbOrder?.last_seen || 0);
        const daysSinceUpdate = ((now - lastSeen) / (1000 * 60 * 60 * 24));
        const orderAgeStr = isFinite(daysSinceUpdate) ? daysSinceUpdate.toFixed(1) : '?';
        let buyCellStyle = '';
        if (opp._wtbOrder) {
            const color = getAgeColor(daysSinceUpdate);
            buyCellStyle = `background: ${color}; color: #222; font-weight: bold;`;
        }
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${opp.itemName}</td>
            <td style="${buyCellStyle}">${opp.buyPrice}</td>
            <td>${opp.sellPrice ?? '-'}</td>
            <td>${orderAgeStr}</td>
            <td>${opp.netProfit ?? '-'}</td>
            <td>${opp.totalInvestment ?? '-'}</td>
            <td>
                <button class="action-btn bought" onclick="createWTBOrder(${JSON.stringify(opp).replace(/"/g, '&quot;')})" style="font-size: 0.8em; padding: 4px 8px;">Create WTB</button>
            </td>
        `;
        tbody.appendChild(row);
    });
    // Update counters - only update elements that exist
    const totalOpportunitiesElement = document.getElementById('totalOpportunities');
    if (totalOpportunitiesElement) {
        totalOpportunitiesElement.textContent = sorted.length;
    }
    const primeSetsAnalyzedElement = document.getElementById('primeSetsAnalyzed');
    if (primeSetsAnalyzedElement) {
        primeSetsAnalyzedElement.textContent = `Prime items analyzed: ${primeSetsAnalyzed}`;
    }
    // Calculate and display summary stats if we have opportunities
    if (sorted.length > 0) {
        const totalProfit = sorted.reduce((sum, opp) => sum + (opp.netProfit && opp.netProfit !== '-' ? opp.netProfit : 0), 0);
        console.log(`Found ${sorted.length} opportunities with total profit: ${totalProfit}`);
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

async function stopAnalysis() {
    isAnalyzing = false;
    if (analysisAbortController) {
        analysisAbortController.abort();
    }
    try {
        await fetch('/api/cancel-analysis', { method: 'POST' });
    } catch (e) {}
    analyzePrimeSetsBtn.disabled = false;
    analyzePrimeSetsBtn.textContent = 'Analyze All Prime Items';
    analysisProgressDiv.style.display = 'none';
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

// Trading Workflow Functions
function loadTradingWorkflowData() {
    try {
        const pendingData = localStorage.getItem(STORAGE_KEYS.PENDING_ITEMS);
        const boughtData = localStorage.getItem(STORAGE_KEYS.BOUGHT_ITEMS);
        const soldData = localStorage.getItem('warframe_trading_sold_items');
        
        pendingItems = pendingData ? JSON.parse(pendingData) : [];
        boughtItems = boughtData ? JSON.parse(boughtData) : [];
        soldItems = soldData ? JSON.parse(soldData) : [];
    } catch (error) {
        console.error('Error loading trading workflow data:', error);
        pendingItems = [];
        boughtItems = [];
        soldItems = [];
    }
}

function saveTradingWorkflowData() {
    try {
        localStorage.setItem(STORAGE_KEYS.PENDING_ITEMS, JSON.stringify(pendingItems));
        localStorage.setItem(STORAGE_KEYS.BOUGHT_ITEMS, JSON.stringify(boughtItems));
        localStorage.setItem('warframe_trading_sold_items', JSON.stringify(soldItems));
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

let profitChart = null;
let profitChartInitialized = false;

function initProfitChart() {
    const ctx = document.getElementById('profitChart').getContext('2d');
    profitChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Cumulative Profit',
                data: [],
                borderColor: '#ffd700',
                backgroundColor: 'rgba(255, 215, 0, 0.1)',
                fill: true,
                tension: 0.2,
                pointRadius: 4,
                pointBackgroundColor: '#ffd700',
                pointBorderColor: '#222',
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                title: { display: true, text: 'Portfolio Profit Over Time', color: '#ffd700', font: { size: 18 } }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Sale Time', color: '#b0b0b0' },
                    ticks: { color: '#b0b0b0', maxRotation: 45, minRotation: 0 },
                    grid: { color: '#222' }
                },
                y: {
                    title: { display: true, text: 'Cumulative Profit (plat)', color: '#b0b0b0' },
                    ticks: { color: '#b0b0b0' },
                    grid: { color: '#222' }
                }
            }
        }
    });
    profitChartInitialized = true;
}

function updateProfitChart() {
    if (!profitChartInitialized) {
        initProfitChart();
    }
    // Build cumulative profit data from soldItems
    let labels = [];
    let data = [];
    let cumulative = 0;
    // Sort soldItems by sale time (if available)
    const sorted = [...soldItems].sort((a, b) => {
        const aTime = a.soldAt ? new Date(a.soldAt).getTime() : 0;
        const bTime = b.soldAt ? new Date(b.soldAt).getTime() : 0;
        return aTime - bTime;
    });
    for (const item of sorted) {
        cumulative += item.expectedProfit || 0;
        // Use sale time or fallback to now
        let label = item.soldAt ? new Date(item.soldAt).toLocaleString() : 'Unknown';
        labels.push(label);
        data.push(cumulative);
    }
    profitChart.data.labels = labels;
    profitChart.data.datasets[0].data = data;
    profitChart.update();
}

function updateBoughtItemsUI() {
    if (!boughtItemsContainer) return;
    
    // Portfolio summary
    const totalProfit = soldItems.reduce((sum, item) => sum + (item.expectedProfit || 0), 0);
    const summaryHTML = `
        <div class="portfolio-summary" style="margin-bottom: 15px; text-align: center; color: #00d46e; font-weight: bold;">
            Total Realized Profit: <span style="color: #ffd700;">${totalProfit} plat</span>
        </div>
    `;
    
    if (boughtItems.length === 0) {
        boughtItemsContainer.innerHTML = summaryHTML + '<div class="empty-state"><p style="color: #666; text-align: center; font-style: italic;">No bought items</p></div>';
        updateProfitChart();
        return;
    }
    
    const itemsHTML = boughtItems.map(item => createBoughtItemCard(item)).join('');
    boughtItemsContainer.innerHTML = summaryHTML + itemsHTML;
    updateProfitChart();
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
            // Refresh myWTBOrders after deletion
            await fetchMyWTBOrders();
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
    // Move to sold items
    boughtItems.splice(itemIndex, 1);
    item.soldAt = new Date().toISOString();
    soldItems.push(item);
    saveTradingWorkflowData();
    updateTradingWorkflowUI();
    updateProfitChart();
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

// Initialize chart on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            if (!profitChartInitialized) initProfitChart();
            updateProfitChart();
        }, 0);
    });
} else {
    setTimeout(() => {
        if (!profitChartInitialized) initProfitChart();
        updateProfitChart();
    }, 0);
} 