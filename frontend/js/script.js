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
        const response = await fetch('../data/syndicate_items.json');
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

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    searchBtn.addEventListener('click', searchSyndicateMods);
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

// Add Enter key support for search input
searchInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        searchSyndicateMods();
    }
  
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
});

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

// Initialize the application by loading syndicate data
document.addEventListener('DOMContentLoaded', async function() {
    await loadSyndicateData();
    updateTimeRangeDisplay(); // Initialize the display
    updatePresetButtons(); // Initialize preset button states
    updateRankDescription(); // Initialize rank description
    updateOrderModeDescription(); // Initialize order mode description
});

let lastDisplayedItems = [];
let lastHeading = '';
let lastColor = '';
let searchInProgress = false;
let cancelSearch = false;

async function searchSyndicateMods() {
    const searchValue = searchInput.value.trim();
    const typeFilter = getItemTypeFromFilter(searchValue);
    const standing = standingInput.value.trim();
    try {
        resultsDiv.innerHTML = '<div>Searching...</div>';
        const response = await fetch('/api/syndicate-search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                search: searchValue,
                type_filter: typeFilter,
                standing: standing
            })
        });
        if (!response.ok) {
            throw new Error('Failed to search syndicate mods');
        }
        const result = await response.json();
        renderFilteredItems(result.results || []);
    } catch (error) {
        resultsDiv.innerHTML = `<div style="color: red;">Error: ${error.message}</div>`;
    }
}

function renderFilteredItems(items) {
    // Render the filtered items as before
    if (!items.length) {
        resultsDiv.innerHTML = '<div>No results found.</div>';
        return;
    }
    let html = '<ul>';
    for (const item of items) {
        html += `<li><strong>${item.name}</strong> (${item.type}) - Standing: ${item.standing_cost} [${item.syndicate}]</li>`;
    }
    html += '</ul>';
    resultsDiv.innerHTML = html;
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