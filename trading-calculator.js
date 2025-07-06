// Warframe Trading Calculator - Prime Sets Analysis
const API_BASE_URL = '/api'; // Use Python proxy server to avoid CORS issues

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

// Global state
let allOpportunities = [];
let primeSetsAnalyzed = 0;
let isAnalyzing = false;
let maxOrderAge = parseInt(maxOrderAgeSlider?.value) || 30;

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
        
        for (let i = 0; i < primeItems.length; i++) {
            if (!isAnalyzing) break; // Allow cancellation
            
            const primeItem = primeItems[i];
            const progress = 30 + (i / primeItems.length) * 70;
            progressBar.style.width = `${progress}%`;
            currentItem.textContent = `Analyzing: ${primeItem.item_name}`;
            
            try {
                // Get orders for this Prime item
                const urlName = primeItem.url_name;
                const ordersResponse = await fetch(`${API_BASE_URL}/items/${urlName}/orders`);
                if (ordersResponse.ok) {
                    const ordersData = await ordersResponse.json();
                    const orders = ordersData.payload?.orders || [];
                    if (orders.length > 0) {
                        const opportunities = analyzePrimeItemOrders(orders, primeItem.item_name, minProfit, maxInvestment);
                        if (opportunities.length > 0) {
                            allOpportunities = allOpportunities.concat(opportunities);
                            allOpportunities.sort((a, b) => b.netProfit - a.netProfit);
                            allOpportunities = allOpportunities.slice(0, 20);
                            updateTable();
                        }
                    }
                }
                primeSetsAnalyzed++;
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.error(`Error analyzing ${primeItem.item_name}:`, error);
            }
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

function analyzePrimeItemOrders(orders, itemName, minProfit, maxInvestment) {
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
                <td colspan="10" class="empty-table">
                    <h3>No Trading Opportunities Yet</h3>
                    <p>Click "Analyze All Prime Sets" to find profitable trading opportunities.</p>
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