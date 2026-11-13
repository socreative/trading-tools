/*
 * Trend Pullback Signals (5m) - NinjaTrader Web custom indicator
 *
 * Marks BUY and SELL setups where a candlestick trigger lines up with the trend
 * and a pullback. For a BUY, all of these hold on the same bar:
 *   Trend:    fast EMA above slow EMA, and close above VWAP
 *   Pullback: a low in the last few bars touched the fast EMA
 *   Trigger:  bullish engulfing, pin bar / hammer, or a strong close above the prior high
 *   Reclaim:  close above the fast EMA
 * SELL is the mirror image. Signals are limited to a New York session window,
 * and a same-side signal is blocked for a cooldown period after each one.
 *
 * Optional reversal signals (BUY REV / SELL REV) fire on a hammer or engulfing
 * bar that makes a new low (high) while stretched far from VWAP, optionally
 * waiting for the next bar to confirm. An optional diagnostic mode labels every
 * pattern bar that did not fire with the rule that blocked it.
 *
 * Every running value is stored per bar index and built from the previous bar's
 * stored value, so recalculating the forming bar on each tick gives the same
 * result as calculating it once.
 */

const predef = require("./tools/predef");
const meta = require("./tools/meta");
const { du, px, op } = require("./tools/graphics");

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const ETH_ROLLOVER = 18 * 60; // 18:00 ET, start of the CME trading day
const MIN_KEPT_BARS = 500;
const MARKER_GAP = 6; // pixels between the bar and its arrow or note
const NEAR_PIN_MARGIN = 0.1; // diagnostics flag wicks within 10 points of pinWickPct
const NOTE_ROWS = 3; // diagnostic notes cycle through this many rows so neighbouring notes don't overprint
const NOTE_ROW_HEIGHT = 11; // pixels

const SIDES = ["buy", "sell"];
const TREND_PATTERNS = ["engulf", "pin", "strong"];
const REVERSAL_PATTERNS = ["engulf", "pin"];
const PATTERN_NAMES = { engulf: "engulf", pin: "pin", strong: "close" };
const PATTERN_TOGGLES = { engulf: "useEngulfing", pin: "usePinBar", strong: "useStrongClose" };

// US Eastern DST runs from the second Sunday of March at 02:00 local (07:00 UTC)
// to the first Sunday of November at 02:00 local (06:00 UTC).
const dstCache = {};
function dstRange(year) {
    if (!dstCache[year]) {
        const nthSunday = (month, n) => {
            const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
            return 1 + ((7 - firstWeekday) % 7) + (n - 1) * 7;
        };
        dstCache[year] = {
            start: Date.UTC(year, 2, nthSunday(2, 2), 7),
            end: Date.UTC(year, 10, nthSunday(10, 1), 6)
        };
    }
    return dstCache[year];
}

// Epoch milliseconds shifted to New York wall-clock time.
function toNewYorkMs(utcMs) {
    const { start, end } = dstRange(new Date(utcMs).getUTCFullYear());
    const offsetHours = utcMs >= start && utcMs < end ? -4 : -5;
    return utcMs + offsetHours * 60 * MINUTE;
}

// 930 -> 570 minutes after midnight
function hhmmToMinutes(hhmm) {
    return Math.floor(hhmm / 100) * 60 + (hhmm % 100);
}

function inWindow(minute, start, end) {
    return start <= end ?
        minute >= start && minute < end :
        minute >= start || minute < end; // window that wraps past midnight
}

// One step of an exponential average with the same warm-up as NinjaTrader's
// ./tools/EMA: a running mean for the first `period` values, then exponential.
function nextAverage(prev, value, period, alpha) {
    if (!prev || prev.count < period) {
        const sum = (prev ? prev.sum : 0) + value;
        const count = (prev ? prev.count : 0) + 1;
        return { avg: sum / count, sum, count };
    }
    return { avg: prev.avg + alpha * (value - prev.avg), sum: prev.sum, count: prev.count + 1 };
}

function trueRange(bar, prev) {
    if (!prev) {
        return bar.high - bar.low;
    }
    return Math.max(bar.high, prev.close) - Math.min(bar.low, prev.close);
}

// Share of the bar's range taken by the wick on the signal side: the lower wick for a BUY.
function wickShare(side, bar) {
    const range = bar.high - bar.low;
    if (range <= 0) {
        return 0;
    }
    const wick = side === "buy" ?
        Math.min(bar.open, bar.close) - bar.low :
        bar.high - Math.max(bar.open, bar.close);
    return wick / range;
}

class trendPullbackSignals {
    init() {
        const p = this.props;
        const chart = this.chartDescription;
        this.enabled = !(chart && chart.underlyingType === "DailyBar");
        this.rthStart = hhmmToMinutes(p.rthStart);
        this.sessionStart = hhmmToMinutes(p.sessionStart);
        this.sessionEnd = hhmmToMinutes(p.sessionEnd);
        this.vwapAnchor = p.vwapAnchor === "eth" ? ETH_ROLLOVER : this.rthStart;
        this.keptBars = Math.max(MIN_KEPT_BARS, p.cooldownBars + p.pullbackBars + p.revLookback + 3);
        this.bars = {};
    }

    map(d) {
        if (!this.enabled) {
            return {};
        }

        const index = d.index();
        const prev = this.bars[index - 1];
        const bar = this.computeBar(d, prev);
        this.bars[index] = bar;
        delete this.bars[index - this.keptBars];

        const { signals, notes } = this.evaluate(index, bar, prev);
        bar.signals = {};
        signals.forEach(signal => {
            bar.signals[signal.side] = signal.kind;
        });

        const p = this.props;
        const result = {};
        if (p.showLines) {
            if (bar.fast.count >= p.fastPeriod) {
                result.fast = bar.fast.avg;
            }
            if (bar.slow.count >= p.slowPeriod) {
                result.slow = bar.slow.avg;
            }
            if (bar.vwap !== undefined) {
                result.vwap = bar.vwap;
            }
        }
        let items = [];
        signals.forEach(signal => {
            items = items.concat(this.drawSignal(index, bar, signal));
        });
        notes.forEach(note => {
            items.push(this.drawNote(index, bar, note));
        });
        if (items.length) {
            result.graphics = { items };
        }
        return result;
    }

    computeBar(d, prev) {
        const p = this.props;
        const bar = {
            open: d.open(),
            high: d.high(),
            low: d.low(),
            close: d.close()
        };

        const nyMs = toNewYorkMs(d.timestamp().getTime());
        bar.minute = Math.floor((nyMs % DAY) / MINUTE);

        bar.fast = nextAverage(prev && prev.fast, bar.close, p.fastPeriod, 2 / (p.fastPeriod + 1));
        bar.slow = nextAverage(prev && prev.slow, bar.close, p.slowPeriod, 2 / (p.slowPeriod + 1));
        bar.atr = nextAverage(prev && prev.atr, trueRange(bar, prev), p.atrPeriod, 1 / p.atrPeriod);

        // VWAP resets whenever a bar falls in a new anchor period (from one anchor time to the next).
        bar.vwapPeriod = Math.floor((nyMs - this.vwapAnchor * MINUTE) / DAY);
        const carry = prev && prev.vwapPeriod === bar.vwapPeriod;
        bar.cumValue = carry ? prev.cumValue : 0;
        bar.cumVolume = carry ? prev.cumVolume : 0;
        // Same volume weighting as the platform's built-in VWAP.
        const profile = typeof d.profile === "function" ? d.profile() : undefined;
        if (profile && profile.length) {
            for (let i = 0; i < profile.length; ++i) {
                bar.cumVolume += profile[i].vol;
                bar.cumValue += profile[i].vol * profile[i].price;
            }
        }
        else {
            const volume = d.volume();
            bar.cumVolume += volume;
            bar.cumValue += volume * (bar.high + bar.low + bar.close) / 3;
        }
        bar.vwap = bar.cumVolume > 0 ? bar.cumValue / bar.cumVolume : undefined;
        return bar;
    }

    // Signals that fire on this bar, plus diagnostic notes for pattern bars that did not.
    evaluate(index, bar, prev) {
        const p = this.props;
        const signals = [];
        const notes = [];
        bar.revSetup = {};
        if (!prev ||
            bar.fast.count < p.fastPeriod ||
            bar.slow.count < p.slowPeriod ||
            bar.atr.count < p.atrPeriod) {
            return { signals, notes };
        }
        const inSession = !p.useSession || inWindow(bar.minute, this.sessionStart, this.sessionEnd);

        for (let s = 0; s < SIDES.length; ++s) {
            const side = SIDES[s];
            // A valid reversal setup is stored even outside the session, for the next bar to confirm.
            const revPattern = p.useReversals ? this.pattern(side, bar, prev, REVERSAL_PATTERNS) : undefined;
            const revReason = p.useReversals ? this.reversalBlock(side, index, bar, prev) : undefined;
            if (revPattern && !revReason) {
                bar.revSetup[side] = revPattern;
            }
            if (!inSession) {
                continue;
            }

            const cooled = this.cooledDown(index, side);
            const trendPattern = this.pattern(side, bar, prev, TREND_PATTERNS);
            const trendReason = this.trendBlock(side, index, bar) || (cooled ? undefined : "cooldown");
            if (trendPattern && !trendReason) {
                signals.push({ side, kind: "trend", trigger: trendPattern });
                continue;
            }

            let confirmBlocked = false;
            if (p.useReversals) {
                // With confirmation the setup is the previous bar and this bar must close beyond it.
                const setup = p.revConfirm ?
                    prev.revSetup && prev.revSetup[side] :
                    bar.revSetup[side];
                if (setup && (!p.revConfirm || this.confirms(side, bar, prev))) {
                    if (cooled) {
                        signals.push({ side, kind: "reversal", trigger: setup });
                        continue;
                    }
                    confirmBlocked = p.revConfirm;
                }
            }

            if (p.showBlocked) {
                const text = this.blockedNote(side, bar, {
                    trendPattern, trendReason, revPattern, revReason, cooled, confirmBlocked
                });
                if (text) {
                    notes.push({ side, text });
                }
            }
        }
        return { signals, notes };
    }

    // First failing trend rule for this side, or undefined when trend, VWAP, pullback and reclaim all pass.
    trendBlock(side, index, bar) {
        const p = this.props;
        const buy = side === "buy";
        const fast = bar.fast.avg;
        if (buy ? fast <= bar.slow.avg : fast >= bar.slow.avg) {
            return "trend";
        }
        if (p.useVwap && (bar.vwap === undefined || (buy ? bar.close <= bar.vwap : bar.close >= bar.vwap))) {
            return "vwap";
        }
        const tolerance = p.touchTolerance * bar.atr.avg;
        const touched = buy ?
            b => b.low <= b.fast.avg + tolerance :
            b => b.high >= b.fast.avg - tolerance;
        if (!this.touchedFastEma(index, touched)) {
            return "no pullback";
        }
        if (buy ? bar.close <= fast : bar.close >= fast) {
            return "no reclaim";
        }
        return undefined;
    }

    // True if any of the last `pullbackBars` bars (this one included) passes the touch test.
    touchedFastEma(index, touched) {
        for (let k = 0; k < this.props.pullbackBars; ++k) {
            const b = this.bars[index - k];
            if (b && touched(b)) {
                return true;
            }
        }
        return false;
    }

    // First failing reversal rule for this side, or undefined. The pattern's extreme is the
    // lower low (higher high) of this bar and the one before, so an engulfing bar counts the
    // low of the bar it engulfs.
    reversalBlock(side, index, bar, prev) {
        const p = this.props;
        const buy = side === "buy";
        const extreme = buy ? Math.min(bar.low, prev.low) : Math.max(bar.high, prev.high);
        const stretch = bar.vwap === undefined ? -Infinity : buy ? bar.vwap - extreme : extreme - bar.vwap;
        if (stretch < p.revStretchAtr * bar.atr.avg) {
            return "stretch";
        }
        for (let k = 2; k < p.revLookback; ++k) {
            const b = this.bars[index - k];
            if (b && (buy ? b.low < extreme : b.high > extreme)) {
                return buy ? "not low" : "not high";
            }
        }
        return undefined;
    }

    confirms(side, bar, setupBar) {
        return side === "buy" ? bar.close > setupBar.high : bar.close < setupBar.low;
    }

    cooledDown(index, side) {
        for (let k = 1; k <= this.props.cooldownBars; ++k) {
            const earlier = this.bars[index - k];
            if (earlier && earlier.signals && earlier.signals[side]) {
                return false;
            }
        }
        return true;
    }

    // First pattern from `kinds` that is switched on and that the bar matches, or undefined.
    pattern(side, bar, prev, kinds) {
        for (let i = 0; i < kinds.length; ++i) {
            const kind = kinds[i];
            if (this.props[PATTERN_TOGGLES[kind]] && this.matches(kind, side, bar, prev)) {
                return kind;
            }
        }
        return undefined;
    }

    matches(kind, side, bar, prev) {
        const range = bar.high - bar.low;
        const buy = side === "buy";
        if (kind === "engulf") {
            return buy ?
                prev.close < prev.open && bar.close > bar.open && bar.open <= prev.close && bar.close >= prev.open :
                prev.close > prev.open && bar.close < bar.open && bar.open >= prev.close && bar.close <= prev.open;
        }
        if (kind === "pin") {
            return range > 0 && wickShare(side, bar) >= this.props.pinWickPct / 100;
        }
        if (kind === "strong") {
            return range > 0 && (buy ?
                bar.close > bar.open && bar.close > prev.high && bar.close - bar.low >= range * 2 / 3 :
                bar.close < bar.open && bar.close < prev.low && bar.high - bar.close >= range * 2 / 3);
        }
        return false;
    }

    // Diagnostic text such as "pin: trend, rev stretch", or undefined when there is nothing to explain.
    blockedNote(side, bar, ctx) {
        const p = this.props;
        let patternName = ctx.trendPattern && PATTERN_NAMES[ctx.trendPattern];
        let trend = ctx.trendReason;
        let rev;
        if (ctx.revPattern) {
            rev = ctx.revReason || (p.revConfirm ? "setup" : "cooldown");
        }
        // A wick just short of pinWickPct: name it with its size so the threshold is visible.
        if (!patternName && p.usePinBar) {
            const share = wickShare(side, bar);
            if (share >= Math.max(0.3, p.pinWickPct / 100 - NEAR_PIN_MARGIN)) {
                patternName = "pin " + Math.round(share * 100) + "%";
                trend = trend || "wick";
                if (p.useReversals) {
                    rev = ctx.revReason || "wick";
                }
            }
        }
        const parts = [];
        if (patternName) {
            parts.push(patternName + ": " + trend + (rev && rev !== trend ? ", rev " + rev : ""));
        }
        if (ctx.confirmBlocked) {
            parts.push("rev confirm: cooldown");
        }
        return parts.length ? parts.join("; ") : undefined;
    }

    // BUY: arrow pointing up under the low, label below it. SELL: mirrored above the high.
    // On screen, adding pixels moves down and subtracting moves up.
    drawSignal(index, bar, signal) {
        const p = this.props;
        const buy = signal.side === "buy";
        const reversal = signal.kind === "reversal";
        const color = reversal ?
            (buy ? p.revBuyColor : p.revSellColor) :
            (buy ? p.buyColor : p.sellColor);
        const dir = buy ? "+" : "-";
        const anchor = du(buy ? bar.low : bar.high);
        const at = pixels => op(anchor, dir, px(pixels));
        const halfWidth = p.markerSize;
        const height = Math.round(p.markerSize * 1.5);
        const x = du(index);

        const items = [{
            tag: "Shapes",
            key: "arrow-" + signal.side,
            primitives: [{
                tag: "Polygon",
                points: [
                    { x, y: at(MARKER_GAP) },
                    { x: op(x, "+", px(halfWidth)), y: at(MARKER_GAP + height) },
                    { x: op(x, "-", px(halfWidth)), y: at(MARKER_GAP + height) }
                ]
            }],
            fillStyle: { color }
        }];

        if (p.showLabels) {
            const text = (buy ? "BUY" : "SELL") +
                (reversal ? " REV" : "") +
                (p.showTriggerName ? " " + PATTERN_NAMES[signal.trigger] : "");
            items.push({
                tag: "Text",
                key: "label-" + signal.side,
                point: { x, y: at(MARKER_GAP + height + 3) },
                text,
                style: { fontSize: 11, fontWeight: "bold", fill: color },
                textAlignment: buy ? "centerBelow" : "centerAbove"
            });
        }
        return items;
    }

    // Grey note on the same side of the bar that its arrow would have used. Consecutive bars
    // use different rows, so a note only shares its row with every third bar.
    drawNote(index, bar, note) {
        const buy = note.side === "buy";
        const offset = MARKER_GAP + (index % NOTE_ROWS) * NOTE_ROW_HEIGHT;
        return {
            tag: "Text",
            key: "note-" + note.side,
            point: {
                x: du(index),
                y: op(du(buy ? bar.low : bar.high), buy ? "+" : "-", px(offset))
            },
            text: note.text,
            style: { fontSize: 9, fill: this.props.blockedColor },
            textAlignment: buy ? "centerBelow" : "centerAbove"
        };
    }
}

module.exports = {
    name: "trendPullbackSignals",
    description: "Trend Pullback Signals (5m)",
    calculator: trendPullbackSignals,
    inputType: meta.InputType.BARS,
    params: {
        fastPeriod: predef.paramSpecs.period(9),
        slowPeriod: predef.paramSpecs.period(21),
        useVwap: predef.paramSpecs.bool(true),
        vwapAnchor: predef.paramSpecs.enum({
            rth: "Regular-hours open (RTH)",
            eth: "Trading day start, 18:00 ET (ETH)"
        }, "rth"),
        rthStart: predef.paramSpecs.number(930, 1, 0),
        atrPeriod: predef.paramSpecs.period(14),
        pullbackBars: predef.paramSpecs.number(3, 1, 1),
        touchTolerance: predef.paramSpecs.number(0.1, 0.05, 0),
        useEngulfing: predef.paramSpecs.bool(true),
        usePinBar: predef.paramSpecs.bool(true),
        pinWickPct: predef.paramSpecs.percent(60, 5, 30, 95),
        useStrongClose: predef.paramSpecs.bool(true),
        useReversals: predef.paramSpecs.bool(false),
        revStretchAtr: predef.paramSpecs.number(2, 0.25, 0),
        revLookback: predef.paramSpecs.number(10, 1, 2),
        revConfirm: predef.paramSpecs.bool(true),
        useSession: predef.paramSpecs.bool(true),
        sessionStart: predef.paramSpecs.number(930, 1, 0),
        sessionEnd: predef.paramSpecs.number(1545, 1, 0),
        cooldownBars: predef.paramSpecs.number(6, 1, 0),
        showLines: predef.paramSpecs.bool(true),
        showLabels: predef.paramSpecs.bool(true),
        showTriggerName: predef.paramSpecs.bool(false),
        showBlocked: predef.paramSpecs.bool(false),
        buyColor: predef.paramSpecs.color("#22c55e"),
        sellColor: predef.paramSpecs.color("#ef4444"),
        revBuyColor: predef.paramSpecs.color("#14b8a6"),
        revSellColor: predef.paramSpecs.color("#f97316"),
        blockedColor: predef.paramSpecs.color("#9ca3af"),
        markerSize: predef.paramSpecs.number(8, 1, 4)
    },
    tags: ["My Indicators"],
    plots: {
        fast: { title: "Fast EMA" },
        slow: { title: "Slow EMA" },
        vwap: { title: "VWAP" }
    },
    plotter: predef.plotters.multiline(["fast", "slow", "vwap"]),
    schemeStyles: {
        dark: {
            fast: predef.styles.plot({ color: "#38bdf8", lineWidth: 1 }),
            slow: predef.styles.plot({ color: "#f59e0b", lineWidth: 1 }),
            vwap: predef.styles.plot({ color: "#c084fc", lineWidth: 2 })
        },
        light: {
            fast: predef.styles.plot({ color: "#0284c7", lineWidth: 1 }),
            slow: predef.styles.plot({ color: "#d97706", lineWidth: 1 }),
            vwap: predef.styles.plot({ color: "#9333ea", lineWidth: 2 })
        }
    }
};
