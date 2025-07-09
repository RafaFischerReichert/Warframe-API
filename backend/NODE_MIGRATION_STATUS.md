# Warframe API Backend Migration: Python → Node.js

This document tracks the migration status of backend features from Python to Node.js. Use this as a reference for what has been ported, what remains, and where to focus next.

---

## 1. Authentication (`auth_handler.py` → `authHandler.js`)
| Feature                                      | Python | Node.js | Status/Notes                                 |
|-----------------------------------------------|--------|---------|----------------------------------------------|
| Login (JWT/CSRF, session, user info)          | ✔️     | ✔️      | Parity achieved                              |
| Logout                                        | ✔️     | ✔️      | Parity achieved                              |
| Check login status                            | ✔️     | ✔️      | Parity achieved                              |
| Get auth headers for API requests             | ✔️     | ✔️      | Parity achieved                              |
| Session cookies management                    | ✔️     | ✖️      | Not present in Node.js (not needed for fetch)|
| Token refresh/session expiry handlers         | ✔️     | ✖️      | Not present in Node.js                       |

---

## 2. Proxy/Server (`proxy_server.py` → `server.js`)
| Feature                                      | Python | Node.js | Status/Notes                                 |
|-----------------------------------------------|--------|---------|----------------------------------------------|
| CORS proxy for Warframe Market API            | ✔️     | ✔️      | Parity achieved (via Express + CORS)         |
| Rate limiting (requests/sec, concurrency)     | ✔️     | ✔️      | Parity achieved (custom RateLimiter)         |
| Trading workflow endpoints (create/delete)    | ✔️     | ✔️      | Parity achieved                              |
| Trading analysis endpoints (batch, progress)  | ✔️     | ✔️      | Parity achieved                              |
| Cancel analysis endpoint                      | ✔️     | ✔️      | Parity achieved                              |
| In-memory job store for batch processing      | ✔️     | ✔️      | Parity achieved                              |
| My WTB orders endpoint                        | ✔️     | ✖️      | Not present in Node.js                       |
| CORS preflight (OPTIONS) handling             | ✔️     | ✔️      | Parity achieved (Express handles OPTIONS)    |
| Error handling/logging                        | ✔️     | ✔️      | Parity achieved                              |

---

## 3. Trading Calculator (`trading_calculator.py` → `tradingCalculator.js`)
| Feature                                      | Python | Node.js | Status/Notes                                 |
|-----------------------------------------------|--------|---------|----------------------------------------------|
| Analyze prime items for trading opportunities | ✔️     | ✔️      | Parity achieved                              |
| Analyze single item orders                    | ✔️     | ✔️      | Parity achieved                              |
| Profit, investment, order age filters         | ✔️     | ✔️      | Parity achieved                              |
| Cancel check for long-running analysis        | ✔️     | ✔️      | Parity achieved                              |
| Debug logging                                 | ✔️     | ✖️      | Minimal in Node.js                           |

---

## 4. Other/Miscellaneous
| Feature                                      | Python | Node.js | Status/Notes                                 |
|-----------------------------------------------|--------|---------|----------------------------------------------|
| Threading/concurrency (locks, semaphores)     | ✔️     | ✔️      | Node.js uses async/await, Map for jobs       |
| SSL context customization                     | ✔️     | ✖️      | Not needed in Node.js (handled by fetch)     |
| Utility endpoints (dummy proxy, etc.)         | ✔️     | ✖️      | Not present in Node.js                       |

---

## **Summary of What’s Missing in Node.js**
1. **Session cookies management** (not needed for fetch, but if you need cookie persistence, this is missing).
2. **Token refresh/session expiry handlers** (Node.js does not have explicit token refresh or session expiry endpoints).
3. **My WTB orders endpoint** (`/trading/my-wtb-orders` in Python, not present in Node.js).
4. **Some utility/debug endpoints** (e.g., dummy proxy, extra debug logging).
5. **More robust error handling/logging** (Node.js is good, but Python is more verbose).

---

**Next Steps:**
- Port missing endpoints and features as needed.
- Remove Python files only after confirming Node.js feature parity and stability.
- Update this document as progress is made. 