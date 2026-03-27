import { NextResponse } from "next/server";

const CRON_SECRET = process.env.CRON_SECRET || "";
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8692730838:AAHrThgIgUYaG1FjBZqClLkbgSIvUxKi7O4";
const HARDCODED_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "6747798646";

async function sendTelegram(chatId: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      console.error("[cron] Telegram error:", data.description);
    }
    return data.ok === true;
  } catch (err) {
    console.error("[cron] sendTelegram failed:", err);
    return false;
  }
}

async function findChatId(): Promise<string | null> {
  // 1. Use env var if set
  if (HARDCODED_CHAT_ID) return HARDCODED_CHAT_ID;

  // 2. Try @TradeX_Abhi_Puja channel
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: "@TradeX_Abhi_Puja" }),
    });
    const data = await res.json();
    if (data.ok && data.result?.id) return String(data.result.id);
  } catch {}

  // 3. Fallback: get from updates
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?limit=100`);
    const data = await res.json();
    if (data.ok && data.result?.length > 0) {
      for (let i = data.result.length - 1; i >= 0; i--) {
        const chatId =
          data.result[i].message?.chat?.id || data.result[i].channel_post?.chat?.id;
        if (chatId) return String(chatId);
      }
    }
  } catch {}

  return null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function fmtINR(v: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);
}
function fmtUSD(v: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

type Pick = {
  name?: string;
  symbol?: string;
  price: number;
  target: number;
  targetPct: number;
  stopLoss: number;
  stopLossPct: number;
  rsi?: number;
  setupType?: string;
  fibFloor?: number;
};

function renderBucketDetailed(
  title: string,
  picks: Pick[],
  currency: "INR" | "USD",
): string[] {
  if (!picks?.length) return [];
  const fmt = currency === "INR" ? fmtINR : fmtUSD;
  const lines: string[] = [`*${title}*`];
  picks.forEach((p, i) => {
    const name = (p.name || p.symbol || "").substring(0, 20);
    const setup = p.setupType ? ` — ${p.setupType}` : "";
    lines.push(`${i + 1}. *${name}*${setup}`);
    lines.push(`   Entry: ${fmt(p.price)} → Target: ${fmt(p.target)} (+${p.targetPct}%) | SL: ${fmt(p.stopLoss)} (-${p.stopLossPct}%)`);
    const extras: string[] = [];
    if (p.fibFloor) extras.push(`Fib Floor: ${fmt(p.fibFloor)}`);
    if (p.rsi) extras.push(`RSI: ${p.rsi.toFixed(1)}`);
    if (extras.length) lines.push(`   ${extras.join(" | ")}`);
  });
  return lines;
}

function renderBucketSummary(label: string, picks: Pick[]): string {
  if (!picks?.length) return "";
  const names = picks.map((p) => p.name || p.symbol || "?").join(", ");
  return `*${label}:* ${names}`;
}

function buildMessage(data: any, gold: any, macro: any): string {
  const now = new Date();
  const date = now.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const time = now.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
  });

  const lines: string[] = [];
  lines.push("*TradeX Pre-Market Brief*");
  lines.push(`${date} | ${time} IST`);
  lines.push("");

  // Macro regime
  const regime = macro?.regime || "UNKNOWN";
  lines.push(`*Market Regime:* ${String(regime).replace(/_/g, " ")}`);
  if (macro?.signals) {
    const bullish = macro.signals.filter((s: any) => s.signal === "BULLISH").length;
    const bearish = macro.signals.filter((s: any) => s.signal === "BEARISH").length;
    lines.push(`Bullish: ${bullish} | Bearish: ${bearish}`);
  }
  lines.push("");

  // Extract buckets
  const buckets = data?.buckets || {};
  const allIndia: Pick[] = data?.allIndia || [];
  const allUS: Pick[] = data?.allUS || [];

  // Helper to split picks by market
  const indiaPicks = (bucket: Pick[]) =>
    bucket?.filter((p: any) => allIndia.some((ip: any) => (ip.symbol || ip.name) === (p.symbol || p.name))) || bucket || [];
  const usPicks = (bucket: Pick[]) =>
    bucket?.filter((p: any) => allUS.some((up: any) => (up.symbol || up.name) === (p.symbol || p.name))) || [];

  // Weekly bucket — detailed
  const weeklyPicks = buckets.weeks || [];
  if (weeklyPicks.length) {
    // Split India vs US from weekly
    const wIndia = weeklyPicks.filter((p: any) =>
      allIndia.some((ip: any) => (ip.symbol || ip.name) === (p.symbol || p.name))
    );
    const wUS = weeklyPicks.filter((p: any) =>
      allUS.some((up: any) => (up.symbol || up.name) === (p.symbol || p.name))
    );

    if (wIndia.length) {
      lines.push(...renderBucketDetailed("\ud83c\uddee\ud83c\uddf3 Weekly India Picks", wIndia, "INR"));
      lines.push("");
    }
    if (wUS.length) {
      lines.push(...renderBucketDetailed("\ud83c\uddfa\ud83c\uddf8 Weekly US Picks", wUS, "USD"));
      lines.push("");
    }
  }

  // 3M bucket — detailed
  const threeMPicks = buckets["3m"] || [];
  if (threeMPicks.length) {
    const tIndia = threeMPicks.filter((p: any) =>
      allIndia.some((ip: any) => (ip.symbol || ip.name) === (p.symbol || p.name))
    );
    const tUS = threeMPicks.filter((p: any) =>
      allUS.some((up: any) => (up.symbol || up.name) === (p.symbol || p.name))
    );

    if (tIndia.length) {
      lines.push(...renderBucketDetailed("\ud83c\uddee\ud83c\uddf3 3-Month India Picks", tIndia, "INR"));
      lines.push("");
    }
    if (tUS.length) {
      lines.push(...renderBucketDetailed("\ud83c\uddfa\ud83c\uddf8 3-Month US Picks", tUS, "USD"));
      lines.push("");
    }
  }

  // 6M, 9M, 12M — summary lines to save space
  const summaryParts: string[] = [];
  if (buckets["6m"]?.length) summaryParts.push(renderBucketSummary("6M", buckets["6m"]));
  if (buckets["9m"]?.length) summaryParts.push(renderBucketSummary("9M", buckets["9m"]));
  if (buckets["12m"]?.length) summaryParts.push(renderBucketSummary("12M", buckets["12m"]));
  if (summaryParts.length) {
    lines.push(summaryParts.join(" | "));
    lines.push("");
  }

  // Gold
  if (gold || data?.gold) {
    const g = gold || data.gold;
    lines.push("*\ud83e\ude99 Gold Setup*");
    const usdPrice = g.usd?.price || g.priceUSD || 0;
    const inrPrice = g.inr?.pricePer10g || g.priceINR || 0;
    lines.push(`USD: ${fmtUSD(usdPrice)} | INR: ${fmtINR(inrPrice)}/10g`);
    const signal = g.signal || g.recommendation || "HOLD";
    const reason = g.signalReason || g.reason || "";
    lines.push(`Signal: ${signal}${reason ? ` — ${reason}` : ""}`);
    if (g.entry || usdPrice) {
      const entry = g.entry || usdPrice;
      const target = g.target || Math.round(entry * 1.08);
      const sl = g.stopLoss || Math.round(entry * 0.95);
      const targetPct = g.targetPct || Math.round(((target - entry) / entry) * 100);
      const slPct = g.stopLossPct || Math.round(((entry - sl) / entry) * 100);
      lines.push(`Entry: ${fmtUSD(entry)} → Target: ${fmtUSD(target)} (+${targetPct}%) | SL: ${fmtUSD(sl)} (-${slPct}%)`);
      if (g.fibFloor) {
        lines.push(`Fib Floor: ${fmtUSD(g.fibFloor)}`);
      }
    }
    lines.push("");
  }

  // Macro dashboard
  if (macro?.signals) {
    const dxy = macro.signals.find((s: any) => s.name === "DXY" || s.name === "Dollar Index");
    const vix = macro.signals.find((s: any) => s.name === "VIX" || s.name === "US VIX");
    const tenY = macro.signals.find((s: any) => s.name === "10Y" || s.name === "US 10Y Yield" || s.name?.includes("10Y"));
    const parts: string[] = [];
    if (dxy) parts.push(`DXY: ${dxy.value ?? dxy.price ?? "N/A"}`);
    if (vix) parts.push(`VIX: ${vix.value ?? vix.price ?? "N/A"}`);
    if (tenY) parts.push(`10Y: ${tenY.value ?? tenY.price ?? "N/A"}%`);
    if (parts.length) {
      lines.push(`*\ud83d\udcca Macro Dashboard*`);
      lines.push(parts.join(" | "));
      lines.push("");
    }
  }

  lines.push("_Pre-market scan by TradeX AI Engine_");
  return lines.join("\n");
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function GET(req: Request) {
  // Verify cron secret (Vercel sends this header)
  const authHeader = req.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const baseUrl = new URL(req.url).origin;

    // Fetch all data in parallel
    const [picksRes, goldRes, macroRes] = await Promise.all([
      fetch(`${baseUrl}/api/market/picks`, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      fetch(`${baseUrl}/api/market/gold`, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      fetch(`${baseUrl}/api/market/macro`, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
    ]);

    const message = buildMessage(picksRes, goldRes, macroRes);

    // Find chat ID and send
    const chatId = await findChatId();
    if (!chatId) {
      console.error("[cron] No Telegram chat found. Send /start to @TradeX_Abhi_Puja_Bot first, or set TELEGRAM_CHAT_ID env var.");
      return NextResponse.json({
        success: false,
        error: "No Telegram chat found. Send /start to @TradeX_Abhi_Puja_Bot or set TELEGRAM_CHAT_ID env var.",
        preview: message,
      });
    }

    const sent = await sendTelegram(chatId, message);

    console.log(`[cron] Daily picks ${sent ? "sent" : "FAILED"} to chat ${chatId}`);

    const buckets = picksRes?.buckets || {};
    return NextResponse.json({
      success: sent,
      chatId,
      timestamp: new Date().toISOString(),
      picksCount: {
        weekly: buckets.weeks?.length || 0,
        "3m": buckets["3m"]?.length || 0,
        "6m": buckets["6m"]?.length || 0,
        "9m": buckets["9m"]?.length || 0,
        "12m": buckets["12m"]?.length || 0,
        gold: goldRes || picksRes?.gold ? 1 : 0,
      },
    });
  } catch (err) {
    console.error("[cron] Daily picks error:", err);
    return NextResponse.json({ success: false, error: "Cron job failed" }, { status: 500 });
  }
}
