// authHandler.js - Node.js version of auth_handler.py
const fetch = require('node-fetch');

const BASE_URL = 'https://api.warframe.market/v1';
let csrfToken = null;
let lastLoginTime = 0;
let loginValidDuration = 3600; // 1 hour in seconds
let username = null;

async function login(email, password) {
  // Get JWT token from /auth
  let jwtToken = null;
  try {
    const csrfRes = await fetch(`${BASE_URL}/auth`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Warframe-Market-Auth/1.0',
      },
    });
    const setCookie = csrfRes.headers.raw()['set-cookie'];
    if (setCookie) {
      for (const cookieStr of setCookie) {
        if (cookieStr.includes('JWT=')) {
          jwtToken = cookieStr.split('JWT=')[1].split(';')[0];
          break;
        }
      }
    }
  } catch (e) {
    // Ignore, fallback to login
  }

  // Prepare login data
  const loginData = { email, password };
  const loginHeaders = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'Warframe-Market-Auth/1.0',
  };
  if (jwtToken) {
    loginHeaders['X-CSRF-Token'] = jwtToken;
    loginHeaders['CSRF-Token'] = jwtToken;
    loginHeaders['X-CSRF-TOKEN'] = jwtToken;
    loginHeaders['Authorization'] = `Bearer ${jwtToken}`;
  }

  try {
    const res = await fetch(`${BASE_URL}/auth/signin`, {
      method: 'POST',
      headers: loginHeaders,
      body: JSON.stringify(loginData),
    });
    const setCookie = res.headers.raw()['set-cookie'];
    let jwt = null;
    if (setCookie) {
      for (const cookieStr of setCookie) {
        if (cookieStr.includes('JWT=')) {
          jwt = cookieStr.split('JWT=')[1].split(';')[0];
          break;
        }
      }
    }
    const responseJson = await res.json();
    if (res.status === 200 && jwt) {
      csrfToken = jwt;
      lastLoginTime = Date.now() / 1000;
      const userInfo = responseJson.payload?.user || {};
      username = userInfo.ingame_name || userInfo.slug || null;
      return { success: true, message: 'Login successful', csrfToken: jwt, username };
    } else if (res.status === 200) {
      return { success: false, message: 'No JWT token found in response' };
    } else {
      const errorMsg = responseJson.error?.message || 'Unknown error';
      return { success: false, message: `Login failed: ${errorMsg}` };
    }
  } catch (e) {
    return { success: false, message: `Login error: ${e.message}` };
  }
}

function isLoggedIn() {
  if (!csrfToken) return false;
  if ((Date.now() / 1000) - lastLoginTime > loginValidDuration) return false;
  return true;
}

function logout() {
  csrfToken = null;
  username = null;
  lastLoginTime = 0;
  return { success: true, message: 'Logged out' };
}

function getAuthStatus() {
  return {
    loggedIn: isLoggedIn(),
    username,
    csrfToken,
  };
}

function getAuthHeaders() {
  if (!isLoggedIn()) return null;
  return {
    'Authorization': `Bearer ${csrfToken}`,
    'X-CSRF-Token': csrfToken,
    'CSRF-Token': csrfToken,
    'X-CSRF-TOKEN': csrfToken,
  };
}

module.exports = {
  login,
  logout,
  isLoggedIn,
  getAuthStatus,
  getAuthHeaders,
}; 