export const MACRO_SYMBOLS = {
  // FX
  USD_INR: "USDINR=X",
  JPY_USD: "JPY=X",
  DXY: "DX-Y.NYB",

  // Bonds
  US_10Y: "^TNX",
  INDIA_GSEC: "", // proxy via bond ETF

  // Volatility
  INDIA_VIX: "^INDIAVIX",
  US_VIX: "^VIX",

  // Oil
  CRUDE_OIL: "CL=F",
  BRENT: "BZ=F",
};

export const COMMODITY_SYMBOLS = {
  GOLD: "GC=F",
  SILVER: "SI=F",
  GOLD_INR: "GOLDBEES.NS", // proxy
};

export const CRYPTO_SYMBOLS = {
  BTC: "BTC-USD",
  ETH: "ETH-USD",
  SOL: "SOL-USD",
};

export const INDEX_SYMBOLS = {
  NIFTY_50: "^NSEI",
  SENSEX: "^BSESN",
  SP500: "^GSPC",
  NASDAQ: "^IXIC",
  DOW: "^DJI",
};

// NIFTY 50 constituents (NSE symbols for Yahoo Finance - append .NS)
export const NIFTY_50_STOCKS: string[] = [
  "RELIANCE.NS",
  "TCS.NS",
  "HDFCBANK.NS",
  "INFY.NS",
  "ICICIBANK.NS",
  "HINDUNILVR.NS",
  "ITC.NS",
  "SBIN.NS",
  "BHARTIARTL.NS",
  "KOTAKBANK.NS",
  "LT.NS",
  "AXISBANK.NS",
  "BAJFINANCE.NS",
  "MARUTI.NS",
  "TITAN.NS",
  "SUNPHARMA.NS",
  "TATAMOTORS.NS",
  "WIPRO.NS",
  "HCLTECH.NS",
  "ADANIENT.NS",
  "BAJAJ-AUTO.NS",
  "NTPC.NS",
  "POWERGRID.NS",
  "ONGC.NS",
  "COALINDIA.NS",
  "JSWSTEEL.NS",
  "TATASTEEL.NS",
  "M&M.NS",
  "NESTLEIND.NS",
  "ULTRACEMCO.NS",
  "ASIANPAINT.NS",
  "TECHM.NS",
  "DIVISLAB.NS",
  "DRREDDY.NS",
  "CIPLA.NS",
  "EICHERMOT.NS",
  "GRASIM.NS",
  "HEROMOTOCO.NS",
  "APOLLOHOSP.NS",
  "BPCL.NS",
  "TATACONSUM.NS",
  "BRITANNIA.NS",
  "HINDALCO.NS",
  "INDUSINDBK.NS",
  "SBILIFE.NS",
  "HDFCLIFE.NS",
  "BAJAJFINSV.NS",
  "SHRIRAMFIN.NS",
  "TRENT.NS",
  "BEL.NS",
];

// Top US stocks for scanning
export const US_TOP_STOCKS: string[] = [
  "AAPL",
  "MSFT",
  "GOOGL",
  "AMZN",
  "NVDA",
  "META",
  "TSLA",
  "BRK-B",
  "JPM",
  "V",
  "UNH",
  "MA",
  "JNJ",
  "PG",
  "HD",
  "ABBV",
  "MRK",
  "AVGO",
  "PEP",
  "KO",
  "COST",
  "TMO",
  "ADBE",
  "CRM",
  "NFLX",
  "AMD",
  "INTC",
];
