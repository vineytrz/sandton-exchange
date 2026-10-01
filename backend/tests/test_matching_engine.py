from datetime import datetime, timedelta

from app.matching_engine import BookOrder, OrderStatus, Side, match_order


def _order(order_id, side, qty, price, offset_seconds=0, filled_qty=0):
    return BookOrder(
        id=order_id,
        side=side,
        qty=qty,
        filled_qty=filled_qty,
        price=price,
        created_at=datetime(2025, 1, 1) + timedelta(seconds=offset_seconds),
    )


def test_no_cross_no_trade():
    buy = _order(1, Side.BUY, 100, 99.0)
    sell = _order(2, Side.SELL, 100, 100.0)
    result = match_order(buy, [sell])
    assert len(result.trades) == 0
    assert result.updated_orders[1].status == OrderStatus.OPEN


def test_full_fill_price_time_priority():
    sell1 = _order(2, Side.SELL, 50, 100.0, offset_seconds=0)
    sell2 = _order(3, Side.SELL, 50, 100.0, offset_seconds=10)
    buy = _order(1, Side.BUY, 80, 100.0, offset_seconds=20)
    result = match_order(buy, [sell1, sell2])
    assert len(result.trades) == 2
    assert result.trades[0].sell_order_id == 2
    assert result.trades[0].qty == 50
    assert result.trades[1].sell_order_id == 3
    assert result.trades[1].qty == 30
    assert result.updated_orders[1].status == OrderStatus.FILLED
    assert result.updated_orders[2].status == OrderStatus.FILLED
    assert result.updated_orders[3].status == OrderStatus.PARTIAL


def test_partial_fill_leaves_remainder():
    sell = _order(2, Side.SELL, 30, 100.0)
    buy = _order(1, Side.BUY, 100, 100.0)
    result = match_order(buy, [sell])
    assert len(result.trades) == 1
    assert result.trades[0].qty == 30
    assert result.updated_orders[1].remaining_qty == 70
    assert result.updated_orders[1].status == OrderStatus.PARTIAL


def test_best_price_first():
    sell_cheap = _order(2, Side.SELL, 50, 99.0, offset_seconds=0)
    sell_dear = _order(3, Side.SELL, 50, 101.0, offset_seconds=1)
    buy = _order(1, Side.BUY, 50, 101.0, offset_seconds=2)
    result = match_order(buy, [sell_dear, sell_cheap])
    assert len(result.trades) == 1
    assert result.trades[0].sell_order_id == 2
    assert result.trades[0].price == 99.0


def test_cancelled_orders_excluded():
    sell = _order(2, Side.SELL, 100, 100.0)
    sell.status = OrderStatus.CANCELLED
    buy = _order(1, Side.BUY, 100, 100.0)
    result = match_order(buy, [sell])
    assert len(result.trades) == 0


def test_sell_matches_best_bid():
    buy_high = _order(2, Side.BUY, 50, 102.0, offset_seconds=0)
    buy_low = _order(3, Side.BUY, 50, 100.0, offset_seconds=1)
    sell = _order(1, Side.SELL, 50, 100.0, offset_seconds=2)
    result = match_order(sell, [buy_low, buy_high])
    assert len(result.trades) == 1
    assert result.trades[0].buy_order_id == 2
    assert result.trades[0].price == 102.0
