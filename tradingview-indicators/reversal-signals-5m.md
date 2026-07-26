# Reversal Signals (5m) - TradingView Indicator

A Pine Script v6 indicator that scores potential reversal setups on 5-minute data and prints BUY or SELL labels when enough independent conditions line up at once. Every condition can be switched off, and the number required to fire a signal is configurable, so the indicator can be run anywhere between "very talkative" and "rare, high-conviction only".

All inputs are read from the 5-minute timeframe with `request.security()`, so the signals stay based on 5m structure regardless of the chart timeframe.

## How It Works

### 1. Data Source

OHLCV for the current bar and the two prior bars is pulled from the 5-minute timeframe, along with RSI, Stochastic, an EMA, a volume average, and the highest/lowest values used for divergence. Each of these is a separate `request.security()` call.

Default `lookahead` is used with no historical offset, so values for the 5-minute bar currently forming update live. A signal can therefore appear part-way through a bar and vanish again before it closes. Treat a signal as provisional until its 5m bar has closed.

### 2. Confluence Scoring

Two independent counters, `buyScore` and `sellScore`, start at zero on every bar. Each enabled component that agrees adds 1:

| Component | Adds to buyScore when | Adds to sellScore when |
|---|---|---|
| RSI | RSI is at or below the oversold level | RSI is at or above the overbought level |
| Stochastic | %K is below the oversold level **and** %K crosses up through %D | %K is above the overbought level **and** %K crosses down through %D |
| Volume spike | volume exceeds its average by the multiplier | same condition, adds to both sides |
| Engulfing | previous bar red, current bar green and engulfing it | previous bar green, current bar red and engulfing it |
| Pin bar | lower wick longer than body by the ratio, upper wick shorter than body | upper wick longer than body by the ratio, lower wick shorter than body |
| RSI divergence | price makes a lower low over the lookback while RSI makes a higher low | price makes a higher high while RSI makes a lower high |

The maximum score is 6 with everything enabled.

Volume is deliberately direction-neutral: a spike raises both scores equally, acting as a general "something is happening here" weight rather than a directional vote. If you would rather it not tip marginal setups over the threshold in both directions, switch **Require Volume Spike** off.

### 3. Divergence Detection

Divergence compares the extreme of the last `divLookback` bars against the extreme of the `divLookback` bars before that:

```
bullish: lowest(low, N) < lowest(low, N)[N]   and   lowest(rsi, N) > lowest(rsi, N)[N]
```

This is a block-to-block comparison of two adjacent windows, not pivot-based divergence, so it is cheap and always available but coarser than drawing divergence by hand. Longer lookbacks find bigger, slower divergences.

### 4. Trend Filter

**EMA Trend Filter** is off by default. When on, signals are only allowed with the trend:

- BUY requires the 5m close at or above the EMA.
- SELL requires the 5m close at or below the EMA.

This suppresses counter-trend reversals, which cuts signal count substantially. The EMA is only plotted when the filter is enabled.

### 5. Signal Firing and Duplicate Suppression

A signal fires when its score reaches **Min Confluence Score** and the trend filter allows it. The last fired direction is remembered, and a signal in the same direction as the previous one is suppressed. So the output alternates BUY, SELL, BUY, SELL rather than stacking five BUYs down a move.

### 6. Display

- **Labels** below the bar for BUY, above the bar for SELL, optionally showing the confluence score that triggered them.
- **Background flash** tinted in the signal color on the signal bar.
- **Info table** in the bottom-right with the live RSI, Stochastic %K, whether volume is spiking, both scores, and the current threshold. Values are colored when they are in a signalling state, which makes it easy to see which component is missing when a setup nearly fires.
- **EMA line** in orange, only when the trend filter is on.

### 7. Alerts

Two alert conditions:

- **"BUY Reversal Signal"** - a bullish setup cleared the threshold.
- **"SELL Reversal Signal"** - a bearish setup cleared the threshold.

Create the alert in TradingView and pick the condition from this indicator. Because values update intrabar, set the alert to trigger **Once Per Bar Close** if you want confirmed signals only.

## Settings

### Confluence Filters

| Setting | Default | Range | Description |
|---|---|---|---|
| Use RSI | on | on/off | Include the RSI oversold/overbought vote. |
| RSI Length | 14 | 2-50 | RSI period. |
| RSI Overbought | 70 | 60-90 | Level at or above which a sell vote is added. |
| RSI Oversold | 30 | 10-40 | Level at or below which a buy vote is added. |
| Use Stochastic | on | on/off | Include the Stochastic crossover vote. |
| Stoch %K Length | 14 | 2-50 | Lookback for the raw Stochastic. |
| Stoch %K Smooth | 3 | 1-10 | Smoothing applied to raw %K. |
| Stoch %D Smooth | 3 | 1-10 | Smoothing of %K to produce %D. |
| Stoch Overbought | 80 | 60-95 | %K level above which a bearish cross counts. |
| Stoch Oversold | 20 | 5-40 | %K level below which a bullish cross counts. |
| Require Volume Spike | on | on/off | Include the volume vote. Adds to both scores when it fires. |
| Volume Spike Multiplier | 1.5 | 1.0-5.0 | How far above average volume must be to count. |
| Volume Average Length | 20 | 5-100 | Period of the volume average. |

### Price Structure

| Setting | Default | Range | Description |
|---|---|---|---|
| Engulfing Candles | on | on/off | Include engulfing pattern detection. |
| Pin Bars / Hammers | on | on/off | Include pin bar detection. |
| Pin Bar Wick:Body Ratio | 2.0 | 1.5-5.0 | How many times the body the wick must be. Higher is stricter. |
| RSI Divergence | on | on/off | Include divergence detection. |
| Divergence Lookback Bars | 10 | 3-30 | Size of each of the two windows compared. |

### Trend Context

| Setting | Default | Range | Description |
|---|---|---|---|
| EMA Trend Filter | off | on/off | Restrict signals to the direction of the EMA. |
| EMA Length | 50 | 10-200 | EMA period on 5m data. |

### Visual

| Setting | Default | Range | Description |
|---|---|---|---|
| Min Confluence Score to Signal | 2 | 1-5 | Votes required to fire. Raise it to cut noise. |
| Show Confluence Score | on | on/off | Print the score inside the signal label. |
| BUY Signal Color | lime | any color | Label and background tint for buys. |
| SELL Signal Color | red | any color | Label and background tint for sells. |

## Usage Tips

- **Run it on a 5m chart.** The data is 5m regardless, but labels are drawn at chart bars, so on a 1h chart several 5m signals collapse into one bar and the picture gets misleading. On charts below 5m the labels repeat while the same 5m bar is forming.
- **Start at Min Confluence 2, then raise it.** At 2 you will get frequent signals, many of them noise. At 3 or 4 the count drops sharply and what survives tends to be at a level worth looking at.
- **Turn the volume vote off first** if you are tuning for precision, since it is the one component that pushes both directions at once.
- **Use the info table to tune.** Watch which values are colored when you see a reversal you wanted to catch, and enable or loosen whichever component stayed silent.
- **Reversal signals want context.** The indicator has no idea whether price is at a level. Pairing it with the S/R Zones indicator in this repo, and only acting on signals inside a zone, filters out most of the pointless ones.

## Notes and Limitations

- **Intrabar repainting.** Signals on the forming 5m bar can appear and disappear. Alerts set to Once Per Bar will fire on provisional signals; use Once Per Bar Close for confirmed ones.
- **Volume is bidirectional**, as described above. This is by design but is easy to misread as a bug.
- **Exact dojis never register as pin bars.** The pin bar test requires the opposite wick to be shorter than the body, which is impossible when the body is zero. Bars with a very small but non-zero body do qualify.
- **Divergence is window-based**, not pivot-based, so it will flag some divergences a discretionary trader would not draw, and miss some they would.
- **Duplicate suppression is directional only.** After a BUY, the next BUY is blocked until a SELL fires, however long that takes.

## Installation

1. Open TradingView and navigate to the Pine Editor (bottom panel).
2. Click "Open" > "New blank indicator".
3. Delete any existing code and paste the contents of `reversal-signals-5m.pine`.
4. Click "Save" and give it a name.
5. Click "Add to chart".
