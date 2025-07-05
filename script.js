// Basic Warframe Market API integration
const API_BASE_URL = 'https://api.warframe.market/v1';

// DOM elements
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const resultsDiv = document.getElementById('results');

// Event listeners
searchBtn.addEventListener('click', searchItems);
searchInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        searchItems();
    }
});

// Search function
async function searchItems() {
    const searchTerm = searchInput.value.trim();
    
    if (!searchTerm) {
        resultsDiv.innerHTML = '<p>Please enter a search term</p>';
        return;
    }

    try {
        resultsDiv.innerHTML = '<p>Searching...</p>';
        
        // Get all items first
        const response = await fetch(`${API_BASE_URL}/items`);
        const data = await response.json();
        
        // Filter items by search term
        const items = data.payload.items.filter(item => 
            item.item_name.toLowerCase().includes(searchTerm.toLowerCase())
        );

        displayResults(items);
    } catch (error) {
        resultsDiv.innerHTML = '<p>Error: ' + error.message + '</p>';
    }
}

// Display results
function displayResults(items) {
    if (items.length === 0) {
        resultsDiv.innerHTML = '<p>No items found</p>';
        return;
    }

    const html = items.map(item => `
        <div style="border: 1px solid #ccc; padding: 10px; margin: 10px 0; border-radius: 4px;">
            <h3>${item.item_name}</h3>
            <p>Category: ${item.category}</p>
        </div>
    `).join('');

    resultsDiv.innerHTML = html;
} 