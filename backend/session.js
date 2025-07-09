// session.js - Session management utilities for Node.js backend

const authHandler = require('./authHandler');

function getSessionStatus() {
  const authStatus = authHandler.getAuthStatus();
  let expiresAt = null;
  let expired = true;
  if (authStatus.loggedIn && authHandler.lastLoginTime && authHandler.loginValidDuration) {
    expiresAt = new Date((authHandler.lastLoginTime + authHandler.loginValidDuration) * 1000);
    expired = (Date.now() / 1000) > (authHandler.lastLoginTime + authHandler.loginValidDuration);
  }
  return {
    loggedIn: authStatus.loggedIn,
    username: authStatus.username,
    expiresAt,
    expired,
  };
}

module.exports = {
  getSessionStatus,
}; 