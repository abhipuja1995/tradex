import { NextResponse } from "next/server";
import {
  getQuote,
  getChartData,
  calculateDMA,
  calculateRSI,
} from "@/lib/market-data";
import { NIFTY_50_STOCKS, US_TOP_STOCKS, COMMODITY_SYMBOLS, MACRO_SYMBOLS } from "@/lib/symbols";

export const revalidate = 3600; // 1 hour cache

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FibLevels {
  low52w: number;
  high52w: number;
  fib236: number;
  fib382: number;
  fib50: number;
  fib618: number;
  fib786: number;
}

interface StockPick {
  symbol: string;
  name: string;
  price: number;
  entry: number;
  target: number;
  targetPct: number;
  stopLoss: number;
  stopLossPct: number;
  rsi: number;
  dma50: number;
  dma100: number;
  dma200: number;
  trend: string;
  setupType: string;
  signal: "BUY" | "WATCH";
  score: number;
  fibLevels: FibLevels;
  fibFloor: number;
  fibCeiling: number;
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
  fibLevels: FibLevels;
  fibFloor: number;
  fibCeiling: number;
}

type BucketKey = "weeks" | "3m" | "6m" | "9m" | "12m";

// ---------------------------------------------------------------------------
// Fibonacci helpers
// ---------------------------------------------------------------------------

function computeFibLevels(low: number, high: number): FibLevels {
  const range = high - low;
  return {
    low52w: round2(low),
    high52w: round2(high),
    fib236: round2(low + range * 0.236),
    fib382: round2(low + range * 0.382),
    fib50: round2(low + range * 0.5),
    fib618: round2(low + range * 0.618),
    fib786: round2(low + range * 0.786),
  };
}

function fibFloorCeiling(price: number, fib: FibLevels): { floor: number; ceiling: number } {
  const levels = [fib.low52w, fib.fib236, fib.fib382, fib.fib50, fib.fib618, fib.fib786, fib.high52w];
  let floor = fib.low52w;
  let ceiling = fib.high52w;
  for (const lvl of levels) {
    if (lvl <= price) floor = lvl;
  }
  for (let i = levels.length - 1; i >= 0; i--) {
    if (levels[i] >= price) ceiling = levels[i];
  }
  return { floor, ceiling };
}

function nearFibLevel(price: number, level: number, tolerance = 0.02): boolean {
  return Math.abs(price - level) / level < tolerance;
}

function round2(n: number): number {
  return parseFloat(n.toFixed(2));
}

// ---------------------------------------------------------------------------
// Per-bucket scoring
// ---------------------------------------------------------------------------

interface BucketConfig {
  targetPct: number;
  stopLossPct: number;
  preferredSetups: string[];
}

const BUCKET_CONFIGS: Record<BucketKey, BucketConfig> = {
  weeks: { targetPct: 10, stopLossPct: 5, preferredSetups: ["Momentum Breakout", "Fresh Breakout"] },
  "3m": { targetPct: 20, stopLossPct: 8, preferredSetups: ["Momentum Breakout", "Sector Leader"] },
  "6m": { targetPct: 25, stopLossPct: 10, preferredSetups: ["Pullback to Support", "Growth Breakout"] },
  "9m": { targetPct: 30, stopLossPct: 12, preferredSetups: ["Recovery Play", "Growth Breakout"] },
  "12m": { targetPct: 35, stopLossPct: 15, preferredSetups: ["Recovery Play", "Pullback to Support"] },
};

function scoreBucket(pick: StockPick, bucket: BucketKey): number {
  let s = 0;
  const { rsi, dma50, dma100, dma200, price, setupType, fibLevels } = pick;
  const aboveDMA50 = price > dma50;
  const aboveDMA100 = price > dma100;
  const aboveDMA200 = price > dma200;
  const nearDMA200 = dma200 > 0 && Math.abs(price - dma200) / dma200 < 0.03;
  const nearFib382 = nearFibLevel(price, fibLevels.fib382);
  const nearFib50 = nearFibLevel(price, fibLevels.fib50);
  const nearFib618 = nearFibLevel(price, fibLevels.fib618);

  switch (bucket) {
    case "weeks":
      // Heavy weight on RSI 50-65, momentum, above 50DMA
      if (rsi >= 50 && rsi <= 65) s += 40;
      else if (rsi >= 45 && rsi < 50) s += 20;
      if (setupType === "Momentum Breakout" || setupType === "Fresh Breakout") s += 30;
      if (aboveDMA50) s += 20;
      if (rsi < 35) s -= 20;
      if (aboveDMA100) s += 5;
      break;

    case "3m":
      // Trend alignment, RSI 40-60, above 100DMA
      if (rsi >= 40 && rsi <= 60) s += 25;
      if (dma50 > dma100 && dma100 > dma200) s += 35; // trend alignment
      if (aboveDMA100) s += 20;
      if (setupType === "Momentum Breakout" || setupType === "Sector Leader") s += 20;
      if (aboveDMA50) s += 10;
      break;

    case "6m":
      // Pullback to support, near Fib 38.2/50%, RSI < 45
      if (setupType === "Pullback to Support" || setupType === "Growth Breakout") s += 30;
      if (nearFib382 || nearFib50) s += 30;
      if (rsi < 45) s += 20;
      else if (rsi < 55) s += 10;
      if (aboveDMA200) s += 10;
      if (nearFib618) s += 15;
      break;

    case "9m":
      // Deep value, RSI < 35, near 200DMA, near Fib 61.8%
      if (rsi < 35) s += 35;
      else if (rsi < 40) s += 20;
      if (setupType === "Recovery Play" || setupType === "Growth Breakout") s += 25;
      if (nearDMA200) s += 25;
      if (nearFib618) s += 20;
      if (!aboveDMA100 && aboveDMA200) s += 15;
      // Deep value bonus
      if (rsi < 30 && nearDMA200) s += 40;
      break;

    case "12m":
      // Recovery play, below 100DMA but above 200DMA, RSI < 30
      if (setupType === "Recovery Play" || setupType === "Pullback to Support") s += 30;
      if (!aboveDMA100 && aboveDMA200) s += 30;
      if (rsi < 30) s += 25;
      else if (rsi < 40) s += 15;
      if (nearFib618 || nearFibLevel(price, fibLevels.fib786)) s += 20;
      // Recovery play bonus
      if (rsi < 35 && !aboveDMA100 && aboveDMA200) s += 45;
      break;
  }

  // Bonus for preferred setup types
  const cfg = BUCKET_CONFIGS[bucket];
  if (cfg.preferredSetups.includes(setupType)) s += 10;

  return s;
}

// ---------------------------------------------------------------------------
// Stock analysis (returns full data with Fibonacci, no bucket filtering)
// ---------------------------------------------------------------------------

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

    // 52-week high / low from chart data
    const low52w = Math.min(...chart.lows);
    const high52w = Math.max(...chart.highs);
    const fibLevels = computeFibLevels(low52w, high52w);
    const { floor: fibFloor, ceiling: fibCeiling } = fibFloorCeiling(price, fibLevels);

    // --------------- Determine setupType ---------------
    let setupType = "Watch";
    let score = 0;

    const aboveDMA50 = price > dma50;
    const aboveDMA100 = price > dma100;
    const aboveDMA200 = price > dma200;
    const nearDMA50 = Math.abs(price - dma50) / dma50 < 0.02;
    const nearDMA100 = Math.abs(price - dma100) / dma100 < 0.03;
    const nearDMA200 = Math.abs(price - dma200) / dma200 < 0.03;
    const nearFibSupport = nearFibLevel(price, fibFloor);

    // Momentum breakout: above 50 DMA + RSI 40-65
    if (aboveDMA50 && rsi >= 40 && rsi <= 65) {
      score += 30;
      setupType = "Momentum Breakout";
    }

    // Uptrend confirmed: above 200 DMA
    if (aboveDMA200) {
      score += 20;
    }

    // Oversold bounce: RSI < 35 near support
    if (rsi < 35 && (nearDMA100 || nearDMA200)) {
      score += 25;
      setupType = "Pullback to Support";
    }

    // Fib Support setup: price near a Fib level (within 2%)
    if (nearFibSupport && rsi < 50) {
      score += 15;
      if (setupType === "Watch") setupType = "Fib Support";
    }

    // Golden cross alignment: 50 > 100 > 200
    if (dma50 > dma100 && dma100 > dma200) {
      score += 15;
      if (setupType === "Watch") setupType = "Sector Leader";
    }

    // Fresh breakout: just crossed above 50 DMA
    if (aboveDMA50 && nearDMA50) {
      score += 10;
      if (setupType === "Watch") setupType = "Fresh Breakout";
    }

    // Recovery play: crossed above 200 DMA from below
    if (aboveDMA200 && !aboveDMA100 && rsi < 50) {
      if (setupType === "Watch") setupType = "Recovery Play";
    }

    // Growth breakout: strong RSI + all DMAs aligned
    if (rsi > 55 && rsi < 70 && aboveDMA50 && aboveDMA100 && aboveDMA200) {
      if (setupType === "Watch") setupType = "Growth Breakout";
    }

    // Use generic target/SL (bucket-specific overrides happen later)
    const targetPct = 15;
    const stopLossPct = 8;
    const entry = price;
    const target = round2(price * (1 + targetPct / 100));
    const stopLoss = round2(price * (1 - stopLossPct / 100));

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
      rsi: round2(rsi),
      dma50: round2(dma50),
      dma100: round2(dma100),
      dma200: round2(dma200),
      trend,
      setupType,
      signal: score >= 30 ? "BUY" : "WATCH",
      score,
      fibLevels,
      fibFloor,
      fibCeiling,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Scan all stocks (returns EVERY successfully analyzed stock)
// ---------------------------------------------------------------------------

async function scanAllStocks(symbols: string[]): Promise<StockPick[]> {
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

  return allPicks;
}

// ---------------------------------------------------------------------------
// Build bucket picks: score, sort, pick top 5, override target/SL per bucket
// ---------------------------------------------------------------------------

function buildBucketPicks(
  allPicks: StockPick[],
  bucket: BucketKey,
  topN = 5
): StockPick[] {
  const cfg = BUCKET_CONFIGS[bucket];

  const scored = allPicks.map((pick) => {
    const bucketScore = scoreBucket(pick, bucket);
    const entry = pick.price;
    const target = round2(entry * (1 + cfg.targetPct / 100));
    const stopLoss = round2(entry * (1 - cfg.stopLossPct / 100));
    return {
      ...pick,
      score: bucketScore,
      target,
      targetPct: cfg.targetPct,
      stopLoss,
      stopLossPct: cfg.stopLossPct,
      signal: (bucketScore >= 30 ? "BUY" : "WATCH") as "BUY" | "WATCH",
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}

// ---------------------------------------------------------------------------
// Gold setup with Fibonacci
// ---------------------------------------------------------------------------

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

    let dma50 = 0;
    let dma200 = 0;
    let rsi = 50;
    let fibLevels: FibLevels = computeFibLevels(0, 0);
    let fibFloor = 0;
    let fibCeiling = 0;

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

      // Fib from 1Y high/low
      const low1y = Math.min(...goldChart.lows);
      const high1y = Math.max(...goldChart.highs);
      fibLevels = computeFibLevels(low1y, high1y);
      const fc = fibFloorCeiling(goldPrice, fibLevels);
      fibFloor = fc.floor;
      fibCeiling = fc.ceiling;
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
    } else if (nearFibLevel(goldPrice, fibFloor)) {
      signal = "BUY";
      signalReason = `Near Fib support at ${fibFloor} - entry zone`;
      setupType = "Fib Support Buy";
      targetPct = 10;
    }

    return {
      usdPrice: goldPrice,
      inrPricePer10g: round2(pricePer10g),
      goldbeesPrice: goldbeesQuote?.price ?? 0,
      usdInrRate: parseFloat(usdInrRate.toFixed(4)),
      dma50: round2(dma50),
      dma200: round2(dma200),
      rsi: round2(rsi),
      signal,
      signalReason,
      entry: round2(goldPrice),
      target: round2(goldPrice * (1 + targetPct / 100)),
      targetPct,
      stopLoss: round2(goldPrice * (1 - stopLossPct / 100)),
      stopLossPct,
      setupType,
      fibLevels,
      fibFloor,
      fibCeiling,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const [allIndia, allUS, gold] = await Promise.all([
      scanAllStocks(NIFTY_50_STOCKS),
      scanAllStocks(US_TOP_STOCKS),
      getGoldSetup(),
    ]);

    const bucketKeys: BucketKey[] = ["weeks", "3m", "6m", "9m", "12m"];
    const buckets: Record<BucketKey, { india: StockPick[]; us: StockPick[] }> = {} as any;

    for (const bk of bucketKeys) {
      buckets[bk] = {
        india: buildBucketPicks(allIndia, bk, 5),
        us: buildBucketPicks(allUS, bk, 5),
      };
    }

    return NextResponse.json({
      allIndia,
      allUS,
      buckets,
      gold,
      generatedAt: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[picks] API error:", err);
    return NextResponse.json({ error: "Failed to generate picks" }, { status: 500 });
  }
}
