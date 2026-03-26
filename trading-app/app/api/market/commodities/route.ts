import { NextResponse } from "next/server";
import { getQuotes } from "@/lib/market-data";
import { computeTechnical } from "@/lib/signals";
import { COMMODITY_SYMBOLS, MACRO_SYMBOLS } from "@/lib/symbols";

export const revalidate = 300;

export async function GET() {
  try {
    const symbols = [
      COMMODITY_SYMBOLS.GOLD,
      COMMODITY_SYMBOLS.SILVER,
      COMMODITY_SYMBOLS.GOLD_INR,
      MACRO_SYMBOLS.CRUDE_OIL,
      MACRO_SYMBOLS.BRENT,
    ];

    const quotes = await getQuotes(symbols);

    const technicals = await Promise.all(
      symbols.map((s) => computeTechnical(s))
    );

    const commodities = quotes.map((q) => {
      const tech = technicals.find((t) => t?.symbol === q.symbol);
      return {
        ...q,
        trend: tech?.trend ?? null,
        rsi: tech?.rsi ?? null,
        dma200: tech?.dma200 ?? null,
      };
    });

    return NextResponse.json({
      commodities,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[api/market/commodities] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch commodity data", commodities: [] },
      { status: 500 }
    );
  }
}
