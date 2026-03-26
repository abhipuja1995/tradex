import { NextResponse } from "next/server";
import { getQuotes } from "@/lib/market-data";
import { MACRO_SYMBOLS } from "@/lib/symbols";

export const revalidate = 300;

export async function GET() {
  try {
    const symbols = [MACRO_SYMBOLS.INDIA_VIX, MACRO_SYMBOLS.US_VIX];
    const quotes = await getQuotes(symbols);

    const indiaVix = quotes.find((q) => q.symbol === "^INDIAVIX" || q.symbol === MACRO_SYMBOLS.INDIA_VIX);
    const usVix = quotes.find((q) => q.symbol === "^VIX" || q.symbol === MACRO_SYMBOLS.US_VIX);

    const vixSignal = (vixValue: number | undefined): {
      level: "LOW" | "NORMAL" | "ELEVATED" | "EXTREME";
      signal: "BULLISH" | "NEUTRAL" | "BEARISH";
      description: string;
    } => {
      if (vixValue == null) {
        return { level: "NORMAL", signal: "NEUTRAL", description: "Data unavailable" };
      }
      if (vixValue > 30) {
        return { level: "EXTREME", signal: "BEARISH", description: "Extreme fear - markets highly volatile" };
      }
      if (vixValue > 25) {
        return { level: "ELEVATED", signal: "BEARISH", description: "Elevated fear - caution warranted" };
      }
      if (vixValue < 15) {
        return { level: "LOW", signal: "BULLISH", description: "Low volatility - risk-on environment" };
      }
      return { level: "NORMAL", signal: "NEUTRAL", description: "Volatility in normal range" };
    }

    return NextResponse.json({
      indiaVix: indiaVix
        ? { ...indiaVix, ...vixSignal(indiaVix.price) }
        : null,
      usVix: usVix
        ? { ...usVix, ...vixSignal(usVix.price) }
        : null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[api/market/volatility] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch volatility data", indiaVix: null, usVix: null },
      { status: 500 }
    );
  }
}
