import React, { useState, useEffect } from 'react';
import { fetchApi } from './api';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [sessionAge, setSessionAge] = useState(null);
  const [hasCsrfToken, setHasCsrfToken] = useState(false);

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
    // eslint-disable-next-line
  }, []);

  const checkAuthStatus = async () => {
    try {
      const result = await fetchApi('/auth/status', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (result.logged_in) {
        setLoggedIn(true);
        setSessionAge(Math.floor(result.session_age / 60));
        setHasCsrfToken(result.has_csrf_token);
      } else {
        setLoggedIn(false);
        setSessionAge(null);
        setHasCsrfToken(false);
      }
    } catch (error) {
      setLoggedIn(false);
      setSessionAge(null);
      setHasCsrfToken(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      showMessage('Please enter both email and password', 'error');
      return;
    }
    setLoading(true);
    setMessage('');
    setMessageType('');
    try {
      const result = await fetchApi('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (result.success) {
        showMessage(result.message, 'success');
        setEmail('');
        setPassword('');
        checkAuthStatus();
      } else {
        showMessage(result.message, 'error');
      }
    } catch (error) {
      showMessage('Login failed. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const result = await fetchApi('/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (result.success) {
        showMessage(result.message, 'success');
        checkAuthStatus();
      } else {
        showMessage(result.message, 'error');
      }
    } catch (error) {
      showMessage('Logout failed. Please try again.', 'error');
    }
  };

  const showMessage = (msg, type) => {
    setMessage(msg);
    setMessageType(type);
    if (type === 'success') {
      setTimeout(() => {
        setMessage('');
        setMessageType('');
      }, 3000);
    }
  };

  // Hide error message when user types
  useEffect(() => {
    if (messageType === 'error') {
      setMessage('');
      setMessageType('');
    }
    // eslint-disable-next-line
  }, [email, password]);

  return (
    <div className="container">
      {/* Navigation (React Router links handled in App.jsx) */}
      <div className="login-container">
        <div className="login-header">
          <h1>Warframe Market Login</h1>
          <p>Sign in to access your Warframe Market account</p>
        </div>
        {loggedIn ? (
          <div className="auth-status">
            <h3>Authentication Status</h3>
            <div>
              <p><strong>Status:</strong> Logged In</p>
              <p><strong>Session Age:</strong> {sessionAge} minutes</p>
              <p><strong>CSRF Token:</strong> {hasCsrfToken ? 'Present' : 'Missing'}</p>
            </div>
            <button className="logout-btn" onClick={handleLogout}>Logout</button>
          </div>
        ) : (
          <form className="login-form" onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                required
                placeholder="Enter your email"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                required
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        )}
        {message && (
          <div className={`login-message ${messageType}`} style={{ display: 'block' }}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
};

export default Login; 