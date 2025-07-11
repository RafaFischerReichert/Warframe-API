import React, { useState, useEffect } from 'react';

const API_BASE_URL = '/api';

const FILTER_KEYWORDS = {
  mod: ['mod', 'mods', 'modification', 'modifications', 'augment', 'augments', 'augmentation', 'augmentations'],
  weapon: ['weapon', 'weapons', 'weap', 'weaps', 'gun', 'guns', 'wep', 'weps', 'wepon', 'wepons'],
  cosmetic: ['cosmetic', 'cosmetics', 'cosm', 'skin', 'skins', 'appearance', 'skinset', 'skinsets', 'drifter', 'drifters'],
  archwing: ['archwing', 'arch', 'wing', 'wings', 'archwings', 'archgun', 'archguns'],
  blueprint: ['blueprint', 'blueprints', 'bp', 'bps', 'recipe', 'recipes'],
  emote: ['emote', 'emotes', 'animation', 'animations', 'anim', 'anims'],
  armor: ['armor', 'armors', 'armour', 'armours'],
  syandana: ['syandana', 'syandanas', 'cape', 'capes', 'scarf', 'scarves'],
  sigil: ['sigil', 'sigils', 'emblem', 'emblems'],
  glyph: ['glyph', 'glyphs', 'profile', 'profiles'],
  key: ['key', 'keys', 'mission', 'missions'],
  consumable: ['consumable', 'consumables', 'consum', 'boost', 'boosts'],
  other: ['other', 'others', 'misc', 'miscellaneous'],
};

function getItemTypeFromFilter(filterValue) {
  const lowerFilter = filterValue.toLowerCase();
  for (const [itemType, keywords] of Object.entries(FILTER_KEYWORDS)) {
    if (keywords.some(keyword => lowerFilter === keyword || keyword.includes(lowerFilter) || lowerFilter.includes(keyword))) {
      return itemType;
    }
  }
  return lowerFilter;
}

const defaultWelcome = (
  <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>
    <h3 style={{ color: '#00d4ff' }}>Welcome to Syndicate Mod Market</h3>
    <p>Enter a syndicate name above to search for their mods and current prices.</p>
    <div style={{ marginTop: 20, textAlign: 'left', maxWidth: 600, marginLeft: 'auto', marginRight: 'auto' }}>
      <h4 style={{ color: '#00d4ff', marginBottom: 10 }}>Available Syndicates:</h4>
      <ul style={{ color: '#b0b0b0', lineHeight: 1.6 }}>
        <li><strong style={{ color: '#ff6b6b' }}>Steel Meridian</strong> - Red-themed syndicate</li>
        <li><strong style={{ color: '#4ecdc4' }}>Arbiters of Hexis</strong> - Blue-themed syndicate</li>
        <li><strong style={{ color: '#45b7d1' }}>Cephalon Suda</strong> - Cyan-themed syndicate</li>
        <li><strong style={{ color: '#96ceb4' }}>Perrin Sequence</strong> - Green-themed syndicate</li>
        <li><strong style={{ color: '#d63031' }}>Red Veil</strong> - Dark red syndicate</li>
        <li><strong style={{ color: '#00b894' }}>New Loka</strong> - Light green syndicate</li>
      </ul>
    </div>
    <p style={{ fontSize: '0.9em', marginTop: 20 }}>
      <strong>Tip:</strong> Results are automatically sorted by highest price, with available mods shown first.
    </p>
  </div>
);

const SyndicateScreen = () => {
  const [syndicates, setSyndicates] = useState({});
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [standing, setStanding] = useState('');
  const [timeRange, setTimeRange] = useState(30);
  const [rank3, setRank3] = useState(false);
  const [orderModeAll, setOrderModeAll] = useState(false);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/data/syndicate_items.json')
      .then(res => res.json())
      .then(setSyndicates)
      .catch(() => setError('Failed to load syndicate_items.json'));
  }, []);

  const handleSearch = async () => {
    setLoading(true);
    setError('');
    setResults(null);
    try {
      // Simulate search logic: filter by syndicate name
      const syndicateName = search.trim().toLowerCase();
      if (!syndicateName || !syndicates[syndicateName]) {
        setError('Syndicate not found. Please enter a valid syndicate name.');
        setLoading(false);
        return;
      }
      // TODO: Fetch market data for each mod (see original JS for full logic)
      // For now, just show the mods for the syndicate
      setResults(syndicates[syndicateName]);
    } catch (e) {
      setError('Error searching for syndicate mods.');
    }
    setLoading(false);
  };

  return (
    <div className="container">
      <h1>Warframe Syndicate Mod Market</h1>
      <p style={{ textAlign: 'center', color: '#b0b0b0', marginBottom: 20 }}>
        Search for syndicate mods and check their current market prices
      </p>
      {/* Navigation handled by App.jsx */}
      <div className="search-section">
        <input
          type="text"
          id="searchInput"
          placeholder="Enter syndicate name (e.g., 'Steel Meridian', 'Red Veil', 'Suda')..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button id="searchBtn" onClick={handleSearch} disabled={loading}>
          {loading ? 'Searching...' : 'Search Mods'}
        </button>
      </div>
      <div className="filter-section" style={{ textAlign: 'center', marginBottom: 20 }}>
        <input
          type="text"
          id="itemFilterInput"
          placeholder="Filter items by type..."
          style={{ padding: 8, width: 250, borderRadius: 4, border: '1px solid #333', background: '#222', color: '#fff', marginRight: 10 }}
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
        <button id="applyFilterBtn" style={{ padding: '8px 16px', background: 'linear-gradient(45deg, #00d4ff, #ff6b6b)', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>
          Apply Filter
        </button>
      </div>
      <div className="standing-section" style={{ textAlign: 'center', marginBottom: 20 }}>
        <input
          type="number"
          id="standingInput"
          placeholder="Maximum Standing Price"
          min="0"
          style={{ padding: 8, width: 200, borderRadius: 4, border: '1px solid #333', background: '#222', color: '#fff', marginRight: 10 }}
          value={standing}
          onChange={e => setStanding(e.target.value)}
        />
        <label htmlFor="standingInput" style={{ color: '#b0b0b0' }}>Your Current Standing</label>
      </div>
      <div className="time-range-section">
        <h3 style={{ color: '#00d4ff', marginBottom: 15, textAlign: 'center' }}>Time Range for Orders</h3>
        <div className="time-range-container">
          <div className="time-range-display">
            <span id="timeRangeDisplay">Last {timeRange} days</span>
          </div>
          <div className="time-range-presets">
            {[1, 7, 30, 90].map(days => (
              <button
                key={days}
                className={`time-preset-btn${timeRange === days ? ' active' : ''}`}
                data-days={days}
                onClick={() => setTimeRange(days)}
              >
                {days} Day{days > 1 ? 's' : ''}
              </button>
            ))}
          </div>
          <div className="time-range-slider-container">
            <input
              type="range"
              id="timeRangeSlider"
              min="1"
              max="90"
              value={timeRange}
              className="time-range-slider"
              onChange={e => setTimeRange(Number(e.target.value))}
            />
            <div className="time-range-labels">
              <span>1 day</span>
              <span>7 days</span>
              <span>30 days</span>
              <span>90 days</span>
            </div>
          </div>
        </div>
      </div>
      <div className="rank-selection-section">
        <h3 style={{ color: '#00d4ff', marginBottom: 15, textAlign: 'center' }}>Mod Rank Selection</h3>
        <div className="rank-switch-container">
          <div className="rank-switch">
            <input
              type="checkbox"
              id="rankSwitch"
              className="rank-switch-input"
              checked={rank3}
              onChange={e => setRank3(e.target.checked)}
            />
            <label htmlFor="rankSwitch" className="rank-switch-label">
              <span className="rank-switch-slider"></span>
              <span className="rank-switch-text rank-0-text">Rank 0</span>
              <span className="rank-switch-text rank-3-text">Rank 3</span>
            </label>
          </div>
          <p className="rank-description" id="rankDescription" style={{ color: rank3 ? '#ff6b6b' : '#00d4ff' }}>
            {rank3 ? 'Searching for Rank 3 mods (max rank)' : 'Searching for Rank 0 mods (unranked)'}
          </p>
        </div>
      </div>
      <div className="order-mode-section">
        <h3 style={{ color: '#00d4ff', marginBottom: 15, textAlign: 'center' }}>Order Display Mode</h3>
        <div className="order-mode-switch-container">
          <div className="order-mode-switch">
            <input
              type="checkbox"
              id="orderModeSwitch"
              className="order-mode-switch-input"
              checked={orderModeAll}
              onChange={e => setOrderModeAll(e.target.checked)}
            />
            <label htmlFor="orderModeSwitch" className="order-mode-switch-label">
              <span className="order-mode-switch-slider"></span>
              <span className="order-mode-switch-text online-text">Online Only</span>
              <span className="order-mode-switch-text all-text">All Orders</span>
            </label>
          </div>
          <p className="order-mode-description" id="orderModeDescription" style={{ color: orderModeAll ? '#ff6b6b' : '#b0b0b0' }}>
            {orderModeAll ? 'Showing all player orders' : 'Showing only online player orders'}
          </p>
        </div>
      </div>
      <div id="results">
        {error && <div style={{ color: '#ff6b6b', textAlign: 'center', padding: 20 }}>{error}</div>}
        {!results && !error && defaultWelcome}
        {results && (
          <div style={{ textAlign: 'center', color: '#b0b0b0', padding: 20 }}>
            <h3>Mods for this syndicate:</h3>
            <ul>
              {results.map((mod, idx) => (
                <li key={idx}>{mod.name}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default SyndicateScreen; 