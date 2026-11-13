/*
 * ExposureTrade - Multi SMA (Daily) - NinjaTrader Web custom indicator
 *
 * Up to 5 Simple Moving Averages calculated on daily data, on any chart timeframe.
 * NinjaTrader Web port of tradingview-indicators/multi-sma-daily.pine.
 *
 * NinjaTrader Web indicators only see the chart's own bars; there is no equivalent
 * of Pine's request.security(). So on intraday charts the indicator builds its own
 * daily bars from the chart, one per CME trading day (rolling over at 18:00 ET by
 * default), and a length of 200 needs 200 trading days of history on the chart.
 * On daily and longer charts it averages the chart bars directly.
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
const SMA_COUNT = 5;
const FIRST_DAY_GRACE = 5; // minutes after dayStart within which the chart's first bar counts as a full day
const KEPT_BARS = 10;
const LABEL_FONT = { tiny: 9, small: 11, normal: 13 };
const NOTE_POSITION = { x: 260, y: 20 }; // pixels from the top-left of the plot area

const SOURCES = {
    close: { label: "Close", value: b => b.close },
    open: { label: "Open", value: b => b.open },
    high: { label: "High", value: b => b.high },
    low: { label: "Low", value: b => b.low },
    hl2: { label: "(H+L)/2", value: b => (b.high + b.low) / 2 },
    hlc3: { label: "(H+L+C)/3", value: b => (b.high + b.low + b.close) / 3 },
    ohlc4: { label: "(O+H+L+C)/4", value: b => (b.open + b.high + b.low + b.close) / 4 },
    hlcc4: { label: "(H+L+C+C)/4", value: b => (b.high + b.low + 2 * b.close) / 4 }
};

// Pine's defaults: lengths, which are on, and the plot colors and widths.
const DEFAULTS = [
    { length: 20, show: true, color: "#2962ff", width: 1 },  // blue
    { length: 50, show: true, color: "#ff9800", width: 1 },  // orange
    { length: 100, show: true, color: "#9c27b0", width: 2 }, // purple
    { length: 200, show: true, color: "#f23645", width: 2 }, // red
    { length: 10, show: false, color: "#00bcd4", width: 1 }  // aqua
];

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

// 1800 -> 1080 minutes after midnight
function hhmmToMinutes(hhmm) {
    return Math.floor(hhmm / 100) * 60 + (hhmm % 100);
}

// Trading day number of a New York time: shifting by the day start makes the day start midnight.
function tradingDay(nyMs, dayStartMinutes) {
    return Math.floor((nyMs + (24 * 60 - dayStartMinutes) * MINUTE) / DAY);
}

// The trading day in progress at `utcMs`, or Friday's at weekends. Day 0 (1 Jan 1970) was a Thursday.
function sessionDay(utcMs, dayStartMinutes) {
    const day = tradingDay(toNewYorkMs(utcMs), dayStartMinutes);
    const weekday = (day + 4) % 7;
    return weekday === 6 ? day - 1 : weekday === 0 ? day - 2 : day;
}

class multiSmaDaily {
    init() {
        const p = this.props;
        const chart = this.chartDescription || {};
        // Daily and longer charts: each chart bar is one period, like Pine's useLocal branch.
        this.local = chart.underlyingType === "DailyBar";
        this.chartPeriods = this.local && chart.elementSize > 1 ? chart.elementSize : 1;
        this.dayStart = hhmmToMinutes(p.dayStart);
        this.live = this.local || p.includeToday;

        const tick = this.contractInfo && this.contractInfo.tickSize;
        this.decimals = tick ? Math.min((String(tick).split(".")[1] || "").length, 6) : 2;

        this.smas = [];
        for (let n = 1; n <= SMA_COUNT; ++n) {
            const source = SOURCES[p["sma" + n + "Source"]] ? p["sma" + n + "Source"] : "close";
            this.smas.push({
                field: "sma" + n,
                show: p["sma" + n + "Show"],
                length: Math.max(1, Math.round(p["sma" + n + "Length"])),
                source,
                manual: Number(p["sma" + n + "Manual"]) || 0
            });
        }
        // Manual values stand in for SMAs the chart lacks the history for, on the current
        // trading day only. The clock says which day that is, since past bars are calculated first.
        this.manualFromDay = sessionDay(Date.now(), this.dayStart);

        // Completed days, and a running sum of each source in use over them:
        // prefix[source][k] is the sum over the first k completed days.
        this.days = [];
        this.prefix = {};
        this.smas.forEach(sma => {
            this.prefix[sma.source] = [0];
        });
        this.bars = {};
    }

    map(d) {
        const index = d.index();
        const prev = this.bars[index - 1];
        const bar = this.computeBar(d, index, prev);
        this.bars[index] = bar;
        delete this.bars[index - KEPT_BARS];

        const result = {};
        const values = [];
        const manual = [];
        this.smas.forEach(sma => {
            let value = sma.show ? this.average(bar, sma) : undefined;
            const useManual = value === undefined && sma.show && this.manualApplies(bar, sma);
            if (useManual) {
                value = sma.manual;
            }
            values.push(value);
            manual.push(useManual);
            if (value !== undefined) {
                result[sma.field] = value;
            }
        });

        // Labels belong at the last bar. If the platform doesn't say which bar is last,
        // draw on every bar: global items with the same keys replace each other.
        const last = typeof d.isLast === "function" ? d.isLast() : true;
        if (last) {
            const items = this.drawLabels(index, bar, values, manual);
            if (items.length) {
                result.graphics = { items };
            }
        }
        return result;
    }

    // Where this bar sits in the daily series: the day so far, and how many days completed before it.
    computeBar(d, index, prev) {
        const open = d.open();
        const high = d.high();
        const low = d.low();
        const close = d.close();

        let dayKey;
        let firstMinute;
        if (this.local) {
            dayKey = index;
        }
        else {
            const nyMs = toNewYorkMs(d.timestamp().getTime());
            dayKey = tradingDay(nyMs, this.dayStart);
            firstMinute = Math.floor((nyMs % DAY) / MINUTE);
        }

        if (prev && prev.dayKey === dayKey) {
            return {
                dayKey,
                partial: prev.partial,
                completed: prev.completed,
                day: {
                    open: prev.day.open,
                    high: Math.max(prev.day.high, high),
                    low: Math.min(prev.day.low, low),
                    close
                }
            };
        }

        let completed = 0;
        if (prev) {
            completed = prev.completed;
            if (!prev.partial) {
                this.completeDay(completed, prev.day);
                completed += 1;
            }
        }
        // The chart's first day usually starts mid-session, so its open, high and low are
        // incomplete. It is dropped unless the first bar opens right at the start of the day.
        const minutesIntoDay = (firstMinute - this.dayStart + 24 * 60) % (24 * 60);
        const partial = !prev && !this.local && minutesIntoDay > FIRST_DAY_GRACE;
        return { dayKey, partial, completed, day: { open, high, low, close } };
    }

    // Stores completed day number k. Assigning by position keeps repeated calls harmless.
    completeDay(k, day) {
        this.days[k] = day;
        Object.keys(this.prefix).forEach(source => {
            const sums = this.prefix[source];
            sums[k + 1] = sums[k] + SOURCES[source].value(day);
        });
    }

    // Live: the last length-1 completed days plus today so far. Closed: the last `length` completed days.
    average(bar, sma) {
        const sums = this.prefix[sma.source];
        const completed = bar.completed;
        if (bar.partial) {
            return undefined;
        }
        if (this.live) {
            const past = sma.length - 1;
            if (completed < past) {
                return undefined;
            }
            const today = SOURCES[sma.source].value(bar.day);
            return (sums[completed] - sums[completed - past] + today) / sma.length;
        }
        if (completed < sma.length) {
            return undefined;
        }
        return (sums[completed] - sums[completed - sma.length]) / sma.length;
    }

    // A typed-in value is used on intraday charts, on bars of the current trading day or later.
    manualApplies(bar, sma) {
        return !this.local && sma.manual > 0 && bar.dayKey >= this.manualFromDay;
    }

    // Days of history available to an SMA on this bar, counting today when it is included.
    daysAvailable(bar) {
        if (bar.partial) {
            return 0;
        }
        return bar.completed + (this.live ? 1 : 0);
    }

    drawLabels(index, bar, values, manual) {
        const p = this.props;
        const fontSize = LABEL_FONT[p.labelSize] || LABEL_FONT.small;
        const suffix = this.chartPeriods === 1 ? "1D" : this.chartPeriods + "D";
        const items = [];
        const missing = [];

        this.smas.forEach((sma, i) => {
            if (!sma.show) {
                return;
            }
            const value = values[i];
            if (value === undefined) {
                missing.push(sma.length);
                return;
            }
            if (p.showLabels) {
                // Same placement as working community indicators: text starting just right of the last bar.
                items.push({
                    tag: "Text",
                    key: "label-" + sma.field,
                    point: { x: op(du(index), "+", px(p.labelOffset)), y: du(value) },
                    text: "SMA " + sma.length + " (" + suffix + (manual[i] ? " manual" : "") + ")  " +
                        value.toFixed(this.decimals),
                    style: { fontSize, fill: p.labelColor },
                    textAlignment: "leftMiddle",
                    global: true
                });
            }
        });

        if (missing.length && p.showHistoryNote) {
            const unit = this.chartPeriods === 1 ? "days" : "bars";
            items.push({
                tag: "Text",
                key: "history-note",
                origin: { cs: "grid", h: "left", v: "top" },
                point: { x: px(NOTE_POSITION.x), y: px(NOTE_POSITION.y) },
                text: "Multi SMA: not enough history for SMA " + missing.join(", ") +
                    " (chart has " + this.daysAvailable(bar) + " " + unit + ")",
                style: { fontSize, fill: p.labelColor },
                textAlignment: "centerBelow",
                global: true
            });
        }
        return items;
    }
}

function sourceParam(def) {
    const options = {};
    Object.keys(SOURCES).forEach(key => {
        options[key] = SOURCES[key].label;
    });
    return predef.paramSpecs.enum(options, def);
}

const params = {
    includeToday: predef.paramSpecs.bool(true),
    dayStart: predef.paramSpecs.number(1800, 1, 0),
    showLabels: predef.paramSpecs.bool(true),
    labelOffset: predef.paramSpecs.number(8, 1, 0),
    labelSize: predef.paramSpecs.enum({ tiny: "Tiny", small: "Small", normal: "Normal" }, "small"),
    labelColor: predef.paramSpecs.color("#9ca3af"),
    showHistoryNote: predef.paramSpecs.bool(true)
};
const plots = {};
const dark = {};
const light = {};
DEFAULTS.forEach((def, i) => {
    const n = i + 1;
    params["sma" + n + "Show"] = predef.paramSpecs.bool(def.show);
    params["sma" + n + "Length"] = predef.paramSpecs.number(def.length, 1, 1);
    params["sma" + n + "Source"] = sourceParam("close");
    // 0 = off. Today's daily SMA value, for charts without enough history to calculate it.
    params["sma" + n + "Manual"] = predef.paramSpecs.number(0, 0.01, 0);
    plots["sma" + n] = { title: "SMA " + n };
    dark["sma" + n] = predef.styles.plot({ color: def.color, lineWidth: def.width });
    light["sma" + n] = predef.styles.plot({ color: def.color, lineWidth: def.width });
});

module.exports = {
    name: "exposureTradeMultiSmaDaily",
    description: "ExposureTrade - Multi SMA (Daily)",
    calculator: multiSmaDaily,
    inputType: meta.InputType.BARS,
    params,
    tags: ["My Indicators", predef.tags.MovingAverage],
    plots,
    plotter: predef.plotters.multiline(Object.keys(plots)),
    schemeStyles: { dark, light }
};
