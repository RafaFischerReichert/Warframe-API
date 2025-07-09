// rateLimiter.js - Rate limiting for Warframe Market API requests

class RateLimiter {
  constructor(requestsPerSecond = 5, maxConcurrent = 10) {
    this.requestsPerSecond = requestsPerSecond;
    this.maxConcurrent = maxConcurrent;
    this.requestTimestamps = [];
    this.activeRequests = 0;
    this.rateLimitDetected = false;
    this.rateLimitStartTime = 0;
    this.lock = false;
  }

  async acquire() {
    // Wait for rate limit to clear if detected
    if (this.rateLimitDetected) {
      const timeSinceRateLimit = Date.now() - this.rateLimitStartTime;
      if (timeSinceRateLimit < 60000) { // Wait 1 minute after rate limit
        throw new Error('Rate limit active, please wait');
      } else {
        this.clearRateLimit();
      }
    }

    // Wait for concurrent request slot
    while (this.activeRequests >= this.maxConcurrent) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Wait for rate limit window
    const now = Date.now();
    const windowStart = now - 1000; // 1 second window

    // Remove old timestamps
    this.requestTimestamps = this.requestTimestamps.filter(
      timestamp => timestamp > windowStart
    );

    // Wait if we've hit the rate limit
    while (this.requestTimestamps.length >= this.requestsPerSecond) {
      const oldestTimestamp = this.requestTimestamps[0];
      const waitTime = 1000 - (now - oldestTimestamp);
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      // Update now and clean up again
      const newNow = Date.now();
      const newWindowStart = newNow - 1000;
      this.requestTimestamps = this.requestTimestamps.filter(
        timestamp => timestamp > newWindowStart
      );
    }

    // Add current request
    this.requestTimestamps.push(now);
    this.activeRequests++;
  }

  release() {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
  }

  setRateLimited() {
    this.rateLimitDetected = true;
    this.rateLimitStartTime = Date.now();
    console.log(`[RATE LIMIT] Rate limiting detected at ${new Date().toLocaleTimeString()}`);
  }

  clearRateLimit() {
    if (this.rateLimitDetected) {
      console.log(`[RATE LIMIT] Rate limiting cleared at ${new Date().toLocaleTimeString()}`);
    }
    this.rateLimitDetected = false;
  }

  getStatus() {
    return {
      activeRequests: this.activeRequests,
      maxConcurrent: this.maxConcurrent,
      requestsInWindow: this.requestTimestamps.length,
      requestsPerSecond: this.requestsPerSecond,
      rateLimitDetected: this.rateLimitDetected,
      timeSinceRateLimit: this.rateLimitDetected ? Date.now() - this.rateLimitStartTime : 0
    };
  }
}

module.exports = RateLimiter; 