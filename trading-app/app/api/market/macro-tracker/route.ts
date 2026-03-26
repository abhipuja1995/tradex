import { NextResponse } from "next/server";
import { getQuote } from "@/lib/market-data";
import { MACRO_SYMBOLS, COMMODITY_SYMBOLS } from "@/lib/symbols";

export const revalidate = 300;

type IndicatorStatus = "BULLISH" | "BEARISH" | "NEUTRAL";

interface Indicator {
  name: string;
  value: number;
  change: number;
  status: IndicatorStatus;
  description: string;
  icon: string;
}

export async function GET() {
  try {
    const [jpyUsd, dxy, us10y, crude, gold, indiaVix, usVix, usdInr] =
      await Promise.all([
        getQuote(MACRO_SYMBOLS.JPY_USD),
        getQuote(MACRO_SYMBOLS.DXY),
        getQuote(MACRO_SYMBOLS.US_10Y),
        getQuote(MACRO_SYMBOLS.CRUDE_OIL),
        getQuote(COMMODITY_SYMBOLS.GOLD),
        getQuote(MACRO_SYMBOLS.INDIA_VIX),
        getQuote(MACRO_SYMBOLS.US_VIX),
        getQuote(MACRO_SYMBOLS.USD_INR),
      ]);

    const indicators: Indicator[] = [];

    // 1. Yen vs Dollar
    if (jpyUsd) {
      let status: IndicatorStatus = "NEUTRAL";
      let description = "Yen stable - no clear risk signal";
      if (jpyUsd.changePercent < -0.3) {
        status = "BEARISH";
        description = "Yen strengthening - global risk-off, carry trade unwind";
      } else if (jpyUsd.changePercent > 0.3) {
        status = "BULLISH";
        description = "Yen weakening - carry trade active, risk-on";
      }
      indicators.push({ name: "Yen vs Dollar", value: jpyUsd.price, change: jpyUsd.changePercent, status, description, icon: "JPY" });
    }

    // 2. Dollar Index
    if (dxy) {
      let status: IndicatorStatus = "NEUTRAL";
      let description = "Dollar neutral";
      if (dxy.price < 100) {
        status = "BULLISH";
        description = "DXY < 100 - bullish trigger for equities & EM";
      } else if (dxy.price > 105) {
        status = "BEARISH";
        description = "Strong dollar pressures EM & commodities";
      }
      indicators.push({ name: "Dollar Index (DXY)", value: dxy.price, change: dxy.changePercent, status, description, icon: "DXY" });
    }

    // 3. Bond Yields
    if (us10y) {
      let status: IndicatorStatus = "NEUTRAL";
      let description = "Yields stable";
      if (us10y.change < 0) {
        status = "BULLISH";
        description = "Bond yields falling - supportive for equities";
      } else if (us10y.price > 4.5) {
        status = "BEARISH";
        description = "Yields > 4.5% - pressure on growth/tech stocks";
      }
      indicators.push({ name: "US 10Y Bond Yield", value: us10y.price, change: us10y.changePercent, status, description, icon: "BOND" });
    }

    // 4. Oil
    if (crude) {
      let status: IndicatorStatus = "NEUTRAL";
      let description = "Oil prices stable";
      if (crude.change < 0) {
        status = "BULLISH";
        description = "Oil cooling - inflation expectations easing";
      } else if (crude.price > 85) {
        status = "BEARISH";
        description = "Oil > $85 - inflation risk rising";
      }
      indicators.push({ name: "Crude Oil (WTI)", value: crude.price, change: crude.changePercent, status, description, icon: "OIL" });
    }

    // 5. Gold
    if (gold) {
      let status: IndicatorStatus = "NEUTRAL";
      let description = "Gold range-bound";
      if (gold.changePercent > 0.5) {
        status = "BEARISH";
        description = "Gold rising - flight to safety, risk-off signal";
      } else if (gold.changePercent < -0.5) {
        status = "BULLISH";
        description = "Gold falling - risk appetite returning";
      }
      indicators.push({ name: "Gold Trend", value: gold.price, change: gold.changePercent, status, description, icon: "GOLD" });
    }

    // 6. VIX (India + US)
    const vixValues: string[] = [];
    if (indiaVix) vixValues.push(`India: ${indiaVix.price.toFixed(1)}`);
    if (usVix) vixValues.push(`US: ${usVix.price.toFixed(1)}`);
    const maxVix = Math.max(indiaVix?.price ?? 0, usVix?.price ?? 0);
    {
      let status: IndicatorStatus = "NEUTRAL";
      let description = `VIX normal range (${vixValues.join(", ")})`;
      if (maxVix > 25) {
        status = "BEARISH";
        description = `High fear - VIX elevated (${vixValues.join(", ")})`;
      } else if (maxVix < 15) {
        status = "BULLISH";
        description = `Low volatility - complacent markets (${vixValues.join(", ")})`;
      }
      indicators.push({ name: "VIX (India + US)", value: maxVix, change: usVix?.changePercent ?? 0, status, description, icon: "VIX" });
    }

    // 7. USD/INR
    if (usdInr) {
      let status: IndicatorStatus = "NEUTRAL";
      let description = "Rupee stable";
      if (usdInr.changePercent > 0.2) {
        status = "BEARISH";
        description = "Rupee weakening - FII outflows, risk-off for India";
      } else if (usdInr.changePercent < -0.2) {
        status = "BULLISH";
        description = "Rupee strengthening - FII inflows, positive for India";
      }
      indicators.push({ name: "USD/INR", value: usdInr.price, change: usdInr.changePercent, status, description, icon: "INR" });
    }

    const bullishCount = indicators.filter((i) => i.status === "BULLISH").length;
    const bearishCount = indicators.filter((i) => i.status === "BEARISH").length;
    const overallSignal = bullishCount >= 5 ? "RISK ON" : bearishCount >= 5 ? "RISK OFF" : "MIXED";

    return NextResponse.json({
      indicators,
      overallSignal,
      bullishCount,
      bearishCount,
      totalIndicators: indicators.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[macro-tracker] API error:", err);
    return NextResponse.json({ error: "Failed to fetch macro data" }, { status: 500 });
  }
}
