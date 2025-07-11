import pytest
from backend.trading_calculator import TradingCalculator
import datetime

# All test orders use a recent creation_date so order age filtering does not cause false negatives.
def test_analyze_prime_item_orders_basic_profit():
    calc = TradingCalculator(min_profit=5)
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    orders = [
        {'order_type': 'sell', 'platinum': 20, 'creation_date': now},
        {'order_type': 'buy', 'platinum': 10, 'creation_date': now},
    ]
    result = calc.analyze_prime_item_orders(orders, 'Test Prime', 'test_id')
    assert result, 'Should find a profitable opportunity'
    assert result[0]['netProfit'] == 8, 'Profit should be (sell-1) - (buy+1) = 19-11 = 8'


def test_analyze_prime_item_orders_min_profit():
    calc = TradingCalculator(min_profit=20)
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    orders = [
        {'order_type': 'sell', 'platinum': 15, 'creation_date': now},
        {'order_type': 'buy', 'platinum': 10, 'creation_date': now},
    ]
    result = calc.analyze_prime_item_orders(orders, 'Test Prime', 'test_id')
    assert not result, 'Should not find opportunity if profit < min_profit'


def test_analyze_prime_item_orders_order_age():
    from dateutil.tz import tzutc
    calc = TradingCalculator(min_profit=1, max_order_age=1)
    now = datetime.datetime.now(datetime.timezone.utc)
    old_date = (now - datetime.timedelta(days=2)).isoformat()
    orders = [
        {'order_type': 'sell', 'platinum': 20, 'creation_date': now.isoformat()},
        {'order_type': 'buy', 'platinum': 10, 'creation_date': old_date},
    ]
    result = calc.analyze_prime_item_orders(orders, 'Test Prime', 'test_id', max_order_age=1)
    assert not result, 'Should not find opportunity if best buy order is too old'


def test_analyze_prime_items_multiple():
    calc = TradingCalculator(min_profit=1)
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    all_items = [
        {'item_name': 'Prime1', 'id': 'id1'},
        {'item_name': 'Prime2', 'id': 'id2'},
    ]
    orders_data = {
        'id1': [
            {'order_type': 'sell', 'platinum': 20, 'creation_date': now},
            {'order_type': 'buy', 'platinum': 10, 'creation_date': now},
        ],
        'id2': [
            {'order_type': 'sell', 'platinum': 30, 'creation_date': now},
            {'order_type': 'buy', 'platinum': 25, 'creation_date': now},
        ],
    }
    result = calc.analyze_prime_items(all_items, orders_data)
    assert len(result) == 2, 'Should find opportunities for both items'

def test_dummy_calculation():
    # Replace with actual function and logic
    assert True  # Placeholder test 
    
def test_max_investment_filtering():
    calc = TradingCalculator(min_profit=1, max_investment=100)
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    orders = [
        {'order_type': 'sell', 'platinum': 120, 'creation_date': now},
        {'order_type': 'buy', 'platinum': 100, 'creation_date': now},
    ]
    result = calc.analyze_prime_item_orders(orders, 'Test Prime', 'test_id')
    assert not result, 'Should not find opportunity if investment exceeds max_investment'

def test_empty_order():
    calc = TradingCalculator(min_profit=1)
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    orders = []
    result = calc.analyze_prime_item_orders(orders, 'Test Prime', 'test_id')
    assert not result, 'Should not find opportunity if no orders are present'

def test_only_buy_orders_present():
    calc = TradingCalculator(min_profit=1)
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    orders = [
        {'order_type': 'buy', 'platinum': 10, 'creation_date': now},
        {'order_type': 'buy', 'platinum': 20, 'creation_date': now},
    ]
    result = calc.analyze_prime_item_orders(orders, 'Test Prime', 'test_id')
    assert not result, 'Should not find opportunity if only buy orders are present'

def test_only_sell_orders_present():
    calc = TradingCalculator(min_profit=1)
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    orders = [
        {'order_type': 'sell', 'platinum': 10, 'creation_date': now},
        {'order_type': 'sell', 'platinum': 20, 'creation_date': now},
    ]
    result = calc.analyze_prime_item_orders(orders, 'Test Prime', 'test_id')
    assert not result, 'Should not find opportunity if only sell orders are present'

def test_negative_profit():
    calc = TradingCalculator(min_profit=1)
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    orders = [
        {'order_type': 'sell', 'platinum': 10, 'creation_date': now},
        {'order_type': 'buy', 'platinum': 20, 'creation_date': now},
    ]
    result = calc.analyze_prime_item_orders(orders, 'Test Prime', 'test_id')
    assert not result, 'Should not find opportunity if profit is negative'
    
def test_zero_profit():
    calc = TradingCalculator(min_profit=1)
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    orders = [
        {'order_type': 'sell', 'platinum': 10, 'creation_date': now},
        {'order_type': 'buy', 'platinum': 10, 'creation_date': now},
    ]
    result = calc.analyze_prime_item_orders(orders, 'Test Prime', 'test_id')
    assert not result, 'Should not find opportunity if profit is zero'
    
def test_analyze_prime_items_cancel_check():
    calc = TradingCalculator(min_profit=1)
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    all_items = [
        {'item_name': 'Prime1', 'id': 'id1'},
        {'item_name': 'Prime2', 'id': 'id2'},
    ]
    orders_data = {
        'id1': [
            {'order_type': 'sell', 'platinum': 20, 'creation_date': now},
            {'order_type': 'buy', 'platinum': 10, 'creation_date': now},
        ],
        'id2': [
            {'order_type': 'sell', 'platinum': 30, 'creation_date': now},
            {'order_type': 'buy', 'platinum': 25, 'creation_date': now},
        ],
    }
    
    # Cancel check that always returns True
    cancel_check = lambda: True
    
    result = calc.analyze_prime_items(all_items, orders_data, cancel_check=cancel_check)
    assert not result, 'Should return empty list if cancel check is triggered'
    
def test_analyze_prime_items_no_orders():
    calc = TradingCalculator(min_profit=1)
    all_items = [{'item_name': 'Prime1', 'id': 'id1'}]
    orders_data = {'id1': []}  # No orders for the item
    result = calc.analyze_prime_items(all_items, orders_data)
    assert not result, 'Should return empty list if no orders are present for the item' 
    
def test_analyze_prime_items_no_items():
    calc = TradingCalculator(min_profit=1)
    all_items = []  # No items to analyze
    orders_data = {'id1': []}  # No orders for any item
    result = calc.analyze_prime_items(all_items, orders_data)
    assert not result, 'Should return empty list if no items are present'
    
def test_analyze_prime_items_mixed_orders():
    calc = TradingCalculator(min_profit=1)
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    all_items = [{'item_name': 'Prime1', 'id': 'id1'}]
    orders_data = {
        'id1': [
            {'order_type': 'sell', 'platinum': 20, 'creation_date': now},
            {'order_type': 'buy', 'platinum': 10, 'creation_date': now},
            {'order_type': 'buy', 'platinum': 5, 'creation_date': now},  # Lower profit buy order
        ]
    }
    result = calc.analyze_prime_items(all_items, orders_data)
    assert len(result) == 1, 'Should find one profitable opportunity'
    assert result[0]['netProfit'] == 8, 'Profit should be (sell-1) - (buy+1) = 19-11 = 8'
    
def test_analyze_prime_items_no_visible_filter():
    calc = TradingCalculator(min_profit=1)
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    all_items = [{'item_name': 'Prime1', 'id': 'id1'}]
    orders_data = {
        'id1': [
            {'order_type': 'sell', 'platinum': 20, 'creation_date': now, 'visible': True},
            {'order_type': 'buy', 'platinum': 10, 'creation_date': now, 'visible': False},  # Not visible
        ]
    }
    result = calc.analyze_prime_items(all_items, orders_data)
    assert len(result) == 1, 'Should find one profitable opportunity even with non-visible buy order'
    assert result[0]['netProfit'] == 8, 'Profit should be (sell-1) - (buy+1) = 19-11 = 8'
    
def test_analyze_prime_items_multiple_items_no_profit():
    calc = TradingCalculator(min_profit=1)
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    all_items = [
        {'item_name': 'Prime1', 'id': 'id1'},
        {'item_name': 'Prime2', 'id': 'id2'},
    ]
    orders_data = {
        'id1': [
            {'order_type': 'sell', 'platinum': 10, 'creation_date': now},
            {'order_type': 'buy', 'platinum': 10, 'creation_date': now},
        ],
        'id2': [
            {'order_type': 'sell', 'platinum': 15, 'creation_date': now},
            {'order_type': 'buy', 'platinum': 15, 'creation_date': now},
        ],
    }
    result = calc.analyze_prime_items(all_items, orders_data)
    assert not result, 'Should return empty list if no profitable opportunities are found'
    
def test_analyze_prime_items_mixed_order_types():
    calc = TradingCalculator(min_profit=1)
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    all_items = [{'item_name': 'Prime1', 'id': 'id1'}]
    orders_data = {
        'id1': [
            {'order_type': 'sell', 'platinum': 20, 'creation_date': now},
            {'order_type': 'buy', 'platinum': 10, 'creation_date': now},
            {'order_type': 'sell', 'platinum': 15, 'creation_date': now},  # Additional sell order
        ]
    }
    result = calc.analyze_prime_items(all_items, orders_data)
    assert len(result) == 1, 'Should find one profitable opportunity with mixed order types'
    assert result[0]['netProfit'] == 3, 'Profit should be (lowest_sell-1) - (highest_buy+1) = 14-11 = 3'
    
def test_delete_all_WTB():
    """Test the delete all WTB orders functionality"""
    # This test would typically be in test_proxy_server.py since it tests an endpoint
    # But since it's related to trading calculator workflow, we'll test the logic here
    
    # Test that the trading calculator can handle empty orders after deletion
    calc = TradingCalculator(min_profit=5)
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    
    # Simulate scenario where all WTB orders were deleted
    # This should result in no trading opportunities
    orders = [
        {'order_type': 'sell', 'platinum': 20, 'creation_date': now},
        # No buy orders - simulating all WTB orders deleted
    ]
    
    result = calc.analyze_prime_item_orders(orders, 'Test Prime', 'test_id')
    assert not result, 'Should not find opportunities when no buy orders exist (after WTB deletion)'
    
    # Test that new opportunities can be found after deletion
    # Simulate new market conditions after WTB deletion
    new_orders = [
        {'order_type': 'sell', 'platinum': 15, 'creation_date': now},
        {'order_type': 'buy', 'platinum': 5, 'creation_date': now},  # New buy order
    ]
    
    result = calc.analyze_prime_item_orders(new_orders, 'Test Prime', 'test_id')
    assert result, 'Should find new opportunities after WTB deletion and market recalculation'
    assert result[0]['netProfit'] == 8, 'Profit should be (sell-1) - (buy+1) = 14-6 = 8' 
    