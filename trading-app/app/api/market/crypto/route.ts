import { NextResponse } from "next/server";
import { getQuotes } from "@/lib/market-data";
import { CRYPTO_SYMBOLS } from "@/lib/symbols";

export const revalidate = 300;

export async function GET() {
  try {
    const symbols = Object.values(CRYPTO_SYMBOLS);
    const quotes = await getQuotes(symbols);

    return NextResponse.json({
      crypto: quotes,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[api/market/crypto] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch crypto data", crypto: [] },
      { status: 500 }
    );
  }
}
