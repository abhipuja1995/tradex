"use client";

import React, { useEffect, useState, useCallback, Component, ReactNode } from "react";

// ── Error Boundary ──────────────────────────────────────────────────────────

class SectionErrorBoundary extends Component<
  { children: ReactNode; fallback?: string },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: ReactNode; fallback?: string }) {
    super(props);
    this.state = { hasError: false, error: "" };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="glass-panel" style={{ padding: "2rem", textAlign: "center", color: "#f97316", fontSize: "0.85rem" }}>
          {this.props.fallback || "Error"}: {this.state.error}
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Types ──────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

type BucketConfig = {
  key: string;
  label: string;
  strategy: string;
  targetIRR: string;
  maxDrawdown: string;
  maxCapPerTrade: string;
  optionsAllocation: string;
  cryptoCap: string;
  targetPct: number;
  stopLossPct: number;
  duration: string;
  preferredSetups: string[];
};

// ── Bucket Definitions with trading parameters ─────────────────────────────

const BUCKETS: BucketConfig[] = [
  {
    key: "weeks", label: "Weeks", strategy: "Momentum + Options Hedge",
    targetIRR: "20-30%", maxDrawdown: "<5%", maxCapPerTrade: "5%",
    optionsAllocation: "2%", cryptoCap: "10%",
    targetPct: 10, stopLossPct: 5, duration: "2-4 Weeks",
    preferredSetups: ["Momentum Breakout", "Fresh Breakout"],
  },
  {
    key: "3m", label: "3 Months", strategy: "Swing Breakout + Sector Rotation",
    targetIRR: "25-35%", maxDrawdown: "<5%", maxCapPerTrade: "5%",
    optionsAllocation: "2%", cryptoCap: "12%",
    targetPct: 20, stopLossPct: 8, duration: "3 Months",
    preferredSetups: ["Momentum Breakout", "Sector Leader", "Fresh Breakout"],
  },
  {
    key: "6m", label: "6 Months", strategy: "Trend Following + Value Accumulation",
    targetIRR: "18-28%", maxDrawdown: "<6%", maxCapPerTrade: "5%",
    optionsAllocation: "2%", cryptoCap: "12%",
    targetPct: 25, stopLossPct: 10, duration: "6 Months",
    preferredSetups: ["Pullback to Support", "Sector Leader", "Growth Breakout"],
  },
  {
    key: "9m", label: "9 Months", strategy: "Multi-Factor + Dividend Capture",
    targetIRR: "22-30%", maxDrawdown: "<7%", maxCapPerTrade: "5%",
    optionsAllocation: "2%", cryptoCap: "15%",
    targetPct: 30, stopLossPct: 12, duration: "9 Months",
    preferredSetups: ["Growth Breakout", "Recovery Play", "Sector Leader"],
  },
  {
    key: "12m", label: "12 Months", strategy: "Core Satellite + Macro Overlay",
    targetIRR: "25-40%", maxDrawdown: "<7%", maxCapPerTrade: "5%",
    optionsAllocation: "2%", cryptoCap: "15%",
    targetPct: 35, stopLossPct: 15, duration: "12 Months",
    preferredSetups: ["Recovery Play", "Pullback to Support", "Growth Breakout"],
  },
];

// ── Shared Styles ──────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: "0.7rem",
  color: "#94a3b8",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: "0.35rem",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "0.5rem 0.6rem",
  color: "#94a3b8",
  fontWeight: 500,
  fontSize: "0.7rem",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const tdStyle: React.CSSProperties = {
  padding: "0.5rem 0.6rem",
  fontSize: "0.8rem",
};

const gradientBorders: Record<string, string> = {
  weeks: "linear-gradient(135deg, #3b82f6, #22c55e)",
  "3m": "linear-gradient(135deg, #8b5cf6, #3b82f6)",
  "6m": "linear-gradient(135deg, #22c55e, #eab308)",
  "9m": "linear-gradient(135deg, #f97316, #ef4444)",
  "12m": "linear-gradient(135deg, #ec4899, #8b5cf6)",
};

// ── Helpers ────────────────────────────────────────────────────────────────

function safeNum(v: unknown, fallback = 0): number {
  if (v == null) return fallback;
  const n = Number(v);
  return isNaN(n) ? fallback : n;
}

function fmtINR(v: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}

function fmtUSD(v: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}

function changeColor(v: number) {
  return v > 0 ? "#22c55e" : v < 0 ? "#ef4444" : "#94a3b8";
}

function signalBadge(signal: string): { bg: string; color: string } {
  if (signal === "BUY") return { bg: "rgba(34,197,94,0.15)", color: "#22c55e" };
  if (signal === "SELL") return { bg: "rgba(239,68,68,0.15)", color: "#ef4444" };
  return { bg: "rgba(234,179,8,0.12)", color: "#eab308" };
}

/** Calculate how close current price is to its Fibonacci floor (lower = better buying opportunity) */
function fibProximityPct(price: number, fibFloor: number): number {
  if (!fibFloor || fibFloor <= 0) return 999;
  return ((price - fibFloor) / fibFloor) * 100;
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function InvestmentsPage() {
  const [activeBucket, setActiveBucket] = useState("weeks");
  const [picks, setPicks] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [killSwitchActive, setKillSwitchActive] = useState(true);
  const [sendingTelegram, setSendingTelegram] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<string | null>(null);

  const bucket = BUCKETS.find((b) => b.key === activeBucket)!;

  const fetchPicks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/market/picks");
      const data = await res.json();
      setPicks(data);
    } catch {
      setPicks(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPicks();
    const interval = setInterval(fetchPicks, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchPicks]);

  const sendToTelegram = async () => {
    setSendingTelegram(true);
    setTelegramStatus(null);
    try {
      const res = await fetch("/api/notify/telegram", { method: "POST" });
      const data = await res.json();
      setTelegramStatus(data.success ? "Sent to Telegram!" : data.message || "Failed to send");
    } catch {
      setTelegramStatus("Error sending to Telegram");
    } finally {
      setSendingTelegram(false);
      setTimeout(() => setTelegramStatus(null), 5000);
    }
  };

  // Read bucket-specific picks directly from pre-computed API data
  const bucketData = picks?.buckets?.[activeBucket];
  const indiaPicks: any[] = Array.isArray(bucketData?.india) ? bucketData.india : [];
  const usPicks: any[] = Array.isArray(bucketData?.us) ? bucketData.us : [];
  const goldSetup: any = picks?.gold || null;

  // Full Nifty 50 pool for Fibonacci floor section
  const allIndiaStocks: any[] = Array.isArray(picks?.allIndia) ? picks.allIndia : [];
  const fibNifty50 = allIndiaStocks
    .filter((s: any) => safeNum(s.fibFloor) > 0)
    .map((s: any) => ({
      ...s,
      proximity: fibProximityPct(safeNum(s.price), safeNum(s.fibFloor)),
    }))
    .sort((a: any, b: any) => a.proximity - b.proximity);

  return (
    <div className="container">
      {/* Header */}
      <div style={{ marginBottom: "1.25rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <h1 className="title" style={{ marginBottom: "0.25rem" }}>Investments</h1>
          <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
            Top picks with entry/target/SL — Target IRR: 20-30%
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {telegramStatus && (
            <span style={{ fontSize: "0.75rem", color: telegramStatus.includes("Sent") ? "#22c55e" : "#ef4444" }}>
              {telegramStatus}
            </span>
          )}
          <button
            onClick={sendToTelegram}
            disabled={sendingTelegram}
            style={{
              background: "rgba(59,130,246,0.15)",
              color: "#3b82f6",
              border: "1px solid rgba(59,130,246,0.3)",
              padding: "0.45rem 1rem",
              borderRadius: "8px",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: sendingTelegram ? "wait" : "pointer",
              opacity: sendingTelegram ? 0.6 : 1,
            }}
          >
            {sendingTelegram ? "Sending..." : "Send to Telegram"}
          </button>
        </div>
      </div>

      {/* Time Bucket Tabs */}
      <div
        style={{
          display: "flex",
          gap: "0.25rem",
          marginBottom: "1.5rem",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          overflowX: "auto",
        }}
      >
        {BUCKETS.map((b) => (
          <button
            key={b.key}
            onClick={() => setActiveBucket(b.key)}
            style={{
              background: activeBucket === b.key ? "rgba(255,255,255,0.05)" : "transparent",
              color: activeBucket === b.key ? "#f1f5f9" : "#94a3b8",
              border: activeBucket === b.key ? "1px solid rgba(255,255,255,0.1)" : "1px solid transparent",
              borderBottom: activeBucket === b.key ? "1px solid #0f172a" : "1px solid transparent",
              padding: "0.55rem 1.1rem",
              borderRadius: "8px 8px 0 0",
              fontSize: "0.82rem",
              fontWeight: activeBucket === b.key ? 600 : 400,
              cursor: "pointer",
              transition: "all 0.15s",
              marginBottom: "-1px",
              whiteSpace: "nowrap",
            }}
          >
            {b.label}
          </button>
        ))}
      </div>

      {/* Strategy Card */}
      <div
        style={{
          padding: "2px",
          borderRadius: "14px",
          background: gradientBorders[activeBucket] || gradientBorders.weeks,
          marginBottom: "1.25rem",
        }}
      >
        <div
          className="glass-panel"
          style={{
            padding: "1.25rem 1.5rem",
            borderRadius: "12px",
            display: "grid",
            gridTemplateColumns: "1fr auto auto auto",
            gap: "1.5rem",
            alignItems: "center",
          }}
        >
          <div>
            <div style={labelStyle}>Strategy</div>
            <div style={{ fontSize: "1.15rem", fontWeight: 700 }}>{bucket.strategy}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={labelStyle}>Target IRR</div>
            <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#22c55e" }}>{bucket.targetIRR}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={labelStyle}>Max Drawdown</div>
            <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#ef4444" }}>{bucket.maxDrawdown}</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={labelStyle}>Holding</div>
            <div style={{ fontSize: "1rem", fontWeight: 600, color: "#3b82f6" }}>{bucket.duration}</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="glass-panel" style={{ padding: "3rem", textAlign: "center", color: "#94a3b8" }}>
          Scanning stocks... This may take a minute.
        </div>
      ) : (
        <>
          {/* India Top 5 */}
          <SectionErrorBoundary fallback="India picks error">
            <PicksTable title="India Top 5" flag="IN" currency="INR" picks={indiaPicks} bucket={bucket} />
          </SectionErrorBoundary>

          {/* US Top 5 */}
          <SectionErrorBoundary fallback="US picks error">
            <PicksTable title="US Top 5" flag="US" currency="USD" picks={usPicks} bucket={bucket} />
          </SectionErrorBoundary>

          {/* Gold Setup */}
          <SectionErrorBoundary fallback="Gold setup error">
            <GoldSetupCard gold={goldSetup} bucket={bucket} />
          </SectionErrorBoundary>

          {/* Fibonacci Floor Prices — Nifty 50 */}
          <SectionErrorBoundary fallback="Fibonacci floors error">
            <FibFloorSection stocks={fibNifty50} />
          </SectionErrorBoundary>
        </>
      )}

      {/* Bottom Grid: Risk Rules + Kill Switch */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1.25rem", marginTop: "1.25rem" }}>
        <div className="glass-panel" style={{ padding: "1.25rem" }}>
          <h2 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.75rem" }}>Risk Rules</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <RuleRow label="Max capital per trade" value={bucket.maxCapPerTrade} />
            <RuleRow label="Options allocation" value={bucket.optionsAllocation} />
            <RuleRow label="Crypto cap" value={bucket.cryptoCap} />
            <RuleRow label="Target per pick" value={`+${bucket.targetPct}%`} />
            <RuleRow label="Stop loss per pick" value={`-${bucket.stopLossPct}%`} />
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "1.25rem" }}>
          <h2 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.75rem" }}>Portfolio Philosophy</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <PhilosophyBar label="Systematic" sublabel="Signals + Models" pct={70} color="#3b82f6" />
            <PhilosophyBar label="Discretionary" sublabel="Macro Overlays" pct={30} color="#8b5cf6" />
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "1.25rem" }}>
          <h2 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            Kill Switch
            <span style={{
              background: killSwitchActive ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
              color: killSwitchActive ? "#22c55e" : "#ef4444",
              padding: "0.12rem 0.5rem", borderRadius: "4px", fontSize: "0.68rem", fontWeight: 600,
            }}>
              {killSwitchActive ? "ACTIVE" : "INACTIVE"}
            </span>
          </h2>
          <p style={{ color: "#94a3b8", fontSize: "0.8rem", marginBottom: "0.75rem" }}>
            If portfolio drawdown exceeds 10%, all trading stops automatically.
          </p>
          <button
            onClick={() => setKillSwitchActive((prev) => !prev)}
            style={{
              width: "100%", background: killSwitchActive ? "#ef4444" : "#22c55e",
              color: "#fff", border: "none", padding: "0.5rem", borderRadius: "8px",
              fontSize: "0.8rem", fontWeight: 600, cursor: "pointer",
            }}
          >
            {killSwitchActive ? "Deactivate Kill Switch" : "Activate Kill Switch"}
          </button>
        </div>
      </div>

      {picks?.generatedAt && (
        <div style={{ marginTop: "1rem", textAlign: "right", fontSize: "0.7rem", color: "#64748b" }}>
          Picks generated: {picks.generatedAt}
        </div>
      )}
    </div>
  );
}

// ── Picks Table ─────────────────────────────────────────────────────────────

function PicksTable({ title, flag, currency, picks, bucket }: {
  title: string; flag: string; currency: string; picks: any[]; bucket: BucketConfig;
}) {
  const fmt = currency === "INR" ? fmtINR : fmtUSD;

  if (picks.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: "1.5rem", marginBottom: "1.25rem" }}>
        <h2 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.5rem" }}>
          {flag === "IN" ? "\uD83C\uDDEE\uD83C\uDDF3" : "\uD83C\uDDFA\uD83C\uDDF8"} {title}
        </h2>
        <div style={{ color: "#94a3b8", fontSize: "0.85rem" }}>No picks available — scanning in progress</div>
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ padding: "1.25rem", marginBottom: "1.25rem" }}>
      <h2 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        {flag === "IN" ? "\uD83C\uDDEE\uD83C\uDDF3" : "\uD83C\uDDFA\uD83C\uDDF8"} {title}
        <span style={{ background: "rgba(59,130,246,0.15)", color: "#3b82f6", padding: "0.1rem 0.5rem", borderRadius: 4, fontSize: "0.7rem" }}>
          {picks.length} picks
        </span>
        <span style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 400 }}>
          {bucket.duration} horizon
        </span>
      </h2>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Stock</th>
              <th style={thStyle}>Entry</th>
              <th style={thStyle}>Fib Floor</th>
              <th style={thStyle}>Target</th>
              <th style={thStyle}>Stop Loss</th>
              <th style={thStyle}>Duration</th>
              <th style={thStyle}>RSI</th>
              <th style={thStyle}>Setup</th>
              <th style={thStyle}>Signal</th>
            </tr>
          </thead>
          <tbody>
            {picks.map((p: any, i: number) => {
              const sig = signalBadge(p.signal || "WATCH");
              const entry = safeNum(p.entry || p.price);
              const target = safeNum(p.target);
              const sl = safeNum(p.stopLoss);
              const rsi = safeNum(p.rsi);
              const tPct = safeNum(p.targetPct);
              const slPct = safeNum(p.stopLossPct);
              const fibFloor = safeNum(p.fibFloor);

              return (
                <tr key={(p.symbol || "") + i} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>
                    <div>{p.name || p.symbol}</div>
                    <div style={{ fontSize: "0.65rem", color: "#64748b" }}>{p.symbol}</div>
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>
                    {fmt(entry)}
                  </td>
                  <td style={tdStyle}>
                    {fibFloor > 0 ? (
                      <div>
                        <div style={{ color: "#eab308", fontWeight: 600 }}>{fmt(fibFloor)}</div>
                        <div style={{ fontSize: "0.65rem", color: entry > fibFloor ? "#22c55e" : "#ef4444" }}>
                          {entry > fibFloor ? "+" : ""}{((entry - fibFloor) / fibFloor * 100).toFixed(1)}% above
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: "#64748b", fontSize: "0.75rem" }}>—</span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ color: "#22c55e", fontWeight: 600 }}>{fmt(target)}</div>
                    <div style={{ fontSize: "0.68rem", color: "#22c55e" }}>+{tPct}%</div>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ color: "#ef4444", fontWeight: 600 }}>{fmt(sl)}</div>
                    <div style={{ fontSize: "0.68rem", color: "#ef4444" }}>-{slPct}%</div>
                  </td>
                  <td style={{ ...tdStyle, fontSize: "0.75rem", color: "#94a3b8" }}>{p.duration || bucket.duration}</td>
                  <td style={{
                    ...tdStyle,
                    color: rsi > 70 ? "#ef4444" : rsi < 30 ? "#22c55e" : "#f1f5f9",
                    fontWeight: 600,
                  }}>
                    {rsi.toFixed(1)}
                  </td>
                  <td style={{ ...tdStyle, fontSize: "0.72rem", color: "#94a3b8" }}>{p.setupType || "Watch"}</td>
                  <td style={tdStyle}>
                    <span style={{
                      background: sig.bg, color: sig.color,
                      padding: "0.15rem 0.5rem", borderRadius: "4px",
                      fontSize: "0.7rem", fontWeight: 600,
                    }}>
                      {p.signal || "WATCH"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Gold Setup Card ─────────────────────────────────────────────────────────

function GoldSetupCard({ gold, bucket }: { gold: any; bucket: BucketConfig }) {
  if (!gold) {
    return (
      <div className="glass-panel" style={{ padding: "1.5rem", marginBottom: "1.25rem" }}>
        <h2 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.5rem" }}>Gold Trade Setup</h2>
        <div style={{ color: "#94a3b8", fontSize: "0.85rem" }}>No gold setup available</div>
      </div>
    );
  }

  const sig = signalBadge(gold.signal || "HOLD");
  const goldPrice = safeNum(gold.usdPrice || gold.entry);
  const goldTarget = parseFloat((goldPrice * (1 + bucket.targetPct / 100)).toFixed(2));
  const goldSL = parseFloat((goldPrice * (1 - bucket.stopLossPct / 100)).toFixed(2));

  const fibLevels = gold.fibLevels || gold.fibonacci || null;

  return (
    <div className="glass-panel" style={{ padding: "1.25rem", marginBottom: "1.25rem" }}>
      <h2 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        Gold Trade Setup
        <span style={{
          background: sig.bg, color: sig.color,
          padding: "0.12rem 0.5rem", borderRadius: "4px", fontSize: "0.7rem", fontWeight: 600,
        }}>
          {gold.signal}
        </span>
        <span style={{ fontSize: "0.7rem", color: "#64748b", fontWeight: 400 }}>
          {bucket.duration} horizon
        </span>
      </h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "1rem" }}>
        <div>
          <div style={labelStyle}>USD Price</div>
          <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>{fmtUSD(goldPrice)}</div>
        </div>
        <div>
          <div style={labelStyle}>INR Price (per 10g)</div>
          <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#eab308" }}>
            {fmtINR(safeNum(gold.inrPricePer10g))}
          </div>
        </div>
        <div>
          <div style={labelStyle}>Entry</div>
          <div style={{ fontSize: "1rem", fontWeight: 600 }}>{fmtUSD(goldPrice)}</div>
        </div>
        <div>
          <div style={labelStyle}>Target (+{bucket.targetPct}%)</div>
          <div style={{ fontSize: "1rem", fontWeight: 600, color: "#22c55e" }}>
            {fmtUSD(goldTarget)}
          </div>
        </div>
        <div>
          <div style={labelStyle}>Stop Loss (-{bucket.stopLossPct}%)</div>
          <div style={{ fontSize: "1rem", fontWeight: 600, color: "#ef4444" }}>
            {fmtUSD(goldSL)}
          </div>
        </div>
        <div>
          <div style={labelStyle}>RSI / Setup</div>
          <div style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
            RSI: {safeNum(gold.rsi).toFixed(1)} | {gold.setupType || "Swing"}
          </div>
        </div>
      </div>

      {/* Fibonacci Levels for Gold */}
      {fibLevels && (
        <div style={{ marginTop: "1rem", padding: "0.75rem", background: "rgba(234,179,8,0.06)", borderRadius: "8px", border: "1px solid rgba(234,179,8,0.15)" }}>
          <div style={{ ...labelStyle, color: "#eab308", marginBottom: "0.6rem" }}>Fibonacci Levels</div>
          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", fontSize: "0.8rem" }}>
            {fibLevels.level236 != null && (
              <span style={{ color: "#94a3b8" }}>23.6%: <span style={{ color: "#f1f5f9", fontWeight: 600 }}>{fmtUSD(safeNum(fibLevels.level236))}</span></span>
            )}
            {fibLevels.level382 != null && (
              <span style={{ color: "#94a3b8" }}>38.2%: <span style={{ color: "#f1f5f9", fontWeight: 600 }}>{fmtUSD(safeNum(fibLevels.level382))}</span></span>
            )}
            {fibLevels.level500 != null && (
              <span style={{ color: "#94a3b8" }}>50.0%: <span style={{ color: "#eab308", fontWeight: 600 }}>{fmtUSD(safeNum(fibLevels.level500))}</span></span>
            )}
            {fibLevels.level618 != null && (
              <span style={{ color: "#94a3b8" }}>61.8%: <span style={{ color: "#f1f5f9", fontWeight: 600 }}>{fmtUSD(safeNum(fibLevels.level618))}</span></span>
            )}
            {fibLevels.level786 != null && (
              <span style={{ color: "#94a3b8" }}>78.6%: <span style={{ color: "#f1f5f9", fontWeight: 600 }}>{fmtUSD(safeNum(fibLevels.level786))}</span></span>
            )}
          </div>
        </div>
      )}

      <div style={{ marginTop: "0.75rem", padding: "0.6rem", background: "rgba(255,255,255,0.03)", borderRadius: "8px" }}>
        <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
          <span style={{ fontWeight: 600, color: changeColor(gold.signal === "BUY" ? 1 : gold.signal === "SELL" ? -1 : 0) }}>
            {gold.signal}:
          </span>{" "}
          {gold.signalReason}
        </div>
      </div>

      <div style={{ marginTop: "0.75rem", display: "flex", gap: "1.5rem", fontSize: "0.75rem" }}>
        <span style={{ color: "#94a3b8" }}>50 DMA: <span style={{ color: "#f1f5f9", fontWeight: 600 }}>{fmtUSD(safeNum(gold.dma50))}</span></span>
        <span style={{ color: "#94a3b8" }}>200 DMA: <span style={{ color: "#f1f5f9", fontWeight: 600 }}>{fmtUSD(safeNum(gold.dma200))}</span></span>
        <span style={{ color: "#94a3b8" }}>GOLDBEES: <span style={{ color: "#f1f5f9", fontWeight: 600 }}>{fmtINR(safeNum(gold.goldbeesPrice))}</span></span>
      </div>
    </div>
  );
}

// ── Fibonacci Floor Prices — Nifty 50 ───────────────────────────────────────

function FibFloorSection({ stocks }: { stocks: any[] }) {
  const [showAll, setShowAll] = useState(false);

  if (stocks.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: "1.5rem", marginBottom: "1.25rem" }}>
        <h2 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.5rem" }}>
          Fibonacci Floor Prices — Nifty 50
        </h2>
        <div style={{ color: "#94a3b8", fontSize: "0.85rem" }}>No Fibonacci data available</div>
      </div>
    );
  }

  const displayed = showAll ? stocks : stocks.slice(0, 15);

  return (
    <div className="glass-panel" style={{ padding: "1.25rem", marginBottom: "1.25rem" }}>
      <h2 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        Fibonacci Floor Prices — Nifty 50
        <span style={{ background: "rgba(234,179,8,0.12)", color: "#eab308", padding: "0.1rem 0.5rem", borderRadius: 4, fontSize: "0.7rem" }}>
          {stocks.length} stocks
        </span>
      </h2>
      <p style={{ color: "#94a3b8", fontSize: "0.78rem", marginBottom: "0.75rem" }}>
        Sorted by proximity to Fibonacci support — best buying opportunities at the top
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>#</th>
              <th style={thStyle}>Stock</th>
              <th style={thStyle}>CMP</th>
              <th style={thStyle}>Fib Floor</th>
              <th style={thStyle}>Distance to Floor</th>
              <th style={thStyle}>RSI</th>
              <th style={thStyle}>Signal</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((s: any, i: number) => {
              const cmp = safeNum(s.price);
              const floor = safeNum(s.fibFloor);
              const proximity = safeNum(s.proximity);
              const rsi = safeNum(s.rsi);
              const sig = signalBadge(s.signal || "WATCH");

              // Color-code proximity: close to floor = green (good buy), far = neutral
              const proxColor = proximity < 5 ? "#22c55e" : proximity < 15 ? "#eab308" : "#94a3b8";

              return (
                <tr key={(s.symbol || "") + i} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <td style={{ ...tdStyle, color: "#64748b", fontSize: "0.72rem" }}>{i + 1}</td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>
                    <div>{s.name || s.symbol}</div>
                    <div style={{ fontSize: "0.65rem", color: "#64748b" }}>{s.symbol}</div>
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{fmtINR(cmp)}</td>
                  <td style={{ ...tdStyle, fontWeight: 600, color: "#eab308" }}>{fmtINR(floor)}</td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <div style={{
                        width: "50px", height: "6px", background: "rgba(255,255,255,0.06)",
                        borderRadius: "3px", overflow: "hidden",
                      }}>
                        <div style={{
                          width: `${Math.max(2, Math.min(100, 100 - proximity * 2))}%`,
                          height: "100%", background: proxColor, borderRadius: "3px",
                        }} />
                      </div>
                      <span style={{ color: proxColor, fontWeight: 600, fontSize: "0.78rem" }}>
                        +{proximity.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td style={{
                    ...tdStyle,
                    color: rsi > 70 ? "#ef4444" : rsi < 30 ? "#22c55e" : "#f1f5f9",
                    fontWeight: 600,
                  }}>
                    {rsi > 0 ? rsi.toFixed(1) : "—"}
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      background: sig.bg, color: sig.color,
                      padding: "0.15rem 0.5rem", borderRadius: "4px",
                      fontSize: "0.7rem", fontWeight: 600,
                    }}>
                      {s.signal || "WATCH"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {stocks.length > 15 && (
        <button
          onClick={() => setShowAll((prev) => !prev)}
          style={{
            marginTop: "0.75rem",
            background: "rgba(255,255,255,0.04)",
            color: "#94a3b8",
            border: "1px solid rgba(255,255,255,0.08)",
            padding: "0.4rem 1rem",
            borderRadius: "6px",
            fontSize: "0.78rem",
            cursor: "pointer",
          }}
        >
          {showAll ? "Show Top 15" : `Show All ${stocks.length} Stocks`}
        </button>
      )}
    </div>
  );
}

// ── Sub Components ─────────────────────────────────────────────────────────

function RuleRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>{label}</span>
      <span style={{
        fontSize: "0.82rem", fontWeight: 600,
        background: "rgba(255,255,255,0.04)", padding: "0.15rem 0.5rem", borderRadius: "4px",
      }}>
        {value}
      </span>
    </div>
  );
}

function PhilosophyBar({ label, sublabel, pct, color }: { label: string; sublabel: string; pct: number; color: string }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
        <div>
          <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>{label}</span>
          <span style={{ fontSize: "0.72rem", color: "#94a3b8", marginLeft: "0.4rem" }}>{sublabel}</span>
        </div>
        <span style={{ fontSize: "0.82rem", fontWeight: 700, color }}>{pct}%</span>
      </div>
      <div style={{ height: "6px", background: "rgba(255,255,255,0.06)", borderRadius: "3px", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: "3px", transition: "width 0.3s" }} />
      </div>
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */
