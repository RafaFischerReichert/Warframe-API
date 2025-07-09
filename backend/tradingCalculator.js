// TradingCalculator.js - Node.js version of trading_calculator.py

class TradingCalculator {
  constructor(minProfit = 10, maxInvestment = 0, maxOrderAge = 30) {
    this.minProfit = minProfit;
    this.maxInvestment = maxInvestment;
    this.maxOrderAge = maxOrderAge;
  }

  analyzePrimeItems(allItems, ordersData, cancelCheck = null, maxOrderAge = 30) {
    const opportunities = [];
    for (const item of allItems) {
      if (cancelCheck && cancelCheck()) return opportunities;
      const itemName = String(item.item_name || '');
      const itemId = String(item.id || '');
      const orders = ordersData[itemId] || [];
      const opps = this.analyzePrimeItemOrders(orders, itemName, itemId, maxOrderAge);
      opportunities.push(...opps);
    }
    return opportunities;
  }

  analyzePrimeItemOrders(orders, itemName, itemId, maxOrderAge = 30) {
    // Warframe Market flipping: buy from highest WTB, sell at lowest WTS
    const sellOrders = orders.filter(o => o.order_type === 'sell');
    const buyOrders = orders.filter(o => o.order_type === 'buy');
    if (!sellOrders.length || !buyOrders.length) return [];
    const lowestSell = sellOrders.reduce((a, b) => (a.platinum < b.platinum ? a : b));
    const highestBuy = buyOrders.reduce((a, b) => (a.platinum > b.platinum ? a : b));
    const lowestSellPrice = lowestSell.platinum || 0;
    const highestBuyPrice = highestBuy.platinum || 0;
    const adjustedBuyPrice = highestBuyPrice + 1;
    const adjustedSellPrice = lowestSellPrice - 1;
    const profit = adjustedSellPrice - adjustedBuyPrice;
    // Order age filtering
    let daysSinceUpdate = Infinity;
    if (highestBuy.creation_date) {
      try {
        const now = new Date();
        const lastSeen = new Date(highestBuy.creation_date);
        daysSinceUpdate = (now - lastSeen) / (1000 * 60 * 60 * 24);
      } catch (e) {
        daysSinceUpdate = Infinity;
      }
    }
    if (daysSinceUpdate > maxOrderAge) return [];
    if (adjustedSellPrice <= adjustedBuyPrice) return [];
    if (profit < this.minProfit) return [];
    if (this.maxInvestment !== 0 && adjustedBuyPrice > this.maxInvestment) return [];
    return [{
      itemName,
      itemId,
      buyPrice: adjustedBuyPrice,
      sellPrice: adjustedSellPrice,
      netProfit: profit,
      totalInvestment: adjustedBuyPrice,
      _wtbOrder: highestBuy,
    }];
  }
}

module.exports = TradingCalculator; 