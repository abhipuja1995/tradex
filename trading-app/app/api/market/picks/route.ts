import { NextResponse } from "next/server";
import {
  getQuote,
  getChartData,
  calculateDMA,
  calculateRSI,
} from "@/lib/market-data";
import { NIFTY_50_STOCKS, US_TOP_STOCKS, COMMODITY_SYMBOLS, MACRO_SYMBOLS } from "@/lib/symbols";

export const revalidate = 3600; // 1 hour cache

interface StockPick {
  symbol: string;
  name: string;
  price: number;
  entry: number;
  target: number;
  targetPct: number;
  stopLoss: number;
  stopLossPct: number;
  duration: string;
  rsi: number;
  dma50: number;
  dma100: number;
  dma200: number;
  trend: string;
  setupType: string;
  signal: "BUY" | "WATCH";
  score: number;
}

interface GoldSetup {
  usdPrice: number;
  inrPricePer10g: number;
  goldbeesPrice: number;
  usdInrRate: number;
  dma50: number;
  dma200: number;
  rsi: number;
  signal: "BUY" | "SELL" | "HOLD";
  signalReason: string;
  entry: number;
  target: number;
  targetPct: number;
  stopLoss: number;
  stopLossPct: number;
  setupType: string;
}

async function analyzeStock(symbol: string): Promise<StockPick | null> {
  try {
    const [quote, chart] = await Promise.all([
      getQuote(symbol),
      getChartData(symbol, "1y", "1d"),
    ]);

    if (!quote || !chart || chart.closes.length < 200) return null;

    const closes = chart.closes;
    const price = quote.price;

    const dma50Arr = calculateDMA(closes, 50);
    const dma100Arr = calculateDMA(closes, 100);
    const dma200Arr = calculateDMA(closes, 200);
    const rsiArr = calculateRSI(closes, 14);

    const dma50 = dma50Arr[dma50Arr.length - 1];
    const dma100 = dma100Arr[dma100Arr.length - 1];
    const dma200 = dma200Arr[dma200Arr.length - 1];
    const rsi = rsiArr[rsiArr.length - 1];

    if ([dma50, dma100, dma200, rsi].some(isNaN)) return null;

    // Scoring
    let score = 0;
    let setupType = "Watch";
    let duration = "3M";
    let targetPct = 15;
    let stopLossPct = 8;

    const aboveDMA50 = price > dma50;
    const aboveDMA100 = price > dma100;
    const aboveDMA200 = price > dma200;
    const nearDMA50 = Math.abs(price - dma50) / dma50 < 0.02;
    const nearDMA100 = Math.abs(price - dma100) / dma100 < 0.03;
    const nearDMA200 = Math.abs(price - dma200) / dma200 < 0.03;

    // Momentum breakout: above 50 DMA + RSI 40-65
    if (aboveDMA50 && rsi >= 40 && rsi <= 65) {
      score += 30;
      setupType = "Momentum Breakout";
      duration = "3M";
      targetPct = 20;
      stopLossPct = 8;
    }

    // Uptrend confirmed: above 200 DMA
    if (aboveDMA200) {
      score += 20;
    }

    // Oversold bounce: RSI < 35 near support
    if (rsi < 35 && (nearDMA100 || nearDMA200)) {
      score += 25;
      setupType = "Pullback to Support";
      duration = "6M";
      targetPct = 25;
      stopLossPct = 10;
    }

    // Golden cross alignment: 50 > 100 > 200
    if (dma50 > dma100 && dma100 > dma200) {
      score += 15;
      if (setupType === "Watch") {
        setupType = "Sector Leader";
        duration = "3-6M";
        targetPct = 25;
        stopLossPct = 12;
      }
    }

    // Fresh breakout: just crossed above 50 DMA
    if (aboveDMA50 && nearDMA50) {
      score += 10;
      if (setupType === "Watch") {
        setupType = "Fresh Breakout";
        duration = "3M";
        targetPct = 15;
        stopLossPct = 8;
      }
    }

    // Recovery play: crossed above 200 DMA from below
    if (aboveDMA200 && !aboveDMA100 && rsi < 50) {
      if (setupType === "Watch") {
        setupType = "Recovery Play";
        duration = "6-12M";
        targetPct = 25;
        stopLossPct = 10;
      }
    }

    // Growth breakout: strong RSI + all DMAs aligned
    if (rsi > 55 && rsi < 70 && aboveDMA50 && aboveDMA100 && aboveDMA200) {
      if (setupType === "Watch") {
        setupType = "Growth Breakout";
        duration = "6-9M";
        targetPct = 30;
        stopLossPct = 15;
      }
    }

    const entry = price;
    const target = parseFloat((price * (1 + targetPct / 100)).toFixed(2));
    const stopLoss = parseFloat((price * (1 - stopLossPct / 100)).toFixed(2));

    // Determine trend
    const aboveCount = [aboveDMA50, aboveDMA100, aboveDMA200].filter(Boolean).length;
    let trend = "NEUTRAL";
    if (aboveCount === 3 && dma50 > dma100) trend = "STRONG_BULL";
    else if (aboveCount >= 2) trend = "BULL";
    else if (aboveCount === 0) trend = "BEAR";
    else if (aboveCount <= 1) trend = "WEAK";

    return {
      symbol: quote.symbol,
      name: quote.name,
      price,
      entry,
      target,
      targetPct,
      stopLoss,
      stopLossPct,
      duration,
      rsi: parseFloat(rsi.toFixed(2)),
      dma50: parseFloat(dma50.toFixed(2)),
      dma100: parseFloat(dma100.toFixed(2)),
      dma200: parseFloat(dma200.toFixed(2)),
      trend,
      setupType,
      signal: score >= 30 ? "BUY" : "WATCH",
      score,
    };
  } catch {
    return null;
  }
}

async function scanStocks(symbols: string[], topN: number): Promise<StockPick[]> {
  const allPicks: StockPick[] = [];
  const batchSize = 5;

  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map(analyzeStock));
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) {
        allPicks.push(r.value);
      }
    }
  }

  return allPicks
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

async function getGoldSetup(): Promise<GoldSetup | null> {
  try {
    const [goldQuote, usdInrQuote, goldbeesQuote, dxyQuote, yieldQuote, vixQuote, goldChart] =
      await Promise.all([
        getQuote(COMMODITY_SYMBOLS.GOLD),
        getQuote(MACRO_SYMBOLS.USD_INR),
        getQuote(COMMODITY_SYMBOLS.GOLD_INR),
        getQuote(MACRO_SYMBOLS.DXY),
        getQuote(MACRO_SYMBOLS.US_10Y),
        getQuote(MACRO_SYMBOLS.US_VIX),
        getChartData(COMMODITY_SYMBOLS.GOLD, "1y", "1d"),
      ]);

    const goldPrice = goldQuote?.price ?? 0;
    const usdInrRate = usdInrQuote?.price ?? 83;
    const pricePer10g = (goldPrice * usdInrRate) / 31.1035 * 10;

    let dma50 = 0, dma200 = 0, rsi = 50;
    if (goldChart && goldChart.closes.length >= 200) {
      const d50 = calculateDMA(goldChart.closes, 50);
      const d200 = calculateDMA(goldChart.closes, 200);
      const r = calculateRSI(goldChart.closes, 14);
      dma50 = d50[d50.length - 1];
      dma200 = d200[d200.length - 1];
      rsi = r[r.length - 1];
      if (isNaN(dma50)) dma50 = 0;
      if (isNaN(dma200)) dma200 = 0;
      if (isNaN(rsi)) rsi = 50;
    }

    let signal: "BUY" | "SELL" | "HOLD" = "HOLD";
    let signalReason = "Gold range-bound - hold position";
    let setupType = "Swing";
    let targetPct = 10;
    let stopLossPct = 5;

    const dxyBelow100 = (dxyQuote?.price ?? 105) < 100;
    const yieldsFalling = (yieldQuote?.change ?? 0) < 0;
    const vixHigh = (vixQuote?.price ?? 15) > 25;

    if (dxyBelow100 && yieldsFalling) {
      signal = "BUY";
      signalReason = "Dollar weak + yields falling = gold bullish";
      setupType = "Macro Buy";
      targetPct = 12;
    } else if (vixHigh) {
      signal = "BUY";
      signalReason = "High fear (VIX > 25) - safe haven demand";
      setupType = "Hedge Buy";
      targetPct = 8;
    } else if (rsi > 70) {
      signal = "SELL";
      signalReason = "Overbought RSI > 70 - book profits";
      setupType = "Exit";
      targetPct = 0;
      stopLossPct = 0;
    } else if (goldPrice < dma50 && goldPrice > dma200) {
      signal = "BUY";
      signalReason = "Pullback to 50 DMA support - entry zone";
      setupType = "Pullback Buy";
      targetPct = 10;
    }

    return {
      usdPrice: goldPrice,
      inrPricePer10g: parseFloat(pricePer10g.toFixed(2)),
      goldbeesPrice: goldbeesQuote?.price ?? 0,
      usdInrRate: parseFloat(usdInrRate.toFixed(4)),
      dma50: parseFloat(dma50.toFixed(2)),
      dma200: parseFloat(dma200.toFixed(2)),
      rsi: parseFloat(rsi.toFixed(2)),
      signal,
      signalReason,
      entry: parseFloat(goldPrice.toFixed(2)),
      target: parseFloat((goldPrice * (1 + targetPct / 100)).toFixed(2)),
      targetPct,
      stopLoss: parseFloat((goldPrice * (1 - stopLossPct / 100)).toFixed(2)),
      stopLossPct,
      setupType,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const [india, us, gold] = await Promise.all([
      scanStocks(NIFTY_50_STOCKS, 5),
      scanStocks(US_TOP_STOCKS, 5),
      getGoldSetup(),
    ]);

    return NextResponse.json({
      india,
      us,
      gold,
      generatedAt: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[picks] API error:", err);
    return NextResponse.json({ error: "Failed to generate picks" }, { status: 500 });
  }
}
