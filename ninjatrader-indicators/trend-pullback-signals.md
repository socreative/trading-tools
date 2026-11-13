# Trend Pullback Signals (5m)

NinjaTrader Web custom indicator, JavaScript.

Marks BUY and SELL setups on a 5-minute chart. A BUY needs an uptrend, a pullback that tags the fast EMA, a bullish candlestick trigger and a close back above the fast EMA, all on the same bar. SELL is the mirror image. Each signal is drawn as an arrow with a label: green and below the bar for BUY, red and above the bar for SELL. The indicator also plots the fast EMA, slow EMA and VWAP that the rules are built on, so you can see why a signal fired.

Two optional extras are off by default:

- **Reversal signals** (`BUY REV` / `SELL REV`) catch hammers and engulfing bars at the end of a stretched move, against the trend. See [Reversal Signals](#reversal-signals).
- **Diagnostic mode** prints a short grey note on every pattern bar that didn't fire, naming the rule that blocked it. See [Diagnostic Mode](#diagnostic-mode).

## Why These Rules

The starting idea was candlestick patterns. The research on patterns alone is discouraging:

- Fock, Klein and Zwergel (2005, Journal of Derivatives) tested candlestick patterns on intraday DAX and Bund futures and found no predictive power, whether the patterns were used alone or combined with momentum indicators.
- A backtest of 24 patterns across about 5,000 US stocks found that hammers and engulfing bars added nothing once the trend direction was known. The trend filter was doing the work.

So here the pattern is the trigger, and the trend and pullback decide whether it counts. A hammer in the middle of a range does nothing. A hammer that rejects the fast EMA during an uptrend, above VWAP, fires a BUY.

There is no published backtest of this exact rule set, and none has been run on real market data for this indicator. Treat a signal as a setup worth looking at, not as an order.

The 5-minute opening range breakout was the best-documented alternative (Zarattini and Aziz, 2023, on QQQ), although an independent replication on index CFDs found its edge disappeared after trading costs.

Sources: [Fock et al. summary](https://improbable.com/2015/06/28/fock-performance-of-candlestick-analysis/), [24-pattern stock backtest](https://quanta72.substack.com/p/do-candlestick-patterns-work-a-backtest), [Zarattini and Aziz](https://papers.ssrn.com/abstract=4416622), [ORB replication](https://www.mql5.com/en/blogs/post/776235).

## How It Works

Every rule is checked on every bar, using that bar's own open, high, low and close.

### 1. Trend

BUY needs the fast EMA (9) above the slow EMA (21) and the close above VWAP. SELL needs the fast EMA below the slow EMA and the close below VWAP. Turn **useVwap** off to use the EMAs alone.

### 2. Pullback

At least one bar in the last **pullbackBars** bars (3 by default, the current bar included) must have reached the fast EMA. For a BUY that means a low at or below the fast EMA, with a small allowance of **touchTolerance** times the ATR (0.1 ATR by default) so a near miss still counts. For a SELL it means a high at or above the fast EMA, less the same allowance.

### 3. Trigger

The current bar must match at least one enabled pattern:

| Trigger | BUY | SELL |
|---|---|---|
| Engulfing | Prior bar red, this bar green, and this bar's body covers the prior body | Prior bar green, this bar red, and this bar's body covers the prior body |
| Pin bar | Lower wick is at least **pinWickPct** (60%) of the bar's range | Upper wick is at least **pinWickPct** of the range |
| Strong close | Green bar closing above the prior bar's high, in the top third of its own range | Red bar closing below the prior bar's low, in the bottom third of its range |

The pin bar test is measured against the bar's full range, not its body, so a hammer with a doji body still counts. When a bar matches several triggers, the label names the first in the order above.

### 4. Reclaim

The close must be back on the trend side of the fast EMA: above it for a BUY, below it for a SELL. A bar that tags the EMA and closes beyond it in the wrong direction is a failed pullback, not a signal.

### 5. Session Window

Signals only fire on bars that open between **sessionStart** and **sessionEnd**, New York time (09:30 to 15:45 by default). The last 15 minutes are left out because setups there have little time left to work. Times are entered as HHMM numbers, and a window that runs past midnight, such as 1800 to 400, works too. Turn **useSession** off to allow signals around the clock.

New York time has US daylight saving built in, using the same conversion as the Daily Levels indicator.

### 6. Cooldown

After a BUY, no further BUY can fire for **cooldownBars** bars (6 by default, which is 30 minutes on a 5-minute chart). The same goes for SELL. Trend and reversal signals share the cooldown, so a `BUY REV` also blocks a trend `BUY` for the next 6 bars. A signal on the other side is never blocked, so a BUY can be followed straight away by a SELL if the trend flips.

### 7. VWAP

VWAP is volume-weighted typical price, the same weighting as the platform's built-in VWAP (it uses the bar's volume profile when the chart provides one). **vwapAnchor** sets when it resets:

- **Regular-hours open (RTH)**, the default, resets at **rthStart** (09:30 ET) each day. After the close it keeps accumulating until the next open, and a session that starts on a Sunday evening begins a fresh VWAP.
- **Trading day start (ETH)** resets at 18:00 ET, the CME trading-day rollover. This matches the built-in VWAP on CME futures.

### 8. Warm-up

Nothing fires until both EMAs and the ATR have a full period of data. The EMAs use the same warm-up as NinjaTrader's EMA: a running average for the first period bars, then the exponential formula. The lines match the built-in EMA for the same period, and the ATR uses Wilder's smoothing.

### 9. Drawing

On a signal bar the indicator returns two Graphics API items tied to that bar:

- a filled triangle, 6 px clear of the bar, pointing up from under the low for a BUY or down from over the high for a SELL
- a bold text label beyond the triangle: `BUY` or `SELL`, or with the trigger added (`BUY engulf`, `SELL pin`, `BUY close`) when **showTriggerName** is on

The pixel offsets keep the gap between the bar and its arrow fixed at any zoom level.

### 10. Live Bars

The forming bar is recalculated on every update, so a signal can appear partway through a bar and disappear again before it closes. A signal is only final once its bar has closed.

Every running value (both EMAs, the ATR, the VWAP sums, reversal setups and the last signal on each side) is stored per bar and built from the previous bar's stored value. Recalculating the forming bar a hundred times gives the same result as calculating it once, and a signal that showed up intrabar and then vanished does not trigger the cooldown.

## Reversal Signals

Turn on **useReversals** to add counter-trend signals. They are drawn in their own colors (teal for `BUY REV`, orange for `SELL REV`) so you can judge them separately from the trend signals.

Reversal patterns have the weakest evidence of anything here. On a strong down day, hammers keep printing and failing all the way down. These signals ignore the trend rules entirely, so the only thing standing between a hammer and a `BUY REV` is the context filters below.

A `BUY REV` setup is a bar where all of these hold:

1. **Pattern:** a hammer (pin bar) or a bullish engulfing bar, using the same definitions, toggles and **pinWickPct** as the trend triggers. The strong close trigger is not used for reversals.
2. **Stretched:** the pattern's low is at least **revStretchAtr** ATRs below VWAP (2 by default). The pattern's low is the lower of this bar's low and the previous bar's, so an engulfing bar counts the low of the bar it engulfs.
3. **New low:** nothing in the last **revLookback** bars (10 by default, the pattern bars included) traded lower. This keeps the signal to the end of a move rather than a pause in the middle of it.

With **revConfirm** on (the default), the setup bar itself doesn't fire. The `BUY REV` appears on the next bar, and only if that bar closes above the setup bar's high. That cuts out many hammers that fail straight away, at the cost of entering one bar later. With **revConfirm** off, the signal fires on the setup bar.

`SELL REV` is the mirror image: a shooting star or bearish engulfing bar, stretched above VWAP, at a new high, confirmed by a close below the setup bar's low.

Reversal signals respect the session window (the bar where the arrow appears must be inside it) and the shared cooldown. The stretch is always measured from VWAP, even when **useVwap** is off for the trend signals.

## Diagnostic Mode

Turn on **showBlocked** when you want to know why a candle you expected to fire didn't. Every bar that matches an enabled pattern without producing a signal gets a small grey note on the side its arrow would have gone. The note names the pattern and the first rule that blocked it, such as:

| Note | Meaning |
|---|---|
| `pin: trend` | A hammer, but the fast EMA is not above the slow EMA |
| `engulf: vwap` | A bullish engulfing bar that closed below VWAP |
| `close: no pullback` | A strong close, but no bar in the last `pullbackBars` reached the fast EMA |
| `pin: no reclaim` | A hammer that closed below the fast EMA |
| `engulf: cooldown` | Every rule passed, but a BUY fired in the last `cooldownBars` bars |
| `pin 52%: wick` | Every rule passed, but the lower wick is 52% of the range, short of `pinWickPct` |

The trend rules are checked in that order (trend, VWAP, pullback, reclaim, cooldown), and the note shows only the first failure. Fix that one and the next one may show up.

Bars whose signal-side wick comes within 10 percentage points of **pinWickPct** are flagged as near-miss hammers, with the wick size in the note, such as `pin 52%`. A note ending in `: wick` means setting **pinWickPct** at or below that number would have produced a signal.

With reversals on, the note adds the reversal result after `rev`:

| Addition | Meaning |
|---|---|
| `rev stretch` | Not far enough from VWAP |
| `rev not low` / `rev not high` | Something in the last `revLookback` bars went further |
| `rev setup` | A valid reversal setup, waiting for the next bar to confirm. No `BUY REV` on the next bar means it closed below this bar's high. |
| `rev cooldown` | A valid reversal blocked by the cooldown |

A bar that confirmed a reversal but was blocked by the cooldown shows `rev confirm: cooldown`.

Notes cycle through three rows below (or above) the bars, so neighbouring notes don't print on top of each other. Even so, most bars on a 5-minute chart match some pattern, so the chart gets busy. Zoom in on the bars you are investigating, and switch the mode off again when you are done. No notes are drawn outside the session window or during warm-up.

## Settings

| Setting | Default | Description |
|---|---|---|
| fastPeriod | 9 | Fast EMA period. Used for the trend, the pullback and the reclaim. |
| slowPeriod | 21 | Slow EMA period. Used for the trend. |
| useVwap | on | Requires the close above VWAP for BUY and below it for SELL. |
| vwapAnchor | Regular-hours open (RTH) | When VWAP resets: the RTH open, or the 18:00 ET trading-day start. |
| rthStart | 930 | RTH open in New York time, HHMM. Used by the RTH VWAP anchor. |
| atrPeriod | 14 | ATR period, used to scale the touch tolerance. |
| pullbackBars | 3 | How many recent bars, the current one included, are checked for a touch of the fast EMA. |
| touchTolerance | 0.1 | How close to the fast EMA counts as a touch, as a multiple of ATR. 0 requires an actual touch. |
| useEngulfing | on | Enables the engulfing trigger. |
| usePinBar | on | Enables the pin bar / hammer trigger. |
| pinWickPct | 60 | Minimum wick as a percentage of the bar's range for a pin bar (30-95). |
| useStrongClose | on | Enables the strong close trigger. |
| useReversals | off | Adds `BUY REV` / `SELL REV` counter-trend signals. |
| revStretchAtr | 2 | How far the reversal pattern's low (high) must be beyond VWAP, in ATRs. |
| revLookback | 10 | Bars, the pattern included, in which the reversal must be the lowest low (highest high). |
| revConfirm | on | Waits for the next bar to close beyond the setup bar before firing a reversal. |
| useSession | on | Limits signals to the session window. |
| sessionStart | 930 | Session window start, New York time, HHMM. |
| sessionEnd | 1545 | Session window end, New York time, HHMM. Bars opening at this time or later are excluded. |
| cooldownBars | 6 | Bars after a signal during which another signal on the same side is blocked. 0 turns it off. |
| showLines | on | Plots the fast EMA, slow EMA and VWAP. Off leaves only the signals. |
| showLabels | on | Shows the BUY / SELL text next to each arrow. |
| showTriggerName | off | Adds the trigger to the label, such as `BUY engulf` or `BUY REV pin`. |
| showBlocked | off | Diagnostic mode: grey notes on pattern bars that didn't fire. |
| buyColor | `#22c55e` (green) | BUY arrow and label color. |
| sellColor | `#ef4444` (red) | SELL arrow and label color. |
| revBuyColor | `#14b8a6` (teal) | BUY REV arrow and label color. |
| revSellColor | `#f97316` (orange) | SELL REV arrow and label color. |
| blockedColor | `#9ca3af` (grey) | Diagnostic note color. |
| markerSize | 8 | Arrow half-width in pixels. The arrow is 1.5 times as tall. |

Line colors and widths for **Fast EMA**, **Slow EMA** and **VWAP** are in the indicator's style section. Defaults on the dark theme are light blue and amber at 1 px for the EMAs (the same colors as EMA Trend Cloud) and purple at 2 px for VWAP.

The defaults suit equity index futures (ES, NQ, YM, RTY). For crude oil, for example, set `rthStart` and `sessionStart` to `900` and `sessionEnd` to `1415`.

### Tuning

- **A candle you expected to fire didn't:** turn on `showBlocked` and read its note.
- **Hammers missed because the wick was a little short:** the note reads like `pin 52%: wick`. Lower `pinWickPct` to 50 or 55.
- **Too many reversal signals:** raise `revStretchAtr` to 2.5 or 3, or raise `revLookback` so only bigger moves qualify.
- **Too many signals:** raise `cooldownBars`, turn off the strong close trigger (it fires the most often), or set `touchTolerance` to 0 so only real touches of the EMA count.
- **Missing pullbacks you would have taken:** raise `pullbackBars` to 4 or 5, or raise `touchTolerance` so pullbacks that stop just short of the EMA count.
- **Slower trend definition:** use 20 and 50 for the EMAs. Signals become rarer and the pullbacks deeper.
- **Skipping the open:** set `sessionStart` to `945` or `1000` to let the opening volatility settle first.

On synthetic random-walk data with the default settings, the indicator produced roughly six or seven trend signals per regular session, and about one reversal signal per session with reversals switched on. Real markets will differ, with fewer in choppy sessions, where the EMAs keep crossing, and more on clean trend days.

## Installation

1. In NinjaTrader Web, open **Code Explorer**.
2. Create a new indicator and replace its contents with `trend-pullback-signals.js`.
3. Save it, then add **Trend Pullback Signals (5m)** to a 5-minute chart.

If it doesn't appear in the indicator list, switch to the older web version. The newer interface has been failing to list custom indicators.

## Limitations

- **Signals can repaint on the forming bar.** See Live Bars above. Wait for the bar to close before acting on a signal.
- **Built for 5-minute charts.** The rules work on any intraday timeframe, but the defaults (cooldown, pullback window, session end) assume 5-minute bars. Daily, weekly and monthly charts draw nothing.
- **No alerts.** The indicator only draws on the chart.
- **No stop or target.** The indicator only marks entries.
- **Labels can overlap** when signals on opposite sides land on neighbouring bars.
- **Diagnostic notes are busy.** See Diagnostic Mode above. At normal zoom, notes on bars in the same row can still run into each other.
- **Testing.** Tested with synthetic 5-minute bars on the CME schedule, including the November 2026 DST change. The EMAs matched NinjaTrader's own `tools/EMA.js` on every bar, the ATR matched a Wilder reference, and VWAP matched an independent New York time calculation for both anchors. Hand-built BUY and SELL scenarios fired on the expected bar for each trigger, and stayed silent when the trend, VWAP, session, pullback window or cooldown should block them. The same goes for reversal scenarios (hammer and engulfing, with and without confirmation, failed confirmation, too little stretch, a higher low, shared cooldown) and for every diagnostic note listed above. Feeding every bar four tick updates gave exactly the same output as one update, with reversals and diagnostics on or off. The arrows, labels and notes have not yet been checked on a live NinjaTrader Web chart.
