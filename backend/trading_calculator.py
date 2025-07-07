import json
from typing import List, Dict, Any

class TradingCalculator:
    """
    Encapsulates trading calculation and analysis logic for Warframe Prime items.
    Ported from frontend JS to Python for backend processing.
    """
    def __init__(self, min_profit: int = 10, max_investment: int = 0, max_order_age: int = 30):
        self.min_profit = min_profit
        self.max_investment = max_investment
        self.max_order_age = max_order_age

    def analyze_prime_items(self, all_items: List[Dict[str, Any]], orders_data: Dict[str, List[Dict[str, Any]]], cancel_check=None, max_order_age: int = 30) -> List[Dict[str, Any]]:
        """
        Analyze all prime items and return trading opportunities.
        :param all_items: List of all item dicts (from Warframe Market API)
        :param orders_data: Dict mapping item names to their orders (from Warframe Market API)
        :param cancel_check: Optional callable that returns True if analysis should be cancelled
        :param max_order_age: Maximum allowed age (in days) for the best WTB order
        :return: List of trading opportunity dicts
        """
        print('[DEBUG] ENTERED analyze_prime_items')
        opportunities = []
        print(f'[DEBUG] orders_data keys: {list(orders_data.keys())[:10]} ...')
        for item in all_items:
            if cancel_check and cancel_check():
                return opportunities
            item_name = str(item.get('item_name') or '')
            item_id = str(item.get('id') or '')
            print(f'[DEBUG] Analyzing {item_name} (ID: {item_id})')
            orders = orders_data.get(item_id, [])
            print(f'[DEBUG] {item_name} (ID: {item_id}): Retrieved {len(orders)} orders from orders_data')
            if orders:
                print(f'[DEBUG] {item_name}: First 3 raw orders: {orders[:3]}')
            opps = self.analyze_prime_item_orders(orders, item_name, item_id, max_order_age)
            opportunities.extend(opps)
        return opportunities

    def analyze_prime_item_orders(self, orders: List[Dict[str, Any]], item_name: str, item_id: str, max_order_age: int = 30) -> List[Dict[str, Any]]:
        """
        Analyze orders for a single prime item and return profitable opportunities.
        :param orders: List of order dicts for the item
        :param item_name: Name of the item
        :param item_id: ID of the item
        :param max_order_age: Maximum allowed age (in days) for the best WTB order
        :return: List of opportunity dicts
        """
        import datetime
        from dateutil import parser as date_parser
        # Warframe Market flipping: buy from highest WTB, sell at lowest WTS
        # Temporarily remove 'visible == True' filter
        sell_orders = [o for o in orders if o.get('order_type') == 'sell']
        buy_orders = [o for o in orders if o.get('order_type') == 'buy']
        print(f'[DEBUG] {item_name}: {len(sell_orders)} WTS, {len(buy_orders)} WTB orders (no visible filter)')
        if not sell_orders or not buy_orders:
            print(f'[DEBUG] {item_name}: No valid sell or buy orders (skipped)')
            return []
        lowest_sell = min(sell_orders, key=lambda o: o.get('platinum', float('inf')))
        highest_buy = max(buy_orders, key=lambda o: o.get('platinum', float('-inf')))
        print(f'[DEBUG] {item_name}: Best WTS order: {lowest_sell}')
        print(f'[DEBUG] {item_name}: Best WTB order: {highest_buy}')
        print(f'[DEBUG] {item_name}: Best WTS price {lowest_sell.get("platinum")}, Best WTB price {highest_buy.get("platinum")}')
        lowest_sell_price = lowest_sell.get('platinum', 0)
        highest_buy_price = highest_buy.get('platinum', 0)
        adjusted_buy_price = highest_buy_price + 1
        adjusted_sell_price = lowest_sell_price - 1
        profit = adjusted_sell_price - adjusted_buy_price
        # Order age filtering
        now = datetime.datetime.now(datetime.timezone.utc)
        last_seen_str = highest_buy.get('creation_date')
        if last_seen_str:
            try:
                last_seen = date_parser.parse(last_seen_str)
                days_since_update = (now - last_seen).total_seconds() / (60 * 60 * 24)
                print(f'[DEBUG] {item_name}: Best WTB last seen {days_since_update:.2f} days ago')
            except Exception as e:
                print(f'[DEBUG] {item_name}: Error parsing last_seen: {e}')
                days_since_update = float('inf')
        else:
            print(f'[DEBUG] {item_name}: No last_seen/last_update for best WTB')
            days_since_update = float('inf')
        if days_since_update > max_order_age:
            print(f'[DEBUG] {item_name}: Best WTB order too old ({days_since_update:.1f} days > {max_order_age} days, skipped)')
            return []
        if adjusted_sell_price <= adjusted_buy_price:
            print(f'[DEBUG] {item_name}: No profit (sell {adjusted_sell_price} <= buy {adjusted_buy_price}, skipped)')
            return []
        if profit < self.min_profit:
            print(f'[DEBUG] {item_name}: Profit {profit} < min_profit {self.min_profit} (skipped)')
            return []
        if self.max_investment != 0 and adjusted_buy_price > self.max_investment:
            print(f'[DEBUG] {item_name}: Buy price {adjusted_buy_price} > max_investment {self.max_investment} (skipped)')
            return []
        print(f'[DEBUG] {item_name}: Opportunity added! Buy {adjusted_buy_price}, Sell {adjusted_sell_price}, Profit {profit}, Last seen {days_since_update:.1f} days ago')
        return [{
            'itemName': item_name,
            'itemId': item_id,
            'buyPrice': adjusted_buy_price,
            'sellPrice': adjusted_sell_price,
            'netProfit': profit,
            'totalInvestment': adjusted_buy_price,
            '_wtbOrder': highest_buy,
        }] 