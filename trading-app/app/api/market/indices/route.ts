import { NextResponse } from "next/server";
import { getQuotes } from "@/lib/market-data";
import { computeTechnical } from "@/lib/signals";
import { INDEX_SYMBOLS } from "@/lib/symbols";

export const revalidate = 300;

export async function GET() {
  try {
    const symbolList = Object.values(INDEX_SYMBOLS);
    const quotes = await getQuotes(symbolList);

    // Compute technicals for each index in parallel
    const technicals = await Promise.all(
      symbolList.map((s) => computeTechnical(s))
    );

    const indices = quotes.map((q) => {
      const tech = technicals.find((t) => t?.symbol === q.symbol);
      return {
        ...q,
        dma50: tech?.dma50 ?? null,
        dma100: tech?.dma100 ?? null,
        dma200: tech?.dma200 ?? null,
        trend: tech?.trend ?? null,
        rsi: tech?.rsi ?? null,
      };
    });

    return NextResponse.json({
      indices,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[api/market/indices] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch index data", indices: [] },
      { status: 500 }
    );
  }
}
