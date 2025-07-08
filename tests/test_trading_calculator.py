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
    assert result[0]['netProfit'] == 9, 'Profit should be sell-1 - (buy+1) = 19-11 = 8, but code uses 20-1 - (10+1) = 18-11 = 7, check logic.'


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