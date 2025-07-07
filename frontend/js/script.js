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

// Update the applyFilter function to use keyword mapping
function applyFilter() {
    const filterValue = document.getElementById('itemFilterInput')?.value?.toLowerCase() || '';
    currentTypeFilter = getItemTypeFromFilter(filterValue);
    
    // If there are already results, trigger a new search with the filter
    if (lastDisplayedItems.length > 0) {
        searchSyndicateMods();
    }
}

// Single DOMContentLoaded event listener to initialize everything
document.addEventListener('DOMContentLoaded', async function() {
    // Initialize event listeners
    searchBtn.addEventListener('click', searchSyndicateMods);
    
    // Add Enter key support for search input
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchSyndicateMods();
        }
    });
    
    // Time preset button event listeners
    const presetButtons = document.querySelectorAll('.time-preset-btn');
    presetButtons.forEach(button => {
        button.addEventListener('click', function() {
            const days = parseInt(this.dataset.days);
            timeRangeSlider.value = days;
            updateTimeRangeDisplay();
            updatePresetButtons();
        });
    });
    
    // Apply Filter button event listener
    if (applyFilterBtn) {
        applyFilterBtn.addEventListener('click', applyFilter);
    }
    
    // Check authentication status on page load
    checkAuthStatus();
    
    // Load syndicate data and initialize UI
    await loadSyndicateData();
    updateTimeRangeDisplay(); // Initialize the display
    updatePresetButtons(); // Initialize preset button states
    updateRankDescription(); // Initialize rank description
    updateOrderModeDescription(); // Initialize order mode description
});

async function searchSyndicateMods() {
    if (searchInProgress) return;
    searchInProgress = true;
    cancelSearch = false;
    const searchTerm = searchInput.value.trim().toLowerCase();
    if (!searchTerm) {
        resultsDiv.innerHTML = '<p style="color: #ff6b6b; text-align: center;">Please enter a syndicate name</p>';
        searchInProgress = false;
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
    // Split input by comma and trim each part
    const searchTerms = searchTerm.split(',').map(s => s.trim()).filter(Boolean);
    // Find all matching syndicates (unique)
    const matchedKeys = new Set();
    
    // Check if "all" is in the search terms
    const isAllSyndicates = searchTerms.some(term => term.toLowerCase() === 'all');
    
    if (isAllSyndicates) {
        // Include all syndicates
        for (const [key, data] of Object.entries(SYNDICATES)) {
            matchedKeys.add(key);
        }
    } else {
        // Normal syndicate matching
        for (const term of searchTerms) {
            for (const [key, data] of Object.entries(SYNDICATES)) {
                if (data.keywords.some(keyword => {
                    const keywordLower = keyword.toLowerCase();
                    return term === keywordLower || keywordLower.includes(term) || term.includes(keywordLower);
                })) {
                    matchedKeys.add(key);
                }
            }
        }
    }
    const matchedSyndicates = Array.from(matchedKeys).map(key => [key, SYNDICATES[key]]);
    if (matchedSyndicates.length === 0) {
        resultsDiv.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #ff6b6b;">
                <h3>Syndicate Not Found</h3>
                <p>Available syndicates:</p>
                <ul style="text-align: left; max-width: 400px; margin: 10px auto; color: #b0b0b0;">
                    ${Object.values(SYNDICATES).map(s => `<li>${s.name}</li>`).join('')}
                </ul>
            </div>
        `;
        searchInProgress = false;
        return;
    }
    // Combine all items from all matched syndicates
    let combinedItems = [];
    let syndicateNames = [];
    let syndicateColors = [];
    for (const [syndicateKey, syndicateData] of matchedSyndicates) {
        // Apply type filter at the search level
        let itemsToAdd = syndicateData.items;
        if (currentTypeFilter) {
            itemsToAdd = syndicateData.items.filter(item => 
                item.type && item.type.toLowerCase().includes(currentTypeFilter)
            );
        }
        // Filter by standing if input is present and valid
        if (
            standingInput &&
            standingInput.value !== '' &&
            !isNaN(standingInput.value)
        ) {
            const standingValue = parseInt(standingInput.value, 10);
            if (!isNaN(standingValue)) {
                itemsToAdd = itemsToAdd.filter(
                    item =>
                        typeof item.standing_cost === 'number' &&
                        item.standing_cost <= standingValue
                );
            }
        }
        combinedItems = combinedItems.concat(itemsToAdd.map(item => ({...item, syndicate: syndicateData.name, color: syndicateData.color})));
        syndicateNames.push(syndicateData.name);
        syndicateColors.push(syndicateData.color);
    }
    // Remove duplicates by item name/type/standing_cost
    const uniqueItems = [];
    const seen = new Set();
    for (const item of combinedItems) {
        const key = item.name + '|' + item.type + '|' + item.standing_cost;
        if (!seen.has(key)) {
            uniqueItems.push(item);
            seen.add(key);
        }
    }
    // Build heading
    const heading = syndicateNames.length === 1 ?
        `${syndicateNames[0]} Items` :
        `${syndicateNames.slice(0, -1).join(', ')} and ${syndicateNames[syndicateNames.length - 1]} Items`;
    
    // Add filter info to heading if filter is active
    const filterInfo = currentTypeFilter ? ` (${currentTypeFilter} only)` : '';
    const fullHeading = heading + filterInfo;
    
    // Show progress bar loading state with cancel button
    resultsDiv.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
            <h3 style="color: ${syndicateColors[0]};">${fullHeading}</h3>
            <p style="color: #00d4ff; font-size: 0.9rem; margin-bottom: 10px;">Time range: ${timeRangeDisplay.textContent}</p>
            <p style="color: ${getSelectedRank() === 'rank0' ? '#00d4ff' : '#ff6b6b'}; font-size: 0.9rem; margin-bottom: 10px;">Rank: ${getSelectedRank() === 'rank0' ? 'Rank 0' : 'Rank 3'}</p>
            <p style="color: ${getSelectedOrderMode() === 'all' ? '#ff6b6b' : '#4ecdc4'}; font-size: 0.9rem; margin-bottom: 10px;">Orders: ${getSelectedOrderMode() === 'all' ? 'All Orders' : 'Online Only'}</p>
            <div class="progress-bar-container">
                <div id="progressBar" class="progress-bar" style="width: 0%; background: linear-gradient(90deg, ${syndicateColors[0]}, #00d4ff);"></div>
            </div>
            <p id="progressText" class="progress-text">0 / ${uniqueItems.length} items processed</p>
            <p id="currentItem" class="current-item">Starting...</p>
            <button id="cancelSearchBtn" style="margin-top:10px; background:#ff6b6b; color:#fff; border:none; border-radius:4px; padding:10px 20px; cursor:pointer;">Cancel Search</button>
        </div>
    `;
    // Add cancel button event listener
    setTimeout(() => {
        const cancelSearchBtn = document.getElementById('cancelSearchBtn');
        if (cancelSearchBtn) {
            cancelSearchBtn.onclick = function() {
                cancelSearch = true;
                const currentItem = document.getElementById('currentItem');
                if (currentItem) currentItem.textContent = 'Search cancelled.';
            };
        }
    }, 0);
    // Get price data for each item
    const itemsWithPrices = [];
    let completedItems = 0;
    for (let i = 0; i < uniqueItems.length; i++) {
        if (cancelSearch) {
            searchInProgress = false;
            return;
        }
        const item = uniqueItems[i];
        try {
            completedItems++;
            const progressPercent = (completedItems / uniqueItems.length) * 100;
            const progressBar = document.getElementById('progressBar');
            const progressText = document.getElementById('progressText');
            const currentItem = document.getElementById('currentItem');
            if (progressBar && progressText && currentItem) {
                progressBar.style.width = `${progressPercent}%`;
                progressText.textContent = `${completedItems} / ${uniqueItems.length} items processed`;
                currentItem.textContent = `Processing: ${item.name}`;
            }
            // Convert item name to URL format (lowercase, replace spaces with underscores)
            const urlName = item.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
            // Fetch price/order data for this item
            const selectedRank = getSelectedRank();
            const apiUrl = `${API_BASE_URL}/items/${urlName}/orders`;
            let price = null;
            let efficiency = null;
            let orderCount = 0;
            let recentOrders = [];
            try {
                const response = await fetch(apiUrl);
                if (response.ok) {
                    const data = await response.json();
                    // Filter orders by rank, recency, and online status if needed
                    const orders = (data.payload && data.payload.orders) ? data.payload.orders : [];
                    const now = new Date();
                    const orderMode = getSelectedOrderMode();
                    recentOrders = orders.filter(order => {
                        // Filter by rank
                        if (order.mod_rank !== undefined && ((selectedRank === 'rank0' && order.mod_rank !== 0) || (selectedRank === 'rank3' && order.mod_rank !== 3))) {
                            return false;
                        }
                        
                        // Filter by time range
                        const lastSeen = new Date(order.last_update || order.last_seen || 0);
                        const isWithinTimeRange = (now - lastSeen) / (1000 * 60 * 60 * 24) <= parseInt(timeRangeSlider.value);
                        if (!isWithinTimeRange) {
                            return false;
                        }
                        
                        // Filter by online status if "online only" is selected
                        if (orderMode === 'online' && order.user && order.user.status !== 'ingame' && order.user.status !== 'online') {
                            return false;
                        }
                        
                        return true;
                    });
                    orderCount = recentOrders.length;
                    if (orderCount > 0) {
                        const prices = recentOrders.map(order => order.platinum);
                        price = Math.min(...prices);
                        efficiency = Math.round((item.standing_cost / price) * 10) / 10;
                    }
                }
            } catch (err) {
                // Ignore fetch errors for individual items
            }
            itemsWithPrices.push({
                ...item,
                price,
                efficiency,
                orderCount
            });
        } catch (err) {
            // Handle errors for individual items
        }
    }
    // After all items, display the results
    displayCombinedResults(itemsWithPrices, fullHeading, syndicateColors[0]);
    searchInProgress = false;
}

function displayCombinedResults(items, heading, color) {
    // Save for filtering
    lastDisplayedItems = items;
    lastHeading = heading + (getSelectedOrderMode() === 'all' ? ' (All Orders)' : ' (Online Only)');
    lastColor = color;
    renderFilteredItems();
}

function renderFilteredItems() {
    // Sort items: available (with price) first, then by efficiency ascending (lowest to highest)
    const sortedItems = [...lastDisplayedItems].sort((a, b) => {
        if (a.price && !b.price) return -1;
        if (!a.price && b.price) return 1;
        if (a.efficiency != null && b.efficiency != null) return a.efficiency - b.efficiency;
        return 0;
    });
    
    // Only apply filter if button is clicked, not on every input change
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
            <h3 style="color: ${lastColor};">${lastHeading}</h3>
            <p style="color: #00d4ff; font-size: 0.9rem; margin-bottom: 10px;">Time range: ${timeRangeDisplay.textContent}</p>
            <p style="color: ${getSelectedRank() === 'rank0' ? '#00d4ff' : '#ff6b6b'}; font-size: 0.9rem; margin-bottom: 10px;">Rank: ${getSelectedRank() === 'rank0' ? 'Rank 0' : 'Rank 3'}</p>
            <p style="color: ${getSelectedOrderMode() === 'all' ? '#ff6b6b' : '#4ecdc4'}; font-size: 0.9rem; margin-bottom: 10px;">Orders: ${getSelectedOrderMode() === 'all' ? 'All Orders' : 'Online Only'}</p>
        </div>
        <div class="items-grid">
            ${sortedItems.map(item => `
                <div class="item-card" style="border-color: ${item.color};">
                    <div class="item-name">${item.name}</div>
                    <div class="item-category">${item.type}</div>
                    <div class="price-info">
                        ${item.price !== null ? `<span class="price-label">Min Price:</span> <span class="price-value">${item.price}p</span>` : '<span class="price-label">No Orders</span>'}
                    </div>
                    <div class="volume-info">
                        ${item.orderCount ? `${item.orderCount} orders` : ''}
                    </div>
                    <div class="efficiency-info">
                        ${item.efficiency ? `<span class="price-label">Efficiency:</span> <span class="price-value">${item.efficiency}</span>` : ''}
                    </div>
                    <div class="syndicate-label" style="color: ${item.color}; font-size: 0.85em;">${item.syndicate}</div>
                </div>
            `).join('')}
        </div>
    `;
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