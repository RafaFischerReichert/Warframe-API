import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link
} from 'react-router-dom';
import Login from './Login';
import SyndicateScreen from './SyndicateScreen';
import TradingCalculator from './TradingCalculator';

function App() {
  return (
    <Router>
      <nav style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <Link to="/">Login</Link>
        <Link to="/syndicate">Syndicate Analysis</Link>
        <Link to="/trading">Trading Calculator</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/syndicate" element={<SyndicateScreen />} />
        <Route path="/trading" element={<TradingCalculator />} />
      </Routes>
    </Router>
  );
}

export default App;
