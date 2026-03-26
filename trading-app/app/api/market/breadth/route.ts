import { NextResponse } from "next/server";
import { marketBreadth } from "@/lib/market-data";
import { NIFTY_50_STOCKS } from "@/lib/symbols";

export const revalidate = 300;

export async function GET() {
  try {
    const [breadth200, breadth50] = await Promise.all([
      marketBreadth(NIFTY_50_STOCKS, 200),
      marketBreadth(NIFTY_50_STOCKS, 50),
    ]);

    let health: "STRONG" | "MODERATE" | "WEAK";
    if (breadth200.percent >= 60) {
      health = "STRONG";
    } else if (breadth200.percent >= 40) {
      health = "MODERATE";
    } else {
      health = "WEAK";
    }

    return NextResponse.json({
      dma200: breadth200,
      dma50: breadth50,
      health,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[api/market/breadth] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to compute market breadth",
        dma200: { above: 0, total: 0, percent: 0 },
        dma50: { above: 0, total: 0, percent: 0 },
        health: "WEAK",
      },
      { status: 500 }
    );
  }
}
