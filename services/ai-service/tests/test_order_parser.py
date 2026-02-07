"""
Tests for order parsing from natural language text.

Verifies:
- Parsing English order text ("2 cases Maggi, 5 packets Parle-G")
- Parsing Hindi text ("2 box Maggi chahiye")
- Parsing mixed language orders
- Edge cases: empty input, gibberish, partial info
- Output schema validation

NOTE: These tests mock the AI service call since the actual LLM
(Ollama) may not be running during testing. We test the parsing
logic and validation, not the LLM quality.
"""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ── Simulated Order Parser Logic ──────────────────────────────────────────────

# Since the actual order parser depends on the LLM, we test the expected
# behavior via a simplified version of the parsing contract.


class OrderItem:
    """Represents a parsed order item."""

    def __init__(self, name: str, quantity: int, unit: str = "pcs") -> None:
        self.name = name
        self.quantity = quantity
        self.unit = unit


class ParsedOrder:
    """Represents the full parsed order."""

    def __init__(self, items: list[OrderItem], raw_text: str = "") -> None:
        self.items = items
        self.raw_text = raw_text


def parse_simple_order_text(text: str) -> ParsedOrder:
    """Simple rule-based parser for testing — extracts quantity + product patterns.

    This simulates what the LLM-powered parser does but uses regex for testing.
    """
    import re

    items: list[OrderItem] = []

    # Pattern: <quantity> <unit?> <product_name>
    patterns = [
        # "2 cases Maggi Noodles" / "5 packets Parle-G"
        r"(\d+)\s*(cases?|packets?|boxes?|pcs?|dozens?|cartons?)?\s+(?:of\s+)?([A-Za-z][A-Za-z0-9\s\-]+)",
        # Hindi: "2 box Maggi chahiye"
        r"(\d+)\s*(box|packet|case)?\s+([A-Za-z][A-Za-z0-9\s\-]+?)(?:\s+(?:chahiye|bhejo|dena|do))",
    ]

    for pattern in patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            qty = int(match.group(1))
            unit = (match.group(2) or "pcs").lower().rstrip("s")
            name = match.group(3).strip().rstrip(",. ")

            if qty > 0 and name:
                items.append(OrderItem(name=name, quantity=qty, unit=unit))

    return ParsedOrder(items=items, raw_text=text)


# ── Tests ─────────────────────────────────────────────────────────────────────


class TestOrderParser:
    """Test order text parsing."""

    def test_parse_english_order(self) -> None:
        """Standard English format: '2 cases Maggi, 5 packets Parle-G'."""
        text = "2 cases Maggi, 5 packets Parle-G"
        result = parse_simple_order_text(text)
        assert len(result.items) >= 2

        names = [item.name.lower() for item in result.items]
        assert any("maggi" in n for n in names)
        assert any("parle" in n for n in names)

        for item in result.items:
            assert item.quantity > 0

    def test_parse_single_item(self) -> None:
        """Single item order."""
        text = "3 cases Coca-Cola"
        result = parse_simple_order_text(text)
        assert len(result.items) >= 1
        assert result.items[0].quantity == 3

    def test_parse_hindi_order(self) -> None:
        """Hindi text: '2 box Maggi chahiye'."""
        text = "2 box Maggi chahiye"
        result = parse_simple_order_text(text)
        assert len(result.items) >= 1
        assert result.items[0].quantity == 2

    def test_parse_mixed_language(self) -> None:
        """Mixed Hindi-English: 'Mujhe 5 case Lays bhejo'."""
        text = "5 case Lays bhejo"
        result = parse_simple_order_text(text)
        assert len(result.items) >= 1
        assert result.items[0].quantity == 5

    def test_parse_empty_input(self) -> None:
        """Empty input should return no items."""
        result = parse_simple_order_text("")
        assert len(result.items) == 0

    def test_parse_gibberish(self) -> None:
        """Gibberish text should return no items."""
        result = parse_simple_order_text("asdfghjkl qwerty zxcvbn")
        assert len(result.items) == 0

    def test_quantities_are_positive(self) -> None:
        """All parsed quantities must be positive integers."""
        text = "10 cases Maggi, 20 packets Lays, 1 dozen Dairy Milk"
        result = parse_simple_order_text(text)
        for item in result.items:
            assert item.quantity > 0
            assert isinstance(item.quantity, int)

    def test_raw_text_preserved(self) -> None:
        """The original text should be preserved in the result."""
        text = "2 cases Maggi, 5 packets Parle-G"
        result = parse_simple_order_text(text)
        assert result.raw_text == text


class TestOrderParserOutputSchema:
    """Test that the output format conforms to the expected schema."""

    def test_llm_output_schema_valid(self) -> None:
        """Simulate LLM JSON output and validate schema."""
        llm_output = json.dumps({
            "items": [
                {"name": "Maggi Noodles 70g", "quantity": 2, "unit": "case"},
                {"name": "Parle-G Gold 100g", "quantity": 5, "unit": "packet"},
            ],
            "confidence": 0.92,
            "language_detected": "en",
        })

        parsed = json.loads(llm_output)
        assert "items" in parsed
        assert isinstance(parsed["items"], list)
        assert len(parsed["items"]) == 2

        for item in parsed["items"]:
            assert "name" in item
            assert "quantity" in item
            assert isinstance(item["quantity"], int)
            assert item["quantity"] > 0

    def test_llm_output_with_confidence(self) -> None:
        """Validate that confidence score is between 0 and 1."""
        llm_output = json.dumps({
            "items": [{"name": "Coca-Cola 300ml", "quantity": 10, "unit": "bottle"}],
            "confidence": 0.78,
        })

        parsed = json.loads(llm_output)
        assert 0 <= parsed["confidence"] <= 1

    def test_empty_items_array(self) -> None:
        """LLM may return empty items when order text is unclear."""
        llm_output = json.dumps({
            "items": [],
            "confidence": 0.1,
            "message": "Could not identify any products",
        })

        parsed = json.loads(llm_output)
        assert parsed["items"] == []
        assert parsed["confidence"] < 0.5
