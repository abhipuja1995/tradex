import { getQuote, getChartData, calculateDMA, calculateRSI } from "./market-data";
import { MACRO_SYMBOLS, COMMODITY_SYMBOLS } from "./symbols";

export type MarketRegime = "RISK_ON" | "RISK_OFF" | "TRANSITION";

export type MacroSignal = {
  name: string;
  value: number;
  signal: "BULLISH" | "BEARISH" | "NEUTRAL";
  description: string;
};

export type TechnicalSignal = {
  symbol: string;
  price: number;
  dma50: number;
  dma100: number;
  dma200: number;
  trend: "STRONG_BULL" | "BULL" | "NEUTRAL" | "BEAR" | "STRONG_BEAR";
  rsi: number;
};

export function detectRegime(signals: MacroSignal[]): MarketRegime {
  let bullish = 0;
  let bearish = 0;

  for (const s of signals) {
    if (s.signal === "BULLISH") bullish++;
    else if (s.signal === "BEARISH") bearish++;
  }

  const total = bullish + bearish;
  if (total === 0) return "TRANSITION";

  const bullishRatio = bullish / total;
  if (bullishRatio >= 0.6) return "RISK_ON";
  if (bullishRatio <= 0.4) return "RISK_OFF";
  return "TRANSITION";
}

export async function computeTechnical(
  symbol: string
): Promise<TechnicalSignal | null> {
  try {
    const chart = await getChartData(symbol, "1y", "1d");
    if (!chart || chart.closes.length < 200) return null;

    const closes = chart.closes;
    const price = closes[closes.length - 1];

    const dma50Arr = calculateDMA(closes, 50);
    const dma100Arr = calculateDMA(closes, 100);
    const dma200Arr = calculateDMA(closes, 200);
    const rsiArr = calculateRSI(closes, 14);

    const dma50 = dma50Arr[dma50Arr.length - 1];
    const dma100 = dma100Arr[dma100Arr.length - 1];
    const dma200 = dma200Arr[dma200Arr.length - 1];
    const rsi = rsiArr[rsiArr.length - 1];

    // Determine trend based on price relative to DMAs
    let trend: TechnicalSignal["trend"];
    const aboveDMA50 = price > dma50;
    const aboveDMA100 = price > dma100;
    const aboveDMA200 = price > dma200;

    const aboveCount = [aboveDMA50, aboveDMA100, aboveDMA200].filter(Boolean).length;

    if (aboveCount === 3 && dma50 > dma100 && dma100 > dma200) {
      trend = "STRONG_BULL";
    } else if (aboveCount >= 2) {
      trend = "BULL";
    } else if (aboveCount === 1) {
      trend = "NEUTRAL";
    } else if (aboveCount === 0 && dma50 < dma100 && dma100 < dma200) {
      trend = "STRONG_BEAR";
    } else {
      trend = "BEAR";
    }

    return {
      symbol,
      price: parseFloat(price.toFixed(2)),
      dma50: isNaN(dma50) ? 0 : dma50,
      dma100: isNaN(dma100) ? 0 : dma100,
      dma200: isNaN(dma200) ? 0 : dma200,
      trend,
      rsi: isNaN(rsi) ? 50 : rsi,
    };
  } catch (err) {
    console.error(`[signals] computeTechnical(${symbol}) failed:`, err);
    return null;
  }
}

export async function generateMacroSignals(): Promise<{
  signals: MacroSignal[];
  regime: MarketRegime;
}> {
  const signals: MacroSignal[] = [];

  // Fetch all macro quotes in parallel
  const [dxy, vix, us10y, crude, gold, jpyUsd, usdInr] = await Promise.all([
    getQuote(MACRO_SYMBOLS.DXY),
    getQuote(MACRO_SYMBOLS.US_VIX),
    getQuote(MACRO_SYMBOLS.US_10Y),
    getQuote(MACRO_SYMBOLS.CRUDE_OIL),
    getQuote(COMMODITY_SYMBOLS.GOLD),
    getQuote(MACRO_SYMBOLS.JPY_USD),
    getQuote(MACRO_SYMBOLS.USD_INR),
  ]);

  // DXY (Dollar Index)
  if (dxy) {
    let signal: MacroSignal["signal"] = "NEUTRAL";
    let description = "Dollar index is neutral";
    if (dxy.price < 100) {
      signal = "BULLISH";
      description = "Weak dollar supports equities and EM flows";
    } else if (dxy.price > 105) {
      signal = "BEARISH";
      description = "Strong dollar pressures EM and commodities";
    }
    signals.push({ name: "DXY (Dollar Index)", value: dxy.price, signal, description });
  }

  // VIX
  if (vix) {
    let signal: MacroSignal["signal"] = "NEUTRAL";
    let description = "Volatility in normal range";
    if (vix.price > 25) {
      signal = "BEARISH";
      description = "High fear - elevated volatility signals risk-off";
    } else if (vix.price < 15) {
      signal = "BULLISH";
      description = "Low volatility indicates complacent, risk-on markets";
    }
    signals.push({ name: "US VIX", value: vix.price, signal, description });
  }

  // US 10Y Yield
  if (us10y) {
    let signal: MacroSignal["signal"] = "NEUTRAL";
    let description = "Yields are stable";
    if (us10y.change < 0) {
      signal = "BULLISH";
      description = "Falling yields support equity valuations";
    } else if (us10y.change > 0 && us10y.price > 4.5) {
      signal = "BEARISH";
      description = "Rising yields above 4.5% pressure growth stocks";
    }
    signals.push({ name: "US 10Y Yield", value: us10y.price, signal, description });
  }

  // Crude Oil
  if (crude) {
    let signal: MacroSignal["signal"] = "NEUTRAL";
    let description = "Oil prices stable";
    if (crude.change < 0) {
      signal = "BULLISH";
      description = "Falling oil cools inflation expectations";
    } else if (crude.change > 0 && crude.price > 85) {
      signal = "BEARISH";
      description = "Rising oil above $85 fuels inflation concerns";
    }
    signals.push({ name: "Crude Oil (WTI)", value: crude.price, signal, description });
  }

  // Gold
  if (gold) {
    let signal: MacroSignal["signal"] = "NEUTRAL";
    let description = "Gold is range-bound";
    if (gold.changePercent > 0.5) {
      signal = "BEARISH";
      description = "Rising gold signals fear and risk-off hedging";
    } else if (gold.changePercent < -0.5) {
      signal = "BULLISH";
      description = "Falling gold suggests risk appetite returning";
    }
    signals.push({ name: "Gold", value: gold.price, signal, description });
  }

  // JPY/USD (Yen strength = risk-off)
  if (jpyUsd) {
    let signal: MacroSignal["signal"] = "NEUTRAL";
    let description = "Yen is stable";
    // JPY=X is USD/JPY on Yahoo, so rising = yen weakening
    if (jpyUsd.changePercent < -0.3) {
      signal = "BEARISH";
      description = "Yen strengthening signals global risk-off flow";
    } else if (jpyUsd.changePercent > 0.3) {
      signal = "BULLISH";
      description = "Yen weakening signals carry trade and risk-on";
    }
    signals.push({ name: "JPY/USD", value: jpyUsd.price, signal, description });
  }

  // USD/INR
  if (usdInr) {
    let signal: MacroSignal["signal"] = "NEUTRAL";
    let description = "Rupee is stable";
    if (usdInr.changePercent > 0.2) {
      signal = "BEARISH";
      description = "Rupee weakening - FII outflows and risk-off for India";
    } else if (usdInr.changePercent < -0.2) {
      signal = "BULLISH";
      description = "Rupee strengthening - FII inflows supportive for India";
    }
    signals.push({ name: "USD/INR", value: usdInr.price, signal, description });
  }

  const regime = detectRegime(signals);
  return { signals, regime };
}
