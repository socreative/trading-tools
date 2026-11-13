/*
 * Daily Levels - NinjaTrader Web custom indicator
 *
 * Draws four reference levels that reset every trading day:
 *   PDH / PDL - the previous trading day's high and low (regular hours by default)
 *   ONH / ONL - the current trading day's overnight high and low
 *
 * Each level is one ray starting at the bar that set it and running to the
 * right edge of the chart, with its label pinned next to the price scale.
 *
 * Session times are New York time. A trading day starts at the overnight start
 * time on the previous calendar evening (18:00 ET by default), like CME futures.
 * The overnight levels move with price during the overnight session and stay
 * fixed from the regular-hours open until the next trading day starts.
 */

const predef = require("./tools/predef");
const meta = require("./tools/meta");
const { du, px } = require("./tools/graphics");

// Each level reads its own <field>LevelColour, <field>LineStyle and <field>LineWidth parameters.
const LEVELS = [
    { field: "pdh", label: "PDH", toggle: "showPrevDay", source: "prevDay", side: "high" },
    { field: "pdl", label: "PDL", toggle: "showPrevDay", source: "prevDay", side: "low" },
    { field: "onh", label: "ONH", toggle: "showOvernight", source: "overnight", side: "high" },
    { field: "onl", label: "ONL", toggle: "showOvernight", source: "overnight", side: "low" }
];

// Line style choices, mapped to the platform's DashLineStyle values. The labels are kept
// short because the dropdown widens to fit the chosen option, and four wide dropdowns
// no longer fit on one row of the settings dialog.
const LINE_STYLES = {
    solid: { label: "Solid", dash: 1 },           // Solid
    dotted: { label: "Dotted", dash: 3 },         // TwoTwo
    dashed: { label: "Dashed", dash: 4 },         // FiveTwo
    dashedWide: { label: "Wide dash", dash: 5 },  // FourFour
    dashedTight: { label: "Fine dash", dash: 2 }  // ThreeOne
};

function lineStyleParam(def) {
    const options = {};
    for (const key of Object.keys(LINE_STYLES)) {
        options[key] = LINE_STYLES[key].label;
    }
    return predef.paramSpecs.enum(options, def);
}

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

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

// Running high/low plus the index of the bar that first reached each one.
function expand(range, high, low, index) {
    if (!range) {
        return { high, low, highIndex: index, lowIndex: index };
    }
    return {
        high: Math.max(range.high, high),
        low: Math.min(range.low, low),
        highIndex: high > range.high ? index : range.highIndex,
        lowIndex: low < range.low ? index : range.lowIndex
    };
}

class dailyLevels {
    init() {
        const chart = this.chartDescription;
        this.enabled = !(chart && chart.underlyingType === "DailyBar");
        this.rthStart = hhmmToMinutes(this.props.rthStart);
        this.rthEnd = hhmmToMinutes(this.props.rthEnd);
        this.overnightStart = hhmmToMinutes(this.props.overnightStart);

        this.tradingDay = undefined;
        this.rth = undefined;         // current trading day, regular hours
        this.fullSession = undefined; // current trading day, every bar
        this.overnight = undefined;   // current trading day, overnight session
        this.prevDay = undefined;     // last completed trading day (RTH or full, per setting)
    }

    map(d) {
        if (!this.enabled) {
            return {};
        }

        const nyMs = toNewYorkMs(d.timestamp().getTime());
        const minute = Math.floor((nyMs % DAY) / MINUTE);
        // Shift so the overnight start becomes midnight: that gives the trading day a bar belongs to.
        const tradingDay = Math.floor((nyMs + (24 * 60 - this.overnightStart) * MINUTE) / DAY);

        if (tradingDay !== this.tradingDay) {
            if (this.tradingDay !== undefined) {
                const completed = this.props.prevDaySession === "eth" ? this.fullSession : this.rth;
                // A day with no regular-hours bars (e.g. a holiday) keeps the earlier PDH/PDL.
                if (completed) {
                    this.prevDay = completed;
                }
            }
            this.tradingDay = tradingDay;
            this.rth = undefined;
            this.fullSession = undefined;
            this.overnight = undefined;
        }

        const inRth = minute >= this.rthStart && minute < this.rthEnd;
        const inOvernight = this.overnightStart > this.rthStart
            ? minute >= this.overnightStart || minute < this.rthStart
            : minute >= this.overnightStart && minute < this.rthStart;

        const high = d.high();
        const low = d.low();
        const index = d.index();
        this.fullSession = expand(this.fullSession, high, low, index);
        if (inRth) {
            this.rth = expand(this.rth, high, low, index);
        }
        if (inOvernight) {
            this.overnight = expand(this.overnight, high, low, index);
        }

        const visible = LEVELS
            .filter(level => this.props[level.toggle] && this[level.source])
            .map(level => {
                const range = this[level.source];
                return { level, value: range[level.side], anchor: range[level.side + "Index"] };
            });

        const result = {};
        for (const { level, value } of visible) {
            result[level.field] = value;
        }
        // The rays reach the right edge on their own, so they only need drawing once, from the last bar.
        if (typeof d.isLast === "function" && d.isLast()) {
            result.graphics = { items: this.drawLevels(visible) };
        }
        return result;
    }

    drawLevels(visible) {
        const items = [];
        for (const { level, value, anchor } of visible) {
            const color = this.props[level.field + "LevelColour"];
            const style = LINE_STYLES[this.props[level.field + "LineStyle"]] || LINE_STYLES.solid;
            items.push({
                tag: "LineSegments",
                key: "line-" + level.field,
                lines: [{
                    tag: "Line",
                    a: { x: du(anchor), y: du(value) },
                    b: { x: du(anchor + 1), y: du(value) },
                    infiniteStart: false,
                    infiniteEnd: true
                }],
                lineStyle: {
                    lineWidth: this.props[level.field + "LineWidth"],
                    color,
                    lineStyle: style.dash
                },
                global: true
            });
            if (this.props.showLabels) {
                items.push({
                    tag: "Text",
                    key: "label-" + level.field,
                    // Measured from the right edge of the plot area, so the label sits against the price scale.
                    origin: { cs: "grid", h: "right", v: "top" },
                    point: { x: px(0), y: du(value) },
                    // Whole points only, rounded to the nearest point.
                    text: level.label + " " + Math.round(value),
                    style: { fontSize: 11, fontWeight: "bold", fill: color },
                    textAlignment: "leftAbove",
                    global: true
                });
            }
        }
        return items;
    }
}

module.exports = {
    name: "dailyLevelsPdhPdlOnhOnl",
    description: "Daily Levels (PDH PDL ONH ONL)",
    calculator: dailyLevels,
    inputType: meta.InputType.BARS,
    // The settings dialog flows these left to right and wraps them like CSS floats, and the
    // colour swatches are slightly shorter than the other fields. A swatch that ends a row makes
    // the next field drop underneath it, so the order and label lengths below are chosen to
    // give one row per group:
    //   session times | 4 colours | 4 widths | 4 styles | 3 toggles
    // The session row is nearly full, so the colours always start a new row, and the
    // "LEVEL COLOUR" labels are long enough that four swatches fill that row on their own.
    params: {
        prevDaySession: predef.paramSpecs.enum({
            rth: "Regular hours (RTH)",
            eth: "Full session (ETH)"
        }, "rth"),
        rthStart: predef.paramSpecs.number(930, 1, 0),
        rthEnd: predef.paramSpecs.number(1600, 1, 0),
        overnightStart: predef.paramSpecs.number(1800, 1, 0),

        pdhLevelColour: predef.paramSpecs.color("#868686"),
        pdlLevelColour: predef.paramSpecs.color("#868686"),
        onhLevelColour: predef.paramSpecs.color("#868686"),
        onlLevelColour: predef.paramSpecs.color("#868686"),

        pdhLineWidth: predef.paramSpecs.number(1, 1, 1),
        pdlLineWidth: predef.paramSpecs.number(1, 1, 1),
        onhLineWidth: predef.paramSpecs.number(1, 1, 1),
        onlLineWidth: predef.paramSpecs.number(1, 1, 1),

        pdhLineStyle: lineStyleParam("dashedWide"),
        pdlLineStyle: lineStyleParam("dashedWide"),
        onhLineStyle: lineStyleParam("dashedWide"),
        onlLineStyle: lineStyleParam("dashedWide"),

        showPrevDay: predef.paramSpecs.bool(true),
        showOvernight: predef.paramSpecs.bool(true),
        showLabels: predef.paramSpecs.bool(true)
    },
    tags: ["My Indicators"],
    plots: {
        pdh: { title: "PDH" },
        pdl: { title: "PDL" },
        onh: { title: "ONH" },
        onl: { title: "ONL" }
    },
    // The rays and labels are graphics returned from map(). The plots exist for the Data Box,
    // and this empty plotter stops the platform drawing them as bar-by-bar lines.
    plotter: predef.plotters.custom(() => {}),
    // The rays use the color parameters above. These only color the Data Box values.
    schemeStyles: {
        dark: {
            pdh: predef.styles.plot("#868686"),
            pdl: predef.styles.plot("#868686"),
            onh: predef.styles.plot("#868686"),
            onl: predef.styles.plot("#868686")
        }
    }
};
