export type QuoteData = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  high: number;
  low: number;
  volume: number;
  timestamp: number;
};

export type ChartData = {
  dates: string[];
  closes: number[];
  highs: number[];
  lows: number[];
  volumes: number[];
};

const YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const FETCH_HEADERS = { "User-Agent": "Mozilla/5.0" };
const FETCH_TIMEOUT = 5000;

async function fetchWithTimeout(
  url: string,
  timeoutMs: number = FETCH_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(id);
  }
}

export async function getQuote(symbol: string): Promise<QuoteData | null> {
  try {
    const url = `${YAHOO_BASE}/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
    const res = await fetchWithTimeout(url);

    if (!res.ok) return null;

    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const quote = result.indicators?.quote?.[0];
    const timestamps = result.timestamp;

    if (!meta || !quote || !timestamps || timestamps.length === 0) return null;

    const lastIdx = timestamps.length - 1;
    const price = meta.regularMarketPrice ?? quote.close?.[lastIdx] ?? 0;
    const previousClose = meta.chartPreviousClose ?? meta.previousClose ?? 0;
    const change = price - previousClose;
    const changePercent = previousClose !== 0 ? (change / previousClose) * 100 : 0;

    return {
      symbol: meta.symbol ?? symbol,
      name: meta.shortName ?? meta.longName ?? symbol,
      price,
      change: parseFloat(change.toFixed(4)),
      changePercent: parseFloat(changePercent.toFixed(2)),
      previousClose,
      high: quote.high?.[lastIdx] ?? meta.regularMarketDayHigh ?? 0,
      low: quote.low?.[lastIdx] ?? meta.regularMarketDayLow ?? 0,
      volume: quote.volume?.[lastIdx] ?? 0,
      timestamp: timestamps[lastIdx] ?? Date.now() / 1000,
    };
  } catch (err) {
    console.error(`[market-data] getQuote(${symbol}) failed:`, err);
    return null;
  }
}

export async function getQuotes(symbols: string[]): Promise<QuoteData[]> {
  const results = await Promise.allSettled(symbols.map((s) => getQuote(s)));
  return results
    .filter(
      (r): r is PromiseFulfilledResult<QuoteData> =>
        r.status === "fulfilled" && r.value !== null
    )
    .map((r) => r.value);
}

export async function getChartData(
  symbol: string,
  range: string = "1y",
  interval: string = "1d"
): Promise<ChartData | null> {
  try {
    const url = `${YAHOO_BASE}/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
    const res = await fetchWithTimeout(url);

    if (!res.ok) return null;

    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;

    const timestamps: number[] = result.timestamp ?? [];
    const quote = result.indicators?.quote?.[0];
    if (!quote || timestamps.length === 0) return null;

    const closes: number[] = [];
    const highs: number[] = [];
    const lows: number[] = [];
    const volumes: number[] = [];
    const dates: string[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const c = quote.close?.[i];
      if (c == null) continue;

      dates.push(new Date(timestamps[i] * 1000).toISOString().split("T")[0]);
      closes.push(c);
      highs.push(quote.high?.[i] ?? c);
      lows.push(quote.low?.[i] ?? c);
      volumes.push(quote.volume?.[i] ?? 0);
    }

    return { dates, closes, highs, lows, volumes };
  } catch (err) {
    console.error(`[market-data] getChartData(${symbol}) failed:`, err);
    return null;
  }
}

export function calculateDMA(closes: number[], period: number): number[] {
  const dma: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      dma.push(NaN);
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += closes[j];
      }
      dma.push(parseFloat((sum / period).toFixed(2)));
    }
  }
  return dma;
}

export function calculateRSI(closes: number[], period: number = 14): number[] {
  const rsi: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return rsi;

  let avgGain = 0;
  let avgLoss = 0;

  // Initial average gain/loss
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;

  if (avgLoss === 0) {
    rsi[period] = 100;
  } else {
    const rs = avgGain / avgLoss;
    rsi[period] = parseFloat((100 - 100 / (1 + rs)).toFixed(2));
  }

  // Subsequent values using smoothed averages
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    if (avgLoss === 0) {
      rsi[i] = 100;
    } else {
      const rs = avgGain / avgLoss;
      rsi[i] = parseFloat((100 - 100 / (1 + rs)).toFixed(2));
    }
  }

  return rsi;
}

export async function marketBreadth(
  symbols: string[],
  dmaPeriod: number
): Promise<{ above: number; total: number; percent: number }> {
  let above = 0;
  let total = 0;

  // Process in batches of 10 to avoid overwhelming the API
  const batchSize = 10;
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (symbol) => {
        const chart = await getChartData(symbol, "1y", "1d");
        if (!chart || chart.closes.length < dmaPeriod) return null;

        const dma = calculateDMA(chart.closes, dmaPeriod);
        const lastDMA = dma[dma.length - 1];
        const lastClose = chart.closes[chart.closes.length - 1];

        if (isNaN(lastDMA)) return null;
        return { lastClose, lastDMA };
      })
    );

    for (const r of results) {
      if (r.status === "fulfilled" && r.value !== null) {
        total++;
        if (r.value.lastClose > r.value.lastDMA) above++;
      }
    }
  }

  const percent = total > 0 ? parseFloat(((above / total) * 100).toFixed(1)) : 0;
  return { above, total, percent };
}
