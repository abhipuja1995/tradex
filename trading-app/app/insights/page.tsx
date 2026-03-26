"use client";

import { useEffect, useState, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

type MacroSignal = {
  name: string;
  value: number;
  change: number;
  direction: "bullish" | "bearish" | "neutral";
  description: string;
};

type MacroData = {
  regime: "RISK ON" | "RISK OFF" | "TRANSITION";
  signals: MacroSignal[];
};

type IndexData = {
  name: string;
  price: number;
  change_pct: number;
  dma_50: number;
  dma_100: number;
  dma_200: number;
};

type BreadthData = {
  above_200dma_pct: number;
};

type VolatilityData = {
  india_vix: number;
  us_vix: number;
};

type CommodityItem = {
  name: string;
  price: number;
  change_pct: number;
  signal: string;
  extra?: string;
};

type CryptoItem = {
  symbol: string;
  price: number;
  change_24h: number;
  signal: string;
};

type CryptoData = {
  coins: CryptoItem[];
  allocation_signal: string;
};

// ── Tabs ───────────────────────────────────────────────────────────────────

type TabKey = "macro" | "health" | "volatility" | "commodities" | "crypto";

const TABS: { key: TabKey; label: string }[] = [
  { key: "macro", label: "Macro" },
  { key: "health", label: "Market Health" },
  { key: "volatility", label: "Volatility" },
  { key: "commodities", label: "Commodities" },
  { key: "crypto", label: "Crypto" },
];

// ── Shared Styles ──────────────────────────────────────────────────────────

const cardGrid3: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
  gap: "1rem",
};

const cardGrid4: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
  gap: "1rem",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.7rem",
  color: "var(--text-secondary)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: "0.35rem",
};

const bigNum: React.CSSProperties = {
  fontSize: "1.6rem",
  fontWeight: 700,
};

const smallBadge = (bg: string, color: string): React.CSSProperties => ({
  display: "inline-block",
  background: bg,
  color,
  padding: "0.15rem 0.55rem",
  borderRadius: "6px",
  fontSize: "0.7rem",
  fontWeight: 600,
  letterSpacing: "0.04em",
});

// ── Helpers ────────────────────────────────────────────────────────────────

function changeColor(v: number) {
  return v > 0 ? "var(--success)" : v < 0 ? "var(--danger)" : "var(--text-secondary)";
}

function arrow(v: number) {
  return v > 0 ? "↑" : v < 0 ? "↓" : "–";
}

function directionColor(d: string) {
  if (d === "bullish") return "var(--success)";
  if (d === "bearish") return "var(--danger)";
  return "var(--text-secondary)";
}

function vixLevel(v: number): { label: string; color: string; bg: string } {
  if (v < 15) return { label: "Low", color: "#22c55e", bg: "rgba(34,197,94,0.15)" };
  if (v < 20) return { label: "Normal", color: "#3b82f6", bg: "rgba(59,130,246,0.15)" };
  if (v < 30) return { label: "High", color: "#f97316", bg: "rgba(249,115,22,0.15)" };
  return { label: "Extreme", color: "#ef4444", bg: "rgba(239,68,68,0.15)" };
}

function breadthColor(pct: number) {
  if (pct >= 60) return "var(--success)";
  if (pct >= 40) return "var(--warning)";
  return "var(--danger)";
}

function optionsSignal(vix: number) {
  if (vix >= 25) return { text: "SELL Premium (Short Straddle)", color: "var(--danger)" };
  if (vix < 15) return { text: "BUY Options (Directional)", color: "var(--success)" };
  return { text: "Neutral - Use Spreads", color: "var(--accent)" };
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function InsightsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("macro");

  // data states
  const [macro, setMacro] = useState<MacroData | null>(null);
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [breadth, setBreadth] = useState<BreadthData | null>(null);
  const [vol, setVol] = useState<VolatilityData | null>(null);
  const [commodities, setCommodities] = useState<CommodityItem[]>([]);
  const [crypto, setCrypto] = useState<CryptoData | null>(null);

  // loading flags per panel
  const [loadingMacro, setLoadingMacro] = useState(true);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [loadingVol, setLoadingVol] = useState(true);
  const [loadingComm, setLoadingComm] = useState(true);
  const [loadingCrypto, setLoadingCrypto] = useState(true);

  const fetchAll = useCallback(async () => {
    // Macro
    setLoadingMacro(true);
    fetch("/api/market/macro")
      .then((r) => r.json())
      .then((d) => setMacro(d))
      .catch(() => {})
      .finally(() => setLoadingMacro(false));

    // Health
    setLoadingHealth(true);
    Promise.all([
      fetch("/api/market/indices").then((r) => r.json()),
      fetch("/api/market/breadth").then((r) => r.json()),
    ])
      .then(([idx, br]) => {
        setIndices(idx.indices || []);
        setBreadth(br);
      })
      .catch(() => {})
      .finally(() => setLoadingHealth(false));

    // Volatility
    setLoadingVol(true);
    fetch("/api/market/volatility")
      .then((r) => r.json())
      .then((d) => setVol(d))
      .catch(() => {})
      .finally(() => setLoadingVol(false));

    // Commodities
    setLoadingComm(true);
    fetch("/api/market/commodities")
      .then((r) => r.json())
      .then((d) => setCommodities(d.commodities || []))
      .catch(() => {})
      .finally(() => setLoadingComm(false));

    // Crypto
    setLoadingCrypto(true);
    fetch("/api/market/crypto")
      .then((r) => r.json())
      .then((d) => setCrypto(d))
      .catch(() => {})
      .finally(() => setLoadingCrypto(false));
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 5 * 60 * 1000); // 5 min
    return () => clearInterval(interval);
  }, [fetchAll]);

  return (
    <div className="container">
      {/* Header */}
      <div style={{ marginBottom: "1.25rem" }}>
        <h1 className="title" style={{ marginBottom: "0.25rem" }}>
          Insights
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
          Macro regime, market health, volatility, and asset signals
        </p>
      </div>

      {/* Tab Bar */}
      <div
        style={{
          display: "flex",
          gap: "0.25rem",
          marginBottom: "1.5rem",
          borderBottom: "1px solid var(--border-glass)",
          paddingBottom: "0",
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              background: activeTab === t.key ? "var(--bg-card)" : "transparent",
              color: activeTab === t.key ? "var(--text-primary)" : "var(--text-secondary)",
              border: activeTab === t.key ? "1px solid var(--border-glass)" : "1px solid transparent",
              borderBottom: activeTab === t.key ? "1px solid var(--bg-dark)" : "1px solid transparent",
              padding: "0.55rem 1.1rem",
              borderRadius: "8px 8px 0 0",
              fontSize: "0.82rem",
              fontWeight: activeTab === t.key ? 600 : 400,
              cursor: "pointer",
              transition: "all 0.15s",
              marginBottom: "-1px",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Panel Content */}
      {activeTab === "macro" && <MacroPanel data={macro} loading={loadingMacro} />}
      {activeTab === "health" && (
        <HealthPanel indices={indices} breadth={breadth} loading={loadingHealth} />
      )}
      {activeTab === "volatility" && <VolatilityPanel data={vol} loading={loadingVol} />}
      {activeTab === "commodities" && (
        <CommoditiesPanel items={commodities} loading={loadingComm} />
      )}
      {activeTab === "crypto" && <CryptoPanel data={crypto} loading={loadingCrypto} />}
    </div>
  );
}

// ── Loading Placeholder ────────────────────────────────────────────────────

function LoadingPlaceholder() {
  return (
    <div
      className="glass-panel"
      style={{
        padding: "3rem",
        textAlign: "center",
        color: "var(--text-secondary)",
        fontSize: "0.9rem",
      }}
    >
      Loading...
    </div>
  );
}

// ── Macro Panel ────────────────────────────────────────────────────────────

function MacroPanel({ data, loading }: { data: MacroData | null; loading: boolean }) {
  if (loading) return <LoadingPlaceholder />;
  if (!data) return <EmptyState label="No macro data available" />;

  const regimeColors: Record<string, { bg: string; text: string }> = {
    "RISK ON": { bg: "rgba(34,197,94,0.18)", text: "#22c55e" },
    "RISK OFF": { bg: "rgba(239,68,68,0.18)", text: "#ef4444" },
    TRANSITION: { bg: "rgba(234,179,8,0.18)", text: "#eab308" },
  };
  const rc = regimeColors[data.regime] || regimeColors.TRANSITION;

  return (
    <div>
      {/* Regime Badge */}
      <div
        className="glass-panel"
        style={{
          padding: "1.25rem 1.5rem",
          marginBottom: "1.25rem",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        <div style={labelStyle}>Market Regime</div>
        <span
          style={{
            background: rc.bg,
            color: rc.text,
            padding: "0.35rem 1.2rem",
            borderRadius: "8px",
            fontSize: "1.1rem",
            fontWeight: 700,
            letterSpacing: "0.06em",
          }}
        >
          {data.regime}
        </span>
      </div>

      {/* Signal Cards */}
      <div style={cardGrid3}>
        {data.signals.map((s) => (
          <div
            key={s.name}
            className="glass-panel"
            style={{ padding: "1rem 1.25rem" }}
          >
            <div style={labelStyle}>{s.name}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
              <span style={bigNum}>{s.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              <span
                style={{
                  color: directionColor(s.direction),
                  fontWeight: 600,
                  fontSize: "0.95rem",
                }}
              >
                {arrow(s.change)} {s.change > 0 ? "+" : ""}
                {s.change.toFixed(2)}%
              </span>
            </div>
            <div
              style={{
                marginTop: "0.4rem",
                fontSize: "0.75rem",
                color: "var(--text-secondary)",
              }}
            >
              {s.description}
            </div>
            <span
              style={{
                ...smallBadge(
                  s.direction === "bullish"
                    ? "rgba(34,197,94,0.12)"
                    : s.direction === "bearish"
                    ? "rgba(239,68,68,0.12)"
                    : "rgba(148,163,184,0.12)",
                  directionColor(s.direction)
                ),
                marginTop: "0.5rem",
              }}
            >
              {s.direction.toUpperCase()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Market Health Panel ────────────────────────────────────────────────────

function HealthPanel({
  indices,
  breadth,
  loading,
}: {
  indices: IndexData[];
  breadth: BreadthData | null;
  loading: boolean;
}) {
  if (loading) return <LoadingPlaceholder />;

  return (
    <div>
      {/* Index Cards */}
      <div style={{ ...cardGrid4, marginBottom: "1.25rem" }}>
        {indices.length === 0 && <EmptyState label="No index data" />}
        {indices.map((idx) => {
          const aboveDma = (dma: number) => idx.price >= dma;
          return (
            <div key={idx.name} className="glass-panel" style={{ padding: "1rem 1.25rem" }}>
              <div style={labelStyle}>{idx.name}</div>
              <div style={{ ...bigNum, marginBottom: "0.25rem" }}>
                {idx.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
              <span style={{ color: changeColor(idx.change_pct), fontWeight: 600, fontSize: "0.85rem" }}>
                {arrow(idx.change_pct)} {idx.change_pct > 0 ? "+" : ""}
                {idx.change_pct.toFixed(2)}%
              </span>

              {/* DMA levels */}
              <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                {[
                  { label: "50 DMA", val: idx.dma_50 },
                  { label: "100 DMA", val: idx.dma_100 },
                  { label: "200 DMA", val: idx.dma_200 },
                ].map((d) => (
                  <div
                    key={d.label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.72rem",
                    }}
                  >
                    <span style={{ color: "var(--text-secondary)" }}>{d.label}</span>
                    <span style={{ color: aboveDma(d.val) ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>
                      {d.val.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Breadth Meter */}
      {breadth && (
        <div className="glass-panel" style={{ padding: "1.25rem" }}>
          <div style={labelStyle}>Market Breadth</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              marginTop: "0.5rem",
            }}
          >
            {/* Bar */}
            <div
              style={{
                flex: 1,
                height: "12px",
                background: "rgba(255,255,255,0.06)",
                borderRadius: "6px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${breadth.above_200dma_pct}%`,
                  height: "100%",
                  background: breadthColor(breadth.above_200dma_pct),
                  borderRadius: "6px",
                  transition: "width 0.4s",
                }}
              />
            </div>
            <span
              style={{
                fontSize: "1.2rem",
                fontWeight: 700,
                color: breadthColor(breadth.above_200dma_pct),
                minWidth: "60px",
                textAlign: "right",
              }}
            >
              {breadth.above_200dma_pct.toFixed(1)}%
            </span>
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.35rem" }}>
            Stocks above 200 DMA
          </div>
        </div>
      )}
    </div>
  );
}

// ── Volatility Panel ───────────────────────────────────────────────────────

function VolatilityPanel({ data, loading }: { data: VolatilityData | null; loading: boolean }) {
  if (loading) return <LoadingPlaceholder />;
  if (!data) return <EmptyState label="No volatility data available" />;

  const iv = vixLevel(data.india_vix);
  const uv = vixLevel(data.us_vix);
  const optSig = optionsSignal(Math.max(data.india_vix, data.us_vix));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
      {/* India VIX */}
      <div className="glass-panel" style={{ padding: "1.25rem" }}>
        <div style={labelStyle}>India VIX</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", marginBottom: "0.5rem" }}>
          <span style={bigNum}>{data.india_vix.toFixed(2)}</span>
          <span style={smallBadge(iv.bg, iv.color)}>{iv.label}</span>
        </div>
      </div>

      {/* US VIX */}
      <div className="glass-panel" style={{ padding: "1.25rem" }}>
        <div style={labelStyle}>US VIX (CBOE)</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", marginBottom: "0.5rem" }}>
          <span style={bigNum}>{data.us_vix.toFixed(2)}</span>
          <span style={smallBadge(uv.bg, uv.color)}>{uv.label}</span>
        </div>
      </div>

      {/* Options Signal - full width */}
      <div className="glass-panel" style={{ padding: "1.25rem", gridColumn: "1 / -1" }}>
        <div style={labelStyle}>Options Signal</div>
        <div style={{ fontSize: "1.1rem", fontWeight: 600, color: optSig.color, marginTop: "0.25rem" }}>
          {optSig.text}
        </div>
      </div>
    </div>
  );
}

// ── Commodities Panel ──────────────────────────────────────────────────────

function CommoditiesPanel({ items, loading }: { items: CommodityItem[]; loading: boolean }) {
  if (loading) return <LoadingPlaceholder />;
  if (items.length === 0) return <EmptyState label="No commodities data available" />;

  return (
    <div style={cardGrid3}>
      {items.map((c) => (
        <div key={c.name} className="glass-panel" style={{ padding: "1.25rem" }}>
          <div style={labelStyle}>{c.name}</div>
          <div style={{ ...bigNum, marginBottom: "0.25rem" }}>
            ${c.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <span style={{ color: changeColor(c.change_pct), fontWeight: 600, fontSize: "0.85rem" }}>
            {arrow(c.change_pct)} {c.change_pct > 0 ? "+" : ""}
            {c.change_pct.toFixed(2)}%
          </span>
          <div style={{ marginTop: "0.6rem", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
            {c.signal}
          </div>
          {c.extra && (
            <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", marginTop: "0.2rem" }}>
              {c.extra}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Crypto Panel ───────────────────────────────────────────────────────────

function CryptoPanel({ data, loading }: { data: CryptoData | null; loading: boolean }) {
  if (loading) return <LoadingPlaceholder />;
  if (!data) return <EmptyState label="No crypto data available" />;

  return (
    <div>
      <div style={cardGrid3}>
        {data.coins.map((c) => (
          <div key={c.symbol} className="glass-panel" style={{ padding: "1.25rem" }}>
            <div style={labelStyle}>{c.symbol}</div>
            <div style={{ ...bigNum, marginBottom: "0.25rem" }}>
              ${c.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
            <span style={{ color: changeColor(c.change_24h), fontWeight: 600, fontSize: "0.85rem" }}>
              {arrow(c.change_24h)} {c.change_24h > 0 ? "+" : ""}
              {c.change_24h.toFixed(2)}%
            </span>
            <div style={{ marginTop: "0.5rem", fontSize: "0.78rem", color: "var(--text-secondary)" }}>
              {c.signal}
            </div>
          </div>
        ))}
      </div>

      {/* Allocation Signal */}
      <div className="glass-panel" style={{ padding: "1.25rem", marginTop: "1.25rem" }}>
        <div style={labelStyle}>Allocation Signal</div>
        <div
          style={{
            fontSize: "1.05rem",
            fontWeight: 600,
            color: data.allocation_signal.toLowerCase().includes("increase")
              ? "var(--success)"
              : data.allocation_signal.toLowerCase().includes("reduce")
              ? "var(--danger)"
              : "var(--accent)",
            marginTop: "0.25rem",
          }}
        >
          {data.allocation_signal}
        </div>
      </div>
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────────────────────

function EmptyState({ label }: { label: string }) {
  return (
    <div
      className="glass-panel"
      style={{
        padding: "2.5rem",
        textAlign: "center",
        color: "var(--text-secondary)",
        fontSize: "0.85rem",
      }}
    >
      {label}
    </div>
  );
}
