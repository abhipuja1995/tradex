"""TradingAgents wrapper for multi-agent AI signal generation."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from config.settings import settings
from config.constants import SignalAction

logger = logging.getLogger(__name__)


@dataclass
class AISignal:
    action: SignalAction
    confidence: float  # 0.0 to 1.0
    reasoning: str
    fundamentals_summary: str
    sentiment_summary: str
    technical_summary: str
    news_summary: str
    risk_assessment: str


def _build_config() -> dict[str, Any]:
    """Build TradingAgents config from settings."""
    config = {
        "llm_provider": settings.llm_provider,
        "deep_think_llm": "grok-4",
        "quick_think_llm": "grok-mini",
    }

    if settings.llm_provider == "anthropic":
        config["deep_think_llm"] = "claude-opus-4-20250514"
        config["quick_think_llm"] = "claude-haiku-4-5-20251001"
    elif settings.llm_provider == "openai":
        config["deep_think_llm"] = "gpt-4o"
        config["quick_think_llm"] = "gpt-4o-mini"

    return config


def _parse_decision(decision: str) -> AISignal:
    """Parse TradingAgents decision text into structured signal."""
    decision_lower = decision.lower()

    if "buy" in decision_lower or "long" in decision_lower:
        action = SignalAction.BUY
    elif "sell" in decision_lower or "short" in decision_lower:
        action = SignalAction.SELL
    else:
        action = SignalAction.HOLD

    # Extract confidence from phrases like "confidence: 0.8" or "high confidence"
    confidence = 0.5
    if "high confidence" in decision_lower or "strong" in decision_lower:
        confidence = 0.8
    elif "moderate confidence" in decision_lower or "medium" in decision_lower:
        confidence = 0.6
    elif "low confidence" in decision_lower or "weak" in decision_lower:
        confidence = 0.3

    # Try to extract numeric confidence
    import re
    conf_match = re.search(r"confidence[:\s]+(\d+\.?\d*)", decision_lower)
    if conf_match:
        parsed = float(conf_match.group(1))
        confidence = parsed if parsed <= 1.0 else parsed / 100.0

    return AISignal(
        action=action,
        confidence=confidence,
        reasoning=decision,
        fundamentals_summary="",
        sentiment_summary="",
        technical_summary="",
        news_summary="",
        risk_assessment="",
    )


class AISignalGenerator:
    """Wraps TradingAgents multi-agent framework for signal generation.

    The multi-agent system deploys:
    - Fundamentals Analyst: financial metrics, valuations
    - Sentiment Analyst: social media, news sentiment
    - Technical Analyst: RSI, MACD, support/resistance
    - News Analyst: macro events impact
    - Risk Manager: portfolio risk assessment
    - Trader Agent: synthesizes all into final signal
    """

    def __init__(self):
        self._graph = None
        self._config = _build_config()

    def _ensure_initialized(self):
        if self._graph is None:
            try:
                from tradingagents.graph.trading_graph import TradingAgentsGraph
                self._graph = TradingAgentsGraph(debug=False, config=self._config)
                logger.info("TradingAgents graph initialized")
            except ImportError:
                logger.warning(
                    "tradingagents not installed. Install with: pip install tradingagents"
                )
                raise
            except Exception as e:
                logger.error(f"Failed to initialize TradingAgents: {e}")
                raise

    def _has_llm_key(self) -> bool:
        """Check if any LLM API key is configured."""
        return bool(
            settings.xai_api_key
            or settings.anthropic_api_key
            or settings.openai_api_key
        )

    async def get_signal(self, symbol: str, date_str: str) -> AISignal:
        """Run multi-agent analysis and return trading signal.

        Falls back to RSI-based signal if no LLM key is configured
        or TradingAgents is unavailable.

        Args:
            symbol: Stock symbol (e.g., "RELIANCE")
            date_str: Analysis date in YYYY-MM-DD format

        Returns:
            AISignal with action, confidence, and reasoning
        """
        # If no LLM key configured, use simple RSI-based confirmation
        if not self._has_llm_key():
            return self._rsi_fallback_signal(symbol)

        try:
            self._ensure_initialized()
        except Exception:
            logger.warning(f"TradingAgents unavailable, using RSI fallback for {symbol}")
            return self._rsi_fallback_signal(symbol)

        logger.info(f"Running TradingAgents analysis for {symbol} on {date_str}")
        try:
            _, decision = self._graph.propagate(symbol, date_str)
            signal = _parse_decision(decision)
            logger.info(
                f"AI signal for {symbol}: {signal.action} "
                f"(confidence: {signal.confidence:.2f})"
            )
            return signal
        except Exception as e:
            logger.error(f"TradingAgents analysis failed for {symbol}: {e}")
            return self._rsi_fallback_signal(symbol)

    def _rsi_fallback_signal(self, symbol: str) -> AISignal:
        """Simple RSI-based BUY signal for paper trading without LLM.

        Since the strategy already checks RSI < oversold threshold
        before calling get_signal(), if we reach here the RSI condition
        is already met. Return a moderate-confidence BUY.
        """
        logger.info(f"RSI fallback signal for {symbol}: BUY (no LLM configured)")
        return AISignal(
            action=SignalAction.BUY,
            confidence=0.65,
            reasoning=f"RSI-based signal (no LLM key). RSI oversold confirmed by strategy layer.",
            fundamentals_summary="N/A (RSI-only mode)",
            sentiment_summary="N/A (RSI-only mode)",
            technical_summary="RSI oversold near support — BUY signal",
            news_summary="N/A (RSI-only mode)",
            risk_assessment="Paper trading mode — limited risk",
        )

    async def get_signals_batch(
        self, symbols: list[str], date_str: str
    ) -> dict[str, AISignal]:
        """Get signals for multiple symbols."""
        results = {}
        for symbol in symbols:
            results[symbol] = await self.get_signal(symbol, date_str)
        return results
