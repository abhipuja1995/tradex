import { NextResponse } from "next/server";
import { generateMacroSignals } from "@/lib/signals";

export const revalidate = 300;

export async function GET() {
  try {
    const { signals, regime } = await generateMacroSignals();

    return NextResponse.json({
      regime,
      signals,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[api/market/macro] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch macro signals", signals: [], regime: "TRANSITION" },
      { status: 500 }
    );
  }
}
