# trading-tools

TradingView indicators written in Pine Script v6. Each one lives in `tradingview-indicators/` as a `.pine` file with a companion `.md` covering how it works, every setting, and its limitations.

## Indicators

| Indicator | File | Docs | Chart TF | Data TF |
|---|---|---|---|---|
| ExposureTrade - Multi SMA (Daily) | [`multi-sma-daily.pine`](tradingview-indicators/multi-sma-daily.pine) | [docs](tradingview-indicators/multi-sma-daily.md) | any | 1 day |
| S/R Zones (1H) | [`support-resistance-zones.pine`](tradingview-indicators/support-resistance-zones.pine) | [docs](tradingview-indicators/support-resistance-zones.md) | any | 1 hour |
| Reversal Signals (5m) | [`reversal-signals-5m.pine`](tradingview-indicators/reversal-signals-5m.pine) | [docs](tradingview-indicators/reversal-signals-5m.md) | 5 min | 5 min |

All three read their data from a fixed timeframe with `request.security()` rather than from the chart. For the first two that means the levels stay anchored while you work on any timeframe you like. Reversal Signals also reads 5m data on any chart, but draws its labels at chart bars, so it is worth keeping on a 5m chart to avoid several signals collapsing into one bar.

### ExposureTrade - Multi SMA (Daily)

Up to 5 Simple Moving Averages, all calculated on daily bars whatever the chart timeframe. Behaves like the built-in Simple Moving Average with its Timeframe field set to 1 day, except one copy covers five lengths. Defaults are the daily 20, 50, 100 and 200, plus a spare slot.

Each SMA has its own length, source, offset, color, width and line style (solid, dashed or dotted). Optional labels at the right edge name each line and its current value. On weekly and monthly charts the calculation falls back to the chart's own timeframe, since daily values cannot be drawn meaningfully there.

Use it to keep the daily levels swing traders watch visible while trading intraday.

### S/R Zones (1H)

Finds support and resistance zones from 1-hour pivot highs and lows and draws them as colored boxes. Pivots that land close to an existing zone merge into it and raise its touch count, so zones strengthen as price retests them. Zones are dropped once price closes decisively through them, and the weakest are pruned when the zone count exceeds the limit, scored by touch count and recency.

Only zones with at least `minTouches` touches are drawn. Alert conditions fire when the 1H close enters a confirmed support or resistance zone, and a table in the corner counts the tracked zones.

### Reversal Signals (5m)

Scores bullish and bearish reversal setups on 5-minute data and prints BUY/SELL labels once the score clears a threshold. Inputs from:

- RSI at oversold or overbought
- Stochastic crossover inside an extreme zone
- Volume spike above a multiple of its average
- Engulfing candles
- Pin bars and hammers, by wick-to-body ratio
- RSI divergence against price over a lookback window

Every component can be switched off, the minimum score is configurable, and an optional EMA filter restricts signals to the prevailing trend. Consecutive duplicate signals in the same direction are suppressed. Alert conditions and a table showing the live component values are included.

## Installation

1. Open TradingView and go to the Pine Editor in the bottom panel.
2. Click "Open" > "New blank indicator".
3. Replace the contents with the `.pine` file you want.
4. Click "Save", name it, then "Add to chart".

Settings appear under the indicator's Inputs tab, grouped per feature.
