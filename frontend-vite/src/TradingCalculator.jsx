import React, { useState } from 'react';

const TradingCalculator = () => {
  // State for all inputs and workflow
  const [minProfit, setMinProfit] = useState(10);
  const [maxInvestment, setMaxInvestment] = useState(100);
  const [autoAddCount, setAutoAddCount] = useState(10);
  const [maxOrderAge, setMaxOrderAge] = useState(30);
  // Placeholder states for workflow and results
  const [pendingItems, setPendingItems] = useState([]);
  const [boughtItems, setBoughtItems] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [primeSetsAnalyzed, setPrimeSetsAnalyzed] = useState(0);
  const [totalOpportunities, setTotalOpportunities] = useState(0);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('Initializing...');
  const [currentItem, setCurrentItem] = useState('');
  const [analysisInProgress, setAnalysisInProgress] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [error, setError] = useState('');

  // Analyze All Prime Items logic
  const handleAnalyze = async () => {
    setError('');
    setShowProgress(true);
    setAnalysisInProgress(true);
    setProgress(0);
    setProgressText('Fetching all items from market...');
    setCurrentItem('');
    setOpportunities([]);
    setPrimeSetsAnalyzed(0);
    setTotalOpportunities(0);
    try {
      // Step 1: Get all items
      const itemsResponse = await fetch('/api/items');
      if (!itemsResponse.ok) throw new Error('Failed to fetch items');
      const itemsData = await itemsResponse.json();
      const allItems = itemsData.payload?.items || [];
      setProgressText('Starting backend analysis...');
      // Step 2: Start backend analysis job
      const startJobResponse = await fetch('/api/trading-calc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          all_items: allItems,
          min_profit: minProfit,
          max_investment: maxInvestment,
          max_order_age: maxOrderAge,
          batch_size: 5,
        }),
      });
      if (!startJobResponse.ok) throw new Error('Failed to start backend analysis job');
      const { job_id } = await startJobResponse.json();
      if (!job_id) throw new Error('No job_id returned from backend');
      setJobId(job_id);
      setProgressText('Analyzing...');
      // Step 3: Poll for progress/results
      pollJob(job_id);
    } catch (e) {
      setError(e.message || 'Error analyzing prime items');
      setShowProgress(false);
      setAnalysisInProgress(false);
    }
  };

  // Polling function
  const pollJob = async (job_id) => {
    let polling = true;
    while (polling) {
      try {
        const resp = await fetch(`/api/trading-calc-progress?job_id=${job_id}`);
        if (!resp.ok) throw new Error('Failed to poll job progress');
        const data = await resp.json();
        setPrimeSetsAnalyzed(data.progress);
        setTotalOpportunities(data.results.length);
        setOpportunities(data.results);
        setProgress(data.total ? Math.round((data.progress / data.total) * 100) : 0);
        setProgressText(`Analyzed ${data.progress} / ${data.total} items`);
        if (data.status === 'done' || data.status === 'cancelled') {
          setShowProgress(false);
          setAnalysisInProgress(false);
          polling = false;
        } else {
          await new Promise(res => setTimeout(res, 1000));
        }
      } catch (e) {
        setError('Error polling job progress');
        setShowProgress(false);
        setAnalysisInProgress(false);
        polling = false;
      }
    }
  };

  return (
    <div className="container">
      <h1>Warframe Trading Calculator</h1>
      <p style={{ textAlign: 'center', color: '#b0b0b0', marginBottom: 20 }}>
        Find profitable trading opportunities by analyzing WTB and WTS orders
      </p>
      {/* Navigation handled by App.jsx */}
      <div className="trading-calculator-container">
        <div className="trading-inputs">
          <div className="input-group">
            <label htmlFor="minProfitInput">Minimum Profit (platinum):</label>
            <input
              type="number"
              id="minProfitInput"
              placeholder="10"
              min="1"
              value={minProfit}
              onChange={e => setMinProfit(Number(e.target.value))}
            />
          </div>
          <div className="input-group">
            <label htmlFor="maxInvestmentInput">Maximum Investment (platinum):</label>
            <input
              type="number"
              id="maxInvestmentInput"
              placeholder="100"
              min="0"
              value={maxInvestment}
              onChange={e => setMaxInvestment(Number(e.target.value))}
            />
          </div>
          <div className="input-group">
            <label htmlFor="autoAddCountInput">Auto-add Top Opportunities:</label>
            <input
              type="number"
              id="autoAddCountInput"
              placeholder="10"
              min="0"
              max="20"
              value={autoAddCount}
              onChange={e => setAutoAddCount(Number(e.target.value))}
            />
          </div>
          <button id="analyzePrimeSetsBtn" className="analyze-btn" onClick={handleAnalyze} disabled={analysisInProgress}>Analyze All Prime Items</button>
          <button id="clearTableBtn" className="clear-table-btn">Clear Table</button>
        </div>
        <div className="trading-info">
          <p><strong>How it works:</strong> This tool automatically fetches all Prime items (sets, weapons, frames, and parts) from the market and analyzes their trading opportunities. It finds the gap between WTB and WTS orders for each Prime item and shows the top 20 most profitable opportunities.</p>
          <p><strong>Auto-add feature:</strong> Set the number of top opportunities you want to automatically create WTB orders for. The system will ask for confirmation before creating the orders. Set to 0 to disable auto-add.</p>
        </div>
      </div>
      {/* Analysis Progress */}
      {showProgress && (
        <div id="analysis-progress" className="analysis-progress">
          <h3 style={{ color: '#00d4ff', textAlign: 'center', marginBottom: 15 }}>Analyzing Prime Sets</h3>
          <div className="progress-container">
            <div className="progress-bar" id="progressBar" style={{ width: `${progress}%` }}></div>
          </div>
          <p id="progressText" style={{ textAlign: 'center', color: '#b0b0b0', marginTop: 10 }}>{progressText}</p>
          <p id="currentItem" style={{ textAlign: 'center', color: '#00d4ff', fontSize: '0.9rem', marginTop: 5 }}>{currentItem}</p>
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <button id="stopAnalysisBtn" className="stop-btn">Stop Analysis</button>
          </div>
        </div>
      )}
      {/* Trading Workflow Table and Panels */}
      <div className="trading-table-container">
        <h3 style={{ color: '#00d4ff', textAlign: 'center', marginBottom: 20 }}>Trading Workflow</h3>
        <div className="table-controls">
          <span id="primeSetsAnalyzed" className="mods-counter">Prime items analyzed: {primeSetsAnalyzed}</span>
          <span id="totalOpportunities" className="opportunities-counter">Total opportunities: {totalOpportunities}</span>
        </div>
        <div className="trading-workflow-container">
          <div className="trading-panels-row">
            <div className="trading-panel pending-panel">
              <h4 style={{ color: '#ffd700', textAlign: 'center', marginBottom: 15 }}>📋 Pending Orders</h4>
              <div className="panel-description">
                <p style={{ fontSize: '0.9em', color: '#b0b0b0', textAlign: 'center', marginBottom: 15 }}>
                  Items you've created WTB orders for. Click "Bought" when you acquire the item.
                </p>
                <button id="refreshWTBOrdersBtn" style={{ marginBottom: 10 }}>Refresh My WTB Orders</button>
                <button id="deleteAllWTBOrdersBtn" style={{ marginBottom: 10, marginLeft: 10, background: '#ff6b6b', borderColor: '#ff6b6b' }}>Delete All WTB Orders</button>
              </div>
              <div id="pendingItemsContainer" className="items-container">
                {pendingItems.length === 0 ? (
                  <div className="empty-state">
                    <p style={{ color: '#666', textAlign: 'center', fontStyle: 'italic' }}>No pending orders</p>
                  </div>
                ) : (
                  <div>Pending items UI here</div>
                )}
              </div>
            </div>
            <div className="trading-panel bought-panel">
              <h4 style={{ color: '#00d46e', textAlign: 'center', marginBottom: 15 }}>💼 Portfolio (Bought Items)</h4>
              <div id="boughtItemsContainer" className="items-container">
                {boughtItems.length === 0 ? (
                  <div className="empty-state">
                    <p style={{ color: '#666', textAlign: 'center', fontStyle: 'italic' }}>No bought items</p>
                  </div>
                ) : (
                  <div>Bought items UI here</div>
                )}
              </div>
              {/* Profit Chart placeholder */}
              <div style={{ margin: '30px 0 10px 0', textAlign: 'center' }}>
                <canvas id="profitChart" width="400" height="180" style={{ maxWidth: '100%', background: '#181c24', borderRadius: 8 }}></canvas>
              </div>
            </div>
          </div>
          {/* Trading Opportunities Table */}
          <div className="trading-opportunities-section">
            <h4 style={{ color: '#00d4ff', textAlign: 'center', marginBottom: 15 }}>🎯 Top Trading Opportunities</h4>
            <div className="panel-description">
              <p style={{ fontSize: '0.9em', color: '#b0b0b0', textAlign: 'center', marginBottom: 15 }}>
                Click "Create WTB" to start trading an item
              </p>
            </div>
            <div className="trading-table-wrapper">
              <table id="tradingTable" className="trading-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Prime Item</th>
                    <th>Buy Price</th>
                    <th>Sell Price</th>
                    <th>Order Age (days)</th>
                    <th>Net Profit</th>
                    <th>Total Investment</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody id="tradingTableBody">
                  {opportunities.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', color: '#888' }}>No opportunities yet</td>
                    </tr>
                  ) : (
                    opportunities.map((opp, idx) => (
                      <tr key={opp.itemId}>
                        <td>{idx + 1}</td>
                        <td>{opp.itemName}</td>
                        <td>{opp.buyPrice}</td>
                        <td>{opp.sellPrice}</td>
                        <td>{opp._wtbOrder && opp._wtbOrder.creation_date ? (Math.round((Date.now() - new Date(opp._wtbOrder.creation_date)) / (1000 * 60 * 60 * 24) * 10) / 10) : '-'}</td>
                        <td>{opp.netProfit}</td>
                        <td>{opp.totalInvestment}</td>
                        <td><button disabled>Coming Soon</button></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      {/* Max Order Age Slider */}
      <div className="order-age-slider-section" style={{ margin: '30px 0 10px 0', textAlign: 'center' }}>
        <label htmlFor="maxOrderAgeSlider" style={{ color: '#00d4ff', fontWeight: 'bold', marginRight: 10 }}>Max Order Age (days):</label>
        <input
          type="range"
          id="maxOrderAgeSlider"
          min="1"
          max="30"
          value={maxOrderAge}
          style={{ verticalAlign: 'middle' }}
          onChange={e => setMaxOrderAge(Number(e.target.value))}
        />
        <span id="maxOrderAgeValue" style={{ color: '#ffd700', fontWeight: 'bold', marginLeft: 10 }}>{maxOrderAge}</span>
      </div>
      {/* Welcome/Instructions */}
      <div id="trading-results">
        <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>
          <h3 style={{ color: '#00d4ff' }}>Welcome to Trading Calculator</h3>
          <p>Click "Analyze All Prime Items" to find trading opportunities across all Prime items.</p>
          <div style={{ marginTop: 20, textAlign: 'left', maxWidth: 600, marginLeft: 'auto', marginRight: 'auto' }}>
            <h4 style={{ color: '#00d4ff', marginBottom: 10 }}>How to use:</h4>
            <ul style={{ color: '#b0b0b0', lineHeight: 1.6 }}>
              <li><strong>Prime Items:</strong> Analyzes all Prime items including sets, weapons, frames, and individual parts</li>
              <li><strong>Minimum Profit:</strong> Set the minimum profit you want to see (in platinum)</li>
              <li><strong>Maximum Investment:</strong> Set your maximum budget for buying items</li>
              <li><strong>Trading Tax:</strong> Include the 5% trading tax in calculations</li>
            </ul>
          </div>
          <p style={{ fontSize: '0.9em', marginTop: 20 }}>
            <strong>Tip:</strong> The calculator will show you the best buy and sell prices, profit margins, and ROI percentages for all Prime items.
          </p>
        </div>
      </div>
      {error && <div style={{ color: '#ff6b6b', textAlign: 'center', marginTop: 20 }}>{error}</div>}
    </div>
  );
};

export default TradingCalculator; 