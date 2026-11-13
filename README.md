# trading-tools

Chart indicators for TradingView (Pine Script v6, in `tradingview-indicators/`) and NinjaTrader Web (JavaScript, in `ninjatrader-indicators/`). Each indicator has a companion `.md` covering how it works, every setting, and its limitations.

## TradingView Indicators

| Indicator | File | Docs | Chart TF | Data TF |
|---|---|---|---|---|
| ExposureTrade - Multi SMA (Daily) | [`multi-sma-daily.pine`](tradingview-indicators/multi-sma-daily.pine) | [docs](tradingview-indicators/multi-sma-daily.md) | any | 1 day |
| S/R Zones (1H) | [`support-resistance-zones.pine`](tradingview-indicators/support-resistance-zones.pine) | [docs](tradingview-indicators/support-resistance-zones.md) | any | 1 hour |
| Reversal Signals (5m) | [`reversal-signals-5m.pine`](tradingview-indicators/reversal-signals-5m.pine) | [docs](tradingview-indicators/reversal-signals-5m.md) | 5 min | 5 min |

All three read their data from a fixed timeframe with `request.security()` rather than from the chart. For the first two that means the levels stay anchored while you work on any timeframe you like. Reversal Signals also reads 5m data on any chart, but draws its labels at chart bars, so it is worth keeping on a 5m chart to avoid several signals collapsing into one bar.

### ExposureTrade - Multi SMA (Daily)

Up to 5 Simple Moving Averages, all calculated on daily bars whatever the chart timeframe. Behaves like the built-in Simple Moving Average with its Timeframe field set to 1 day, except one copy covers five lengths. Defaults are the daily 20, 50, 100 and 200, plus a spare slot.

Each SMA has its own length, source and offset in the Inputs tab, with color, thickness and line style left to TradingView's Style tab. Optional labels at the right edge name each line and its current value. On weekly and monthly charts the calculation falls back to the chart's own timeframe, since daily values cannot be drawn meaningfully there.

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

### Installation

1. Open TradingView and go to the Pine Editor in the bottom panel.
2. Click "Open" > "New blank indicator".
3. Replace the contents with the `.pine` file you want.
4. Click "Save", name it, then "Add to chart".

Settings appear under the indicator's Inputs tab, grouped per feature.

## NinjaTrader Web Indicators

| Indicator | File | Docs |
|---|---|---|
| EMA Trend Cloud | [`EMA-trend-cloud.js`](ninjatrader-indicators/EMA-trend-cloud.js) | [docs](ninjatrader-indicators/EMA-trend-cloud.md) |
| Daily Levels (PDH PDL ONH ONL) | [`daily-levels.js`](ninjatrader-indicators/daily-levels.js) | [docs](ninjatrader-indicators/daily-levels.md) |
| Trend Pullback Signals (5m) | [`trend-pullback-signals.js`](ninjatrader-indicators/trend-pullback-signals.js) | [docs](ninjatrader-indicators/trend-pullback-signals.md) |
| ExposureTrade - Multi SMA (Daily) | [`multi-sma-daily.js`](ninjatrader-indicators/multi-sma-daily.js) | [docs](ninjatrader-indicators/multi-sma-daily.md) |
| ExposureTrade - TradeBrigade Daily Levels | [`tradebrigade-levels.js`](ninjatrader-indicators/tradebrigade-levels.js) | [docs](ninjatrader-indicators/tradebrigade-levels.md) |

### EMA Trend Cloud

A fast and a slow EMA (9 and 21 by default) with the area between them filled green while the fast EMA is above the slow one and red while it is below. Both cloud colors and the fill opacity are parameters. The color switches on the first bar after a cross.

### Daily Levels (PDH PDL ONH ONL)

Draws the previous day's high and low (regular hours by default) and the overnight high and low, each as a solid ray from the bar that set it to the right edge, labelled next to the price scale. Sessions are in New York time with daylight saving handled, and the trading day rolls over at 18:00 ET like CME futures. The overnight levels build during the overnight session and stay fixed from the 09:30 open. Session times are parameters, and each level has its own color, line style (solid, dotted or dashed) and thickness.

### Trend Pullback Signals (5m)

BUY and SELL arrows for 5-minute charts. A BUY needs the 9 EMA above the 21 EMA with price above VWAP, a pullback that tagged the 9 EMA in the last three bars, and a bullish trigger (engulfing bar, hammer, or strong close above the prior high) that closes back above the 9 EMA. SELL is the mirror image. Candlestick patterns act only as the trigger, since the research linked in the docs found little edge in them alone. Signals are limited to 09:30-15:45 ET by default, and a cooldown stops repeat signals on the same side. The EMAs and VWAP are plotted alongside, and every rule, period and color is a parameter.

Two optional extras are off by default. Reversal signals (`BUY REV` / `SELL REV`, in their own colors) fire on a hammer or engulfing bar that makes a new 10-bar low or high at least 2 ATR beyond VWAP, optionally waiting for the next bar to confirm. Diagnostic mode prints a grey note on every pattern bar that didn't fire, naming the rule that blocked it (`pin: trend`, `engulf: vwap`, `pin 52%: wick`), to help tune the settings.

### ExposureTrade - Multi SMA (Daily)

Port of the TradingView Multi SMA: up to 5 daily SMAs (20, 50, 100 and 200 by default, plus a spare slot) with optional labels right of the last bar. NinjaTrader Web indicators can't request another timeframe, so on intraday charts the indicator builds daily bars from the chart's own bars, one per CME trading day. A 200-day SMA therefore needs 200 trading days of intraday history on the chart. When an SMA doesn't have enough, it is left off and a note at the top of the chart says how many days the chart has. A 5-minute chart on NinjaTrader Web had only 10 days loaded, so each SMA also takes an optional manual value, copied each day from a daily chart, which is drawn as a flat line across the current trading day. On daily charts all five work as normal. A setting chooses whether today's price moves the line during the day or whether it steps once a day. The per-SMA offset from the Pine version is not available.

### ExposureTrade - TradeBrigade Daily Levels

Type up to 7 of the day's levels into the settings, one price per box, and each one is drawn as a full-width horizontal line with its price labelled next to the price scale, like Daily Levels. Each box has its own on/off checkbox, and a box left at 0 draws nothing. Cyan, 2 px and solid by default, with the colour, thickness and line style as settings. The levels can't be pasted as one comma-separated list, because the NinjaTrader Web settings dialog doesn't show text settings and a number box holds a single number.

### Installation

1. In NinjaTrader Web, open Code Explorer.
2. Create a new indicator and replace its contents with the `.js` file.
3. Save it, then add it to a chart from the indicator list.

If a saved indicator doesn't appear in the list, switch NinjaTrader Web to its older version. The newer interface has been failing to list custom and community indicators.

### Writing for the Code Explorer Editor

The Code Explorer editor flagged syntax errors in valid code. Older JavaScript checkers such as JSHint 2.6 and earlier, which code editors often bundle, can't parse `for (const x of list)` loops and report them that way, so the indicators use `forEach` or index loops instead. `EMA-trend-cloud.js`, `multi-sma-daily.js`, `trend-pullback-signals.js` and `tradebrigade-levels.js` pass JSHint 2.5 to 2.13 with no warnings (`esnext` / `esversion: 6`). `daily-levels.js` predates this and still has three `for...of` loops, so the editor may flag it.
