import { NextResponse } from "next/server";
import { getQuote, getChartData, calculateDMA, calculateRSI } from "@/lib/market-data";
import { MACRO_SYMBOLS, COMMODITY_SYMBOLS } from "@/lib/symbols";

export const revalidate = 300;

export async function GET() {
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

    // Gold price conversion: troy oz → grams → per 10g in INR
    const pricePerGram = (goldPrice * usdInrRate) / 31.1035;
    const pricePer10g = pricePerGram * 10;

    // Technicals
    let dma50 = 0, dma200 = 0, rsi = 50;
    if (goldChart && goldChart.closes.length >= 200) {
      const dma50Arr = calculateDMA(goldChart.closes, 50);
      const dma200Arr = calculateDMA(goldChart.closes, 200);
      const rsiArr = calculateRSI(goldChart.closes, 14);
      dma50 = dma50Arr[dma50Arr.length - 1];
      dma200 = dma200Arr[dma200Arr.length - 1];
      rsi = rsiArr[rsiArr.length - 1];
      if (isNaN(dma50)) dma50 = 0;
      if (isNaN(dma200)) dma200 = 0;
      if (isNaN(rsi)) rsi = 50;
    }

    // Signal logic
    let signal: "BUY" | "SELL" | "HOLD" = "HOLD";
    let signalReason = "Gold is range-bound, hold current position";

    const dxyBelow100 = (dxyQuote?.price ?? 105) < 100;
    const yieldsFalling = (yieldQuote?.change ?? 0) < 0;
    const vixHigh = (vixQuote?.price ?? 15) > 25;
    const overbought = rsi > 70 && goldPrice > dma200;
    const belowSupport = goldPrice < dma50;

    if (dxyBelow100 && yieldsFalling) {
      signal = "BUY";
      signalReason = "Weak dollar + falling yields support gold";
    } else if (vixHigh) {
      signal = "BUY";
      signalReason = "Fear rising (VIX > 25) - gold is safe haven";
    } else if (overbought) {
      signal = "SELL";
      signalReason = "Overbought (RSI > 70) - book profits at resistance";
    } else if (belowSupport) {
      signal = "HOLD";
      signalReason = "Below 50 DMA support - wait for reversal confirmation";
    }

    return NextResponse.json({
      usd: {
        price: goldPrice,
        change: goldQuote?.change ?? 0,
        changePercent: goldQuote?.changePercent ?? 0,
        dma50: parseFloat(dma50.toFixed(2)),
        dma200: parseFloat(dma200.toFixed(2)),
        rsi: parseFloat(rsi.toFixed(2)),
      },
      inr: {
        pricePerGram: parseFloat(pricePerGram.toFixed(2)),
        pricePer10g: parseFloat(pricePer10g.toFixed(2)),
        goldbees: goldbeesQuote
          ? { price: goldbeesQuote.price, change: goldbeesQuote.change, changePercent: goldbeesQuote.changePercent }
          : null,
      },
      usdInrRate: parseFloat(usdInrRate.toFixed(4)),
      signal,
      signalReason,
      support50dma: parseFloat(dma50.toFixed(2)),
      support200dma: parseFloat(dma200.toFixed(2)),
      macro: {
        dxy: dxyQuote?.price ?? null,
        vix: vixQuote?.price ?? null,
        yield10y: yieldQuote?.price ?? null,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[gold] API error:", err);
    return NextResponse.json({ error: "Failed to fetch gold data" }, { status: 500 });
  }
}
