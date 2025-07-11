// Warframe Market API integration for Syndicate Mod Search
const API_BASE_URL = '/api'; // Use proxy server to avoid CORS issues

// DOM elements
const searchBtn = document.getElementById('searchBtn');
const resultsDiv = document.getElementById('results');
const timeRangeSlider = document.getElementById('timeRangeSlider');
const timeRangeDisplay = document.getElementById('timeRangeDisplay');
const rankSwitch = document.getElementById('rankSwitch');
const rankDescription = document.getElementById('rankDescription');
const searchInput = document.getElementById('searchInput');
const orderModeSwitch = document.getElementById('orderModeSwitch');
const orderModeDescription = document.getElementById('orderModeDescription');
const applyFilterBtn = document.getElementById('applyFilterBtn');
const standingInput = document.getElementById('standingInput');

// Global variable to store syndicate data
let SYNDICATES = {};

// Add global filter variable
let currentTypeFilter = '';

// Global state variables
let lastDisplayedItems = [];
let lastHeading = '';
let lastColor = '';
let searchInProgress = false;
let cancelSearch = false;

// Add filter keywords mapping
const FILTER_KEYWORDS = {
    'mod': ['mod', 'mods', 'modification', 'modifications', 'augment', 'augments', 'augmentation', 'augmentations'],
    'weapon': ['weapon', 'weapons', 'weap', 'weaps', 'gun', 'guns', 'wep', 'weps', 'wepon', 'wepons'],
    'cosmetic': ['cosmetic', 'cosmetics', 'cosm', 'skin', 'skins', 'appearance', 'skinset', 'skinsets', 'drifter', 'drifters'],
    'archwing': ['archwing', 'arch', 'wing', 'wings', 'archwings', 'archgun', 'archguns'],
    'blueprint': ['blueprint', 'blueprints', 'bp', 'bps', 'recipe', 'recipes'],
    'emote': ['emote', 'emotes', 'animation', 'animations', 'anim', 'anims'],
    'armor': ['armor', 'armors', 'armour', 'armours'],
    'syandana': ['syandana', 'syandanas', 'cape', 'capes', 'scarf', 'scarves'],
    'sigil': ['sigil', 'sigils', 'emblem', 'emblems'],
    'glyph': ['glyph', 'glyphs', 'profile', 'profiles'],
    'key': ['key', 'keys', 'mission', 'missions'],
    'consumable': ['consumable', 'consumables', 'consum', 'boost', 'boosts'],
    'other': ['other', 'others', 'misc', 'miscellaneous']
};

// Helper function to get item type from filter input
function getItemTypeFromFilter(filterValue) {
    const lowerFilter = filterValue.toLowerCase();
    
    // Check if the filter matches any keywords
    for (const [itemType, keywords] of Object.entries(FILTER_KEYWORDS)) {
        if (keywords.some(keyword => 
            lowerFilter === keyword || 
            keyword.includes(lowerFilter) || 
            lowerFilter.includes(keyword)
        )) {
            return itemType;
        }
    }
    
    // If no keyword match, return the original filter value
    return lowerFilter;
}

// Load syndicate data from JSON file
async function loadSyndicateData() {
    try {
        const response = await fetch('/data/syndicate_items.json');
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

// Linear slider: use value directly
timeRangeSlider.addEventListener('input', function() {
    updateTimeRangeDisplay();
    updatePresetButtons();
});

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

// Update order mode description
function updateOrderModeDescription() {
    const isOnline = !orderModeSwitch.checked;
    if (isOnline) {
        orderModeDescription.textContent = 'Showing only online player orders';
        orderModeDescription.style.color = '#b0b0b0';
    } else {
        orderModeDescription.textContent = 'Showing all player orders';
        orderModeDescription.style.color = '#ff6b6b';
    }
}

function getSelectedOrderMode() {
    // Checkbox unchecked = online only, checked = all orders
    return orderModeSwitch && orderModeSwitch.checked ? 'all' : 'online';
}

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
        authIndicator.style.color = '#00ff00';
        authIndicator.style.border = '1px solid #00ff00';
        authIndicator.textContent = '✓ Authenticated';
    } else {
        authIndicator.style.background = 'rgba(255, 0, 0, 0.2)';
        authIndicator.style.color = '#ff0000';
        authIndicator.style.border = '1px solid #ff0000';
        authIndicator.textContent = '✗ Not Authenticated';
    }
    
    document.body.appendChild(authIndicator);
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        if (authIndicator.parentNode) {
            authIndicator.style.opacity = '0';
            setTimeout(() => {
                if (authIndicator.parentNode) {
                    authIndicator.remove();
                }
            }, 300);
        }
    }, 3000);
}

// Apply filter function
function applyFilter() {
    const filterValue = document.getElementById('filterInput').value.trim();
    currentTypeFilter = filterValue;
    
    // Update filter display
    const filterDisplay = document.getElementById('filterDisplay');
    if (filterValue) {
        const itemType = getItemTypeFromFilter(filterValue);
        filterDisplay.textContent = `Filter: ${itemType}`;
        filterDisplay.style.display = 'inline-block';
    } else {
        filterDisplay.style.display = 'none';
    }
    
    // Re-render the last displayed items with the new filter
    if (lastDisplayedItems.length > 0) {
        renderFilteredItems();
    }
}

// Main search function
async function searchSyndicateMods() {
    if (searchInProgress) {
        cancelSearch = true;
        searchBtn.textContent = 'Searching...';
        return;
    }
    
    const searchTerm = searchInput.value.trim();
    if (!searchTerm) {
        resultsDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: #ff6b6b;">Please enter a search term.</div>';
        return;
    }
    
    searchInProgress = true;
    cancelSearch = false;
    searchBtn.textContent = 'Cancel Search';
    
    try {
        // Clear previous results
        resultsDiv.innerHTML = '<div style="text-align: center; padding: 20px;">Searching...</div>';
        
        const timeRange = parseInt(timeRangeSlider.value);
        const rankType = getSelectedRank();
        const orderMode = getSelectedOrderMode();
        const standing = parseInt(standingInput.value) || 0;
        
        // Search through all syndicates
        const allResults = [];
        const syndicateNames = Object.keys(SYNDICATES);
        
        for (const syndicateName of syndicateNames) {
            if (cancelSearch) break;
            
            const syndicate = SYNDICATES[syndicateName];
            const items = syndicate.items || [];
            
            // Filter items by search term
            const matchingItems = items.filter(item => {
                const itemName = item.name.toLowerCase();
                const searchLower = searchTerm.toLowerCase();
                return itemName.includes(searchLower);
            });
            
            // Get market data for matching items
            for (const item of matchingItems) {
                if (cancelSearch) break;
                
                try {
                    const marketData = await fetchMarketData(item.name, timeRange, rankType, orderMode);
                    
                    if (marketData && marketData.length > 0) {
                        // Calculate profit based on standing cost
                        const profit = calculateProfit(marketData, item.standing_cost, standing);
                        
                        allResults.push({
                            ...item,
                            syndicate: syndicateName,
                            marketData: marketData,
                            profit: profit,
                            profitPerStanding: item.standing_cost > 0 ? profit / item.standing_cost : 0
                        });
                    }
                } catch (error) {
                    console.error(`Error fetching market data for ${item.name}:`, error);
                }
            }
        }
        
        if (cancelSearch) {
            resultsDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: #ff6b6b;">Search cancelled.</div>';
            return;
        }
        
        // Sort results by profit per standing (descending)
        allResults.sort((a, b) => b.profitPerStanding - a.profitPerStanding);
        
        // Display results
        if (allResults.length > 0) {
            displayCombinedResults(allResults, `Found ${allResults.length} items across all syndicates`, '#00d4ff');
        } else {
            resultsDiv.innerHTML = '<div style="text-align: center; padding: 20px; color: #ff6b6b;">No items found matching your search.</div>';
        }
        
    } catch (error) {
        console.error('Search error:', error);
        resultsDiv.innerHTML = `<div style="text-align: center; padding: 20px; color: #ff6b6b;">Error: ${error.message}</div>`;
    } finally {
        searchInProgress = false;
        searchBtn.textContent = 'Search Syndicate Mods';
    }
}

// Fetch market data from Warframe Market API
async function fetchMarketData(itemName, timeRange, rankType, orderMode) {
    const url = `${API_BASE_URL}/market/orders/${encodeURIComponent(itemName)}`;
    const params = new URLSearchParams({
        time_range: timeRange,
        rank: rankType,
        order_mode: orderMode
    });
    
    const response = await fetch(`${url}?${params}`);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
}

// Calculate profit based on market data and standing cost
function calculateProfit(marketData, standingCost, userStanding) {
    if (!marketData || marketData.length === 0) return 0;
    
    // Get the lowest sell price (what we can sell for)
    const sellOrders = marketData.filter(order => order.order_type === 'sell');
    if (sellOrders.length === 0) return 0;
    
    const lowestSellPrice = Math.min(...sellOrders.map(order => order.platinum));
    
    // Calculate standing cost in platinum (assuming 1 standing = 0.01 platinum)
    const standingCostInPlat = standingCost * 0.01;
    
    // Calculate profit
    const profit = lowestSellPrice - standingCostInPlat;
    
    return Math.max(0, profit); // Ensure profit is not negative
}

// Display combined results from all syndicates
function displayCombinedResults(items, heading, color) {
    lastDisplayedItems = items;
    lastHeading = heading;
    lastColor = color;
    
    renderFilteredItems();
}

// Render filtered items based on current filter
function renderFilteredItems() {
    if (lastDisplayedItems.length === 0) return;
    
    let filteredItems = lastDisplayedItems;
    
    // Apply type filter if set
    if (currentTypeFilter) {
        const itemType = getItemTypeFromFilter(currentTypeFilter);
        filteredItems = lastDisplayedItems.filter(item => {
            const itemName = item.name.toLowerCase();
            return itemName.includes(itemType) || item.type === itemType;
        });
    }
    
    // Group items by syndicate
    const groupedItems = {};
    filteredItems.forEach(item => {
        if (!groupedItems[item.syndicate]) {
            groupedItems[item.syndicate] = [];
        }
        groupedItems[item.syndicate].push(item);
    });
    
    // Build HTML
    let html = `<h2 style="color: ${lastColor};">${lastHeading}</h2>`;
    
    Object.keys(groupedItems).sort().forEach(syndicateName => {
        const items = groupedItems[syndicateName];
        
        html += `<div class="syndicate-group">`;
        html += `<h3 style="color: ${lastColor};">${syndicateName}</h3>`;
        html += `<div class="items-grid">`;
        
        items.forEach(item => {
            const marketData = item.marketData || [];
            const sellOrders = marketData.filter(order => order.order_type === 'sell');
            const buyOrders = marketData.filter(order => order.order_type === 'buy');
            
            const lowestSell = sellOrders.length > 0 ? Math.min(...sellOrders.map(o => o.platinum)) : 'N/A';
            const highestBuy = buyOrders.length > 0 ? Math.max(...buyOrders.map(o => o.platinum)) : 'N/A';
            
            html += `
                <div class="item-card">
                    <h4>${item.name}</h4>
                    <p><strong>Standing Cost:</strong> ${item.standing_cost.toLocaleString()}</p>
                    <p><strong>Lowest Sell:</strong> ${lowestSell} plat</p>
                    <p><strong>Highest Buy:</strong> ${highestBuy} plat</p>
                    <p><strong>Profit:</strong> <span style="color: ${item.profit > 0 ? '#00ff00' : '#ff0000'}">${item.profit.toFixed(2)} plat</span></p>
                    <p><strong>Profit/Standing:</strong> <span style="color: ${item.profitPerStanding > 0 ? '#00ff00' : '#ff0000'}">${item.profitPerStanding.toFixed(4)}</span></p>
                </div>
            `;
        });
        
        html += `</div></div>`;
    });
    
    resultsDiv.innerHTML = html;
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Load syndicate data
    loadSyndicateData();
    
    // Check authentication status
    checkAuthStatus();
    
    // Set up event listeners
    searchBtn.addEventListener('click', searchSyndicateMods);
    
    rankSwitch.addEventListener('change', updateRankDescription);
    orderModeSwitch.addEventListener('change', updateOrderModeDescription);
    
    applyFilterBtn.addEventListener('click', applyFilter);
    
    // Set up preset buttons
    const presetButtons = document.querySelectorAll('.time-preset-btn');
    presetButtons.forEach(button => {
        button.addEventListener('click', function() {
            const days = parseInt(this.dataset.days);
            timeRangeSlider.value = days;
            updateTimeRangeDisplay();
            updatePresetButtons();
        });
    });
    
    // Initialize displays
    updateTimeRangeDisplay();
    updateRankDescription();
    updateOrderModeDescription();
    updatePresetButtons();
    
    // Enter key for search
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchSyndicateMods();
        }
    });
    
    // Enter key for filter
    document.getElementById('filterInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            applyFilter();
        }
    });
}); 