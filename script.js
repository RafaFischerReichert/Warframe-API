// Warframe Market API integration for Syndicate Mod Search
const API_BASE_URL = '/api'; // Use proxy server to avoid CORS issues

// DOM elements
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const resultsDiv = document.getElementById('results');
const timeRangeSlider = document.getElementById('timeRangeSlider');
const timeRangeDisplay = document.getElementById('timeRangeDisplay');
const rankSwitch = document.getElementById('rankSwitch');
const rankDescription = document.getElementById('rankDescription');

// Global variable to store syndicate data
let SYNDICATES = {};

// Load syndicate data from JSON file
async function loadSyndicateData() {
    try {
        const response = await fetch('syndicate_items.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        SYNDICATES = await response.json();
        console.log('Syndicate data loaded successfully:', Object.keys(SYNDICATES));
    } catch (error) {
        console.error('Error loading syndicate data:', error);
        resultsDiv.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #ff6b6b;">
                <h3>Error Loading Syndicate Data</h3>
                <p>Failed to load syndicate_items.json file.</p>
                <p><strong>Error:</strong> ${error.message}</p>
                <p>Please make sure the syndicate_items.json file exists and is accessible.</p>
            </div>
        `;
    }
}

// Update time range display
function updateTimeRangeDisplay() {
    const days = parseInt(timeRangeSlider.value);
    let displayText;
    
    if (days === 1) {
        displayText = 'Last 1 day';
    } else if (days === 7) {
        displayText = 'Last 7 days';
    } else if (days === 30) {
        displayText = 'Last 30 days';
    } else if (days === 90) {
        displayText = 'Last 90 days';
    } else {
        displayText = `Last ${days} days`;
    }
    
    timeRangeDisplay.textContent = displayText;
}

// Get the cutoff date based on selected time range
function getCutoffDate() {
    const days = parseInt(timeRangeSlider.value);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    return cutoffDate;
}

// Event listeners
searchBtn.addEventListener('click', searchSyndicateMods);
searchInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        searchSyndicateMods();
    }
});

// Time range slider event listener
timeRangeSlider.addEventListener('input', function() {
    updateTimeRangeDisplay();
    updatePresetButtons();
});

// Rank switch event listener
rankSwitch.addEventListener('change', updateRankDescription);

// Time range preset buttons event listeners
document.addEventListener('DOMContentLoaded', function() {
    const presetButtons = document.querySelectorAll('.time-preset-btn');
    presetButtons.forEach(button => {
        button.addEventListener('click', function() {
            const days = parseInt(this.dataset.days);
            timeRangeSlider.value = days;
            updateTimeRangeDisplay();
            updatePresetButtons();
        });
    });
});

// Update preset button active states
function updatePresetButtons() {
    const currentDays = parseInt(timeRangeSlider.value);
    const presetButtons = document.querySelectorAll('.time-preset-btn');
    
    presetButtons.forEach(button => {
        const buttonDays = parseInt(button.dataset.days);
        if (buttonDays === currentDays) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
}

// Update rank description
function updateRankDescription() {
    const isRank3 = rankSwitch.checked;
    if (isRank3) {
        rankDescription.textContent = 'Searching for Rank 3 mods (max rank)';
        rankDescription.style.color = '#ff6b6b';
    } else {
        rankDescription.textContent = 'Searching for Rank 0 mods (unranked)';
        rankDescription.style.color = '#00d4ff';
    }
}

// Get selected rank type
function getSelectedRank() {
    return rankSwitch.checked ? 'rank3' : 'rank0';
}

// Initialize the application by loading syndicate data
document.addEventListener('DOMContentLoaded', async function() {
    await loadSyndicateData();
    updateTimeRangeDisplay(); // Initialize the display
    updatePresetButtons(); // Initialize preset button states
    updateRankDescription(); // Initialize rank description
});

// Main search function
async function searchSyndicateMods() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    
    if (!searchTerm) {
        resultsDiv.innerHTML = '<p style="color: #ff6b6b; text-align: center;">Please enter a syndicate name</p>';
        return;
    }

    // Check if syndicate data is loaded
    if (Object.keys(SYNDICATES).length === 0) {
        resultsDiv.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #ff6b6b;">
                <h3>Loading Syndicate Data</h3>
                <p>Please wait while syndicate data is being loaded...</p>
            </div>
        `;
        await loadSyndicateData();
    }

    // Find matching syndicate
    const syndicate = Object.entries(SYNDICATES).find(([key, data]) => 
        data.keywords.some(keyword => searchTerm.includes(keyword))
    );

    if (!syndicate) {
        resultsDiv.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #ff6b6b;">
                <h3>Syndicate Not Found</h3>
                <p>Available syndicates:</p>
                <ul style="text-align: left; max-width: 400px; margin: 10px auto; color: #b0b0b0;">
                    ${Object.values(SYNDICATES).map(s => `<li>${s.name}</li>`).join('')}
                </ul>
            </div>
        `;
        return;
    }

    const [syndicateKey, syndicateData] = syndicate;
    console.log('Found syndicate:', syndicateData.name, 'Key:', syndicateKey);

    try {
        // Show progress bar loading state
        const totalItems = syndicateData.items.length;
        let completedItems = 0;
        
        const selectedRank = getSelectedRank();
        const rankText = selectedRank === 'rank0' ? 'Rank 0' : 'Rank 3';
        
        resultsDiv.innerHTML = `
            <div class="progress-container">
                <h3 style="color: ${syndicateData.color}; margin-bottom: 15px;">Searching for ${syndicateData.name} mods...</h3>
                <p style="color: #00d4ff; font-size: 0.9rem; margin-bottom: 10px;">Time range: ${timeRangeDisplay.textContent}</p>
                <p style="color: ${selectedRank === 'rank0' ? '#00d4ff' : '#ff6b6b'}; font-size: 0.9rem; margin-bottom: 10px;">Rank: ${rankText}</p>
                <div class="progress-bar-container">
                    <div id="progressBar" class="progress-bar" style="width: 0%; background: linear-gradient(90deg, ${syndicateData.color}, #00d4ff);"></div>
                </div>
                <p id="progressText" class="progress-text">0 / ${totalItems} items processed</p>
                <p id="currentItem" class="current-item">Starting...</p>
            </div>
        `;
        
        console.log(`Searching for ${syndicateData.items.length} items from ${syndicateData.name}`);
        
        // Get the cutoff date based on selected time range
        const cutoffDate = getCutoffDate();
        console.log(`Filtering orders from: ${cutoffDate.toDateString()}`);
        
        // Get price data for each predefined item (both rank 0 and max rank)
        const itemsWithPrices = [];
        
        for (let i = 0; i < syndicateData.items.length; i++) {
            const item = syndicateData.items[i];
            
            try {
                // Update progress at the start of each item
                completedItems++;
                const progressPercent = (completedItems / totalItems) * 100;
                const progressBar = document.getElementById('progressBar');
                const progressText = document.getElementById('progressText');
                const currentItem = document.getElementById('currentItem');
                
                if (progressBar && progressText && currentItem) {
                    progressBar.style.width = `${progressPercent}%`;
                    progressText.textContent = `${completedItems} / ${totalItems} items processed`;
                    currentItem.textContent = `Processing: ${item.name}`;
                }
                
                // Convert item name to URL format (lowercase, replace spaces with underscores)
                const urlName = item.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                console.log('Fetching prices for:', item.name, 'URL:', urlName);
                
                let rank0Response, maxRankResponse;
                
                // Get selected rank type
                const selectedRank = getSelectedRank();
                
                // Only fetch rank variations for mods
                if (item.type === 'mod') {
                    if (selectedRank === 'rank0') {
                        // Fetch only rank 0 orders for mods
                        rank0Response = await fetch(`${API_BASE_URL}/items/${urlName}/orders`);
                        maxRankResponse = null;
                        console.log('Price response status for', item.name, 'Rank 0:', rank0Response.status);
                    } else {
                        // Fetch only rank 3 orders for mods
                        rank0Response = null;
                        maxRankResponse = await fetch(`${API_BASE_URL}/items/${urlName}_max/orders`);
                        console.log('Price response status for', item.name, 'Rank 3:', maxRankResponse.status);
                    }
                } else {
                    // For non-mod items, always fetch the base item regardless of rank selection
                    rank0Response = await fetch(`${API_BASE_URL}/items/${urlName}/orders`);
                    maxRankResponse = null;
                    console.log('Price response status for', item.name, 'Base item:', rank0Response.status);
                }
                    
                    // Process rank 0 orders (only if we fetched them)
                    let rank0Price = null;
                    let rank0OrderCount = 0;
                    if (rank0Response && rank0Response.ok) {
                        const priceContentType = rank0Response.headers.get('content-type');
                        if (priceContentType && priceContentType.includes('application/json')) {
                            const priceData = await rank0Response.json();
                            const recentSellOrders = priceData.payload.orders.filter(order => {
                                if (order.order_type !== 'sell' || !order.visible) return false;
                                const updateDate = new Date(order.last_update);
                                return updateDate >= cutoffDate;
                            });
                            
                            if (recentSellOrders.length > 0) {
                                rank0Price = Math.min(...recentSellOrders.map(order => order.platinum));
                                rank0OrderCount = recentSellOrders.length;
                                console.log(`${item.name} (Rank 0): ${rank0Price} platinum (${rank0OrderCount} recent orders)`);
                                console.log('Rank 0 orders:', recentSellOrders.slice(0, 3).map(o => ({ platinum: o.platinum, last_update: o.last_update })));
                            } else {
                                console.log(`${item.name} (Rank 0): No recent sell orders found`);
                            }
                        }
                    }
                    
                    // Process max rank orders (only if we fetched them)
                    let maxRankPrice = null;
                    let maxRankOrderCount = 0;
                    if (maxRankResponse && maxRankResponse.ok) {
                        const priceContentType = maxRankResponse.headers.get('content-type');
                        if (priceContentType && priceContentType.includes('application/json')) {
                            const priceData = await maxRankResponse.json();
                            const recentSellOrders = priceData.payload.orders.filter(order => {
                                if (order.order_type !== 'sell' || !order.visible) return false;
                                const updateDate = new Date(order.last_update);
                                return updateDate >= cutoffDate;
                            });
                            
                            if (recentSellOrders.length > 0) {
                                maxRankPrice = Math.min(...recentSellOrders.map(order => order.platinum));
                                maxRankOrderCount = recentSellOrders.length;
                                console.log(`${item.name} (Max Rank): ${maxRankPrice} platinum (${maxRankOrderCount} recent orders)`);
                                console.log('Max Rank orders:', recentSellOrders.slice(0, 3).map(o => ({ platinum: o.platinum, last_update: o.last_update })));
                            } else {
                                console.log(`${item.name} (Max Rank): No recent sell orders found`);
                            }
                        }
                    }
                    
                    itemsWithPrices.push({
                        item_name: item.name,
                        item_type: item.type,
                        standing_cost: item.standing_cost,
                        rank0Price,
                        rank0OrderCount,
                        maxRankPrice,
                        maxRankOrderCount
                    });
                    
                } catch (error) {
                    console.error(`Error fetching prices for ${item.name}:`, error);
                    itemsWithPrices.push({ 
                        item_name: item.name,
                        item_type: item.type,
                        standing_cost: item.standing_cost,
                        rank0Price: null, 
                        rank0OrderCount: 0,
                        maxRankPrice: null,
                        maxRankOrderCount: 0
                    });
                }
            }

        // Calculate value ratios and sort by best value (standing cost / market price)
        const itemsWithRatios = itemsWithPrices
            .filter(item => {
                // Filter out items with no available orders (null prices)
                const selectedRank = getSelectedRank();
                if (selectedRank === 'rank0') {
                    return item.rank0Price !== null && item.rank0Price > 0;
                } else {
                    return item.maxRankPrice !== null && item.maxRankPrice > 0;
                }
            })
            .map(item => {
                const selectedRank = getSelectedRank();
                let bestRatio, bestPrice, orderCount;
                
                if (selectedRank === 'rank0') {
                    bestRatio = item.rank0Price ? (item.standing_cost / item.rank0Price) : 0;
                    bestPrice = item.rank0Price;
                    orderCount = item.rank0OrderCount;
                } else {
                    bestRatio = item.maxRankPrice ? (item.standing_cost / item.maxRankPrice) : 0;
                    bestPrice = item.maxRankPrice;
                    orderCount = item.maxRankOrderCount;
                }
                
                return {
                    ...item,
                    bestRatio: bestRatio,
                    bestPrice: bestPrice,
                    orderCount: orderCount
                };
            })
            .sort((a, b) => a.bestRatio - b.bestRatio); // Sort by lowest ratio (best value)

        displaySyndicateResults(itemsWithRatios, syndicateData);

    } catch (error) {
        console.error('Search error:', error);
        
        let errorMessage = `An error occurred while searching: ${error.message}`;
        
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            errorMessage = `
                <div style="text-align: center; padding: 20px; color: #ff6b6b;">
                    <h3>Network Error</h3>
                    <p>Unable to connect to the Warframe Market API.</p>
                    <p><strong>Error details:</strong> ${error.message}</p>
                    <p><strong>Possible solutions:</strong></p>
                    <ul style="text-align: left; max-width: 400px; margin: 10px auto;">
                        <li>Make sure you're running this through a web server (not opening the file directly)</li>
                        <li>Check your internet connection</li>
                        <li>The API might be temporarily unavailable</li>
                    </ul>
                    <p style="margin-top: 15px; font-size: 0.9em;">
                        <strong>Tip:</strong> Access this app at <code>http://localhost:8000</code> instead of opening the HTML file directly.
                    </p>
                </div>
            `;
        } else if (error.message.includes('HTTP error')) {
            errorMessage = `
                <div style="text-align: center; padding: 20px; color: #ff6b6b;">
                    <h3>API Error</h3>
                    <p><strong>Error:</strong> ${error.message}</p>
                    <p>This might be a temporary issue with the Warframe Market API.</p>
                    <p>Please try again in a few moments.</p>
                </div>
            `;
        } else {
            errorMessage = `
                <div style="text-align: center; padding: 20px; color: #ff6b6b;">
                    <h3>Unexpected Error</h3>
                    <p><strong>Error:</strong> ${error.message}</p>
                    <p><strong>Error type:</strong> ${error.name}</p>
                    <p>Please check the browser console for more details.</p>
                </div>
            `;
        }
        
        resultsDiv.innerHTML = errorMessage;
    }
}

// Display syndicate item results sorted by value ratio
function displaySyndicateResults(itemsWithRatios, syndicateData) {
    if (itemsWithRatios.length === 0) {
        resultsDiv.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #888;">
                <h3>No ${syndicateData.name} Items Found</h3>
                <p>No items with recent sellers were found for this syndicate.</p>
            </div>
        `;
        return;
    }

    const selectedRank = getSelectedRank();
    const rankText = selectedRank === 'rank0' ? 'Rank 0' : 'Rank 3';
    const rankColor = selectedRank === 'rank0' ? '#00d4ff' : '#ff6b6b';
    
    const html = `
        <div style="margin-bottom: 20px; text-align: center;">
            <h3 style="color: ${syndicateData.color};">${syndicateData.name} Items</h3>
            <p style="color: #b0b0b0;">Found ${itemsWithRatios.length} items with recent sellers</p>
            <p style="color: #b0b0b0; font-size: 0.9rem;">Sorted by best value ratio (Standing Cost / Market Price - lower is better)</p>
            <p style="color: #00d4ff; font-size: 0.9rem; margin-top: 5px;">Time range: ${timeRangeDisplay.textContent}</p>
            <p style="color: ${rankColor}; font-size: 0.9rem; margin-top: 5px;">Rank: ${rankText}</p>
        </div>
        
        <div style="margin-bottom: 30px;">
            <h4 style="color: #ffd700; margin-bottom: 15px;">Best Value Items (Sorted by Efficiency Ratio)</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)); gap: 15px;">
                ${itemsWithRatios.map((item, index) => {
                    const selectedRank = getSelectedRank();
                    const isMod = item.item_type === 'mod';
                    const rankType = selectedRank === 'rank0' ? (isMod ? 'Rank 0' : 'Base Item') : 'Rank 3';
                    const priceColor = selectedRank === 'rank0' ? (isMod ? '#00ff88' : '#4ecdc4') : '#ff6b6b';
                    
                    return `
                        <div style="border: 1px solid rgba(255, 215, 0, 0.3); padding: 15px; border-radius: 8px; background: rgba(255, 215, 0, 0.05); transition: all 0.3s ease;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 5px 15px rgba(255, 215, 0, 0.2)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                                <h3 style="color: ${syndicateData.color}; font-size: 1.1rem; margin: 0;">${item.item_name}</h3>
                                <span style="background: ${index < 3 ? '#ffd700' : '#666'}; color: #000; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; font-weight: bold;">#${index + 1}</span>
                            </div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px;">
                                <div>
                                    <span style="color: #888; font-size: 0.9rem;">Standing Cost:</span>
                                    <span style="color: #fff; font-weight: bold;">${item.standing_cost.toLocaleString()}</span>
                                </div>
                                <div>
                                    <span style="color: #888; font-size: 0.9rem;">Best Price:</span>
                                    <span style="color: ${priceColor}; font-weight: bold;">${item.bestPrice} Platinum</span>
                                </div>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <span style="color: #888; font-size: 0.9rem;">Efficiency Ratio:</span>
                                    <span style="color: #ffd700; font-weight: bold; font-size: 1.1rem;">${item.bestRatio.toFixed(1)}</span>
                                </div>
                                <div style="text-align: right;">
                                    <span style="color: ${priceColor}; font-size: 0.9rem;">${rankType}</span>
                                    <br>
                                    <span style="color: #888; font-size: 0.8rem;">${item.orderCount} orders</span>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;

    resultsDiv.innerHTML = html;
}

// Add CSS for progress bar animation
const style = document.createElement('style');
style.textContent = `
    @keyframes progressPulse {
        0% { opacity: 1; }
        50% { opacity: 0.7; }
        100% { opacity: 1; }
    }
    
    #progressBar {
        animation: progressPulse 2s ease-in-out infinite;
    }
`;
document.head.appendChild(style); 