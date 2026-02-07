#!/usr/bin/env python3
"""
Train initial ML models for OpenSalesAI on seed data.

Generates synthetic training data and trains:
  1. Demand forecasting (Prophet + XGBoost)
  2. Stock-out prediction (Random Forest)
  3. Credit scoring (XGBoost)
  4. Attrition prediction (Logistic Regression)

Usage:
    python scripts/train-models.py [--output-dir /app/models]
                                    [--samples 5000]
"""

from __future__ import annotations

import argparse
import logging
import sys
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
)
logger = logging.getLogger(__name__)


def generate_demand_data(n_days: int = 180) -> pd.DataFrame:
    """Generate synthetic daily demand data for a store-SKU pair."""
    np.random.seed(42)
    dates = pd.date_range(
        end=datetime.now(),
        periods=n_days,
        freq="D",
    )

    # Base demand with trend, weekly seasonality, and noise
    trend = np.linspace(5, 8, n_days)  # Slight upward trend
    weekly = 2 * np.sin(2 * np.pi * np.arange(n_days) / 7)  # Weekly pattern
    monthly = 1.5 * np.sin(2 * np.pi * np.arange(n_days) / 30)  # Monthly pattern
    noise = np.random.normal(0, 1.5, n_days)

    demand = np.maximum(0, trend + weekly + monthly + noise)

    # Add festival spikes (Diwali, Holi approximations)
    for spike_day in [45, 120]:
        if spike_day < n_days:
            demand[spike_day : spike_day + 3] *= 2.5

    df = pd.DataFrame({
        "ds": dates,
        "y": demand.round(0).astype(int),
    })

    return df


def generate_stockout_data(n_samples: int = 5000) -> pd.DataFrame:
    """Generate synthetic stockout training data."""
    np.random.seed(42)

    data = {
        "current_stock": np.random.exponential(50, n_samples),
        "avg_daily_consumption": np.random.exponential(5, n_samples),
        "consumption_variance": np.random.exponential(2, n_samples),
        "lead_time_days": np.random.choice([1, 2, 3, 5, 7], n_samples),
        "day_of_week": np.random.randint(0, 7, n_samples),
        "day_of_month": np.random.randint(1, 32, n_samples),
        "month": np.random.randint(1, 13, n_samples),
        "is_weekend": np.random.choice([0, 1], n_samples, p=[5 / 7, 2 / 7]),
        "days_since_last_restock": np.random.exponential(7, n_samples),
        "order_frequency_30d": np.random.poisson(4, n_samples),
        "stock_to_consumption_ratio": np.zeros(n_samples),
        "trend_slope": np.random.normal(0, 0.5, n_samples),
    }

    df = pd.DataFrame(data)

    # Stock-to-consumption ratio
    df["stock_to_consumption_ratio"] = (
        df["current_stock"] / df["avg_daily_consumption"].clip(lower=0.1)
    )

    # Generate target: stockout occurs when stock / consumption < lead_time
    days_of_stock = df["current_stock"] / df["avg_daily_consumption"].clip(lower=0.1)
    stockout_prob = 1 / (1 + np.exp(days_of_stock - df["lead_time_days"]))
    stockout_prob += 0.1 * df["trend_slope"]  # Increasing consumption = more risk
    stockout_prob = np.clip(stockout_prob, 0, 1)
    df["stockout"] = (np.random.random(n_samples) < stockout_prob).astype(int)

    logger.info(
        "Stockout data: %d samples, %.1f%% positive",
        n_samples,
        df["stockout"].mean() * 100,
    )

    return df


def generate_credit_data(n_samples: int = 2000) -> pd.DataFrame:
    """Generate synthetic credit scoring training data."""
    np.random.seed(42)

    data = {
        "on_time_payment_rate": np.random.beta(5, 2, n_samples),
        "avg_days_to_pay": np.random.exponential(10, n_samples),
        "max_days_overdue": np.random.exponential(15, n_samples),
        "total_orders_90d": np.random.poisson(12, n_samples),
        "order_frequency_monthly": np.random.exponential(4, n_samples),
        "avg_order_value": np.random.lognormal(7.5, 1, n_samples),  # ~INR 1800 median
        "total_revenue_90d": np.random.lognormal(10, 1.5, n_samples),
        "order_trend": np.random.normal(0, 0.5, n_samples),
        "bounce_count": np.random.poisson(0.5, n_samples),
        "relationship_months": np.random.exponential(12, n_samples),
        "visit_compliance_rate": np.random.beta(4, 2, n_samples),
        "msl_compliance_rate": np.random.beta(3, 2, n_samples),
    }

    df = pd.DataFrame(data)

    # Generate credit score (0-100) based on features
    score = (
        30 * df["on_time_payment_rate"]
        + 10 * np.clip(1 - df["avg_days_to_pay"] / 60, 0, 1)
        + 10 * np.clip(1 - df["max_days_overdue"] / 90, 0, 1)
        + 10 * np.clip(df["order_frequency_monthly"] / 8, 0, 1)
        + 10 * np.clip(df["avg_order_value"] / 10000, 0, 1)
        + 10 * np.clip(df["relationship_months"] / 24, 0, 1)
        - 10 * np.clip(df["bounce_count"] / 5, 0, 1)
        + 10 * df["visit_compliance_rate"]
        + 10 * df["msl_compliance_rate"]
    )
    score = np.clip(score * 100 / 100, 0, 100)
    noise = np.random.normal(0, 5, n_samples)
    df["credit_score"] = np.clip(score + noise, 0, 100).round(0).astype(int)

    logger.info(
        "Credit data: %d samples, mean score=%.1f, std=%.1f",
        n_samples,
        df["credit_score"].mean(),
        df["credit_score"].std(),
    )

    return df


def generate_attrition_data(n_samples: int = 3000) -> pd.DataFrame:
    """Generate synthetic attrition (churn) training data."""
    np.random.seed(42)

    data = {
        "days_since_last_order": np.random.exponential(15, n_samples),
        "days_since_last_visit": np.random.exponential(10, n_samples),
        "order_frequency_30d": np.random.poisson(3, n_samples),
        "order_frequency_60d": np.random.poisson(6, n_samples),
        "order_frequency_90d": np.random.poisson(10, n_samples),
        "frequency_trend": np.random.lognormal(0, 0.5, n_samples),
        "avg_order_value_30d": np.random.lognormal(7, 1, n_samples),
        "avg_order_value_90d": np.random.lognormal(7, 1, n_samples),
        "aov_trend": np.random.lognormal(0, 0.3, n_samples),
        "total_revenue_90d": np.random.lognormal(10, 1.5, n_samples),
        "msl_compliance_rate": np.random.beta(3, 2, n_samples),
        "visit_count_30d": np.random.poisson(4, n_samples),
        "task_completion_rate": np.random.beta(4, 2, n_samples),
        "credit_tier_numeric": np.random.choice([1, 2, 3, 4], n_samples, p=[0.1, 0.3, 0.4, 0.2]),
        "relationship_months": np.random.exponential(12, n_samples),
        "complaints_30d": np.random.poisson(0.3, n_samples),
    }

    df = pd.DataFrame(data)

    # Generate churn probability
    churn_logit = (
        0.05 * df["days_since_last_order"]
        + 0.03 * df["days_since_last_visit"]
        - 0.2 * df["order_frequency_30d"]
        - 0.5 * df["frequency_trend"]
        - 0.3 * df["aov_trend"]
        - 0.15 * df["visit_count_30d"]
        - 0.2 * df["task_completion_rate"]
        - 0.1 * df["credit_tier_numeric"]
        + 0.3 * df["complaints_30d"]
        - 0.02 * df["relationship_months"]
        - 2.0  # bias
    )
    churn_prob = 1 / (1 + np.exp(-churn_logit))
    df["churned"] = (np.random.random(n_samples) < churn_prob).astype(int)

    logger.info(
        "Attrition data: %d samples, %.1f%% churned",
        n_samples,
        df["churned"].mean() * 100,
    )

    return df


def main() -> None:
    parser = argparse.ArgumentParser(description="Train initial ML models for OpenSalesAI")
    parser.add_argument("--output-dir", default="/app/models", help="Model output directory")
    parser.add_argument("--samples", type=int, default=5000, help="Number of training samples")
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    logger.info("Training ML models (output: %s, samples: %d)", output_dir, args.samples)

    # ── 1. Demand Forecasting ─────────────────────────────────────────

    logger.info("")
    logger.info("=== Training Demand Forecasting Model ===")
    try:
        # Add ai-service to path for imports
        ai_service_path = Path(__file__).parent.parent / "services" / "ai-service"
        sys.path.insert(0, str(ai_service_path))

        from app.ml.demand_forecast import DemandForecaster

        demand_dir = output_dir / "demand"
        demand_dir.mkdir(parents=True, exist_ok=True)

        forecaster = DemandForecaster(model_dir=str(demand_dir))
        demand_data = generate_demand_data(n_days=180)

        # Train for a sample store-product pair
        sample_store_id = "sample-store-001"
        sample_product_id = "sample-product-001"

        metrics = forecaster.train(
            store_id=sample_store_id,
            product_id=sample_product_id,
            history_df=demand_data,
        )
        logger.info("Demand model: %s", metrics)

    except Exception:
        logger.exception("Failed to train demand forecasting model.")

    # ── 2. Stock-out Prediction ───────────────────────────────────────

    logger.info("")
    logger.info("=== Training Stock-out Prediction Model ===")
    try:
        from app.ml.stockout import StockoutPredictor

        stockout_dir = output_dir / "stockout"
        stockout_dir.mkdir(parents=True, exist_ok=True)

        predictor = StockoutPredictor(model_dir=str(stockout_dir))
        stockout_data = generate_stockout_data(n_samples=args.samples)

        metrics = predictor.train(stockout_data)
        logger.info("Stockout model: %s", metrics)

    except Exception:
        logger.exception("Failed to train stockout prediction model.")

    # ── 3. Credit Scoring ─────────────────────────────────────────────

    logger.info("")
    logger.info("=== Training Credit Scoring Model ===")
    try:
        from app.ml.credit_score import CreditScorer

        credit_dir = output_dir / "credit"
        credit_dir.mkdir(parents=True, exist_ok=True)

        scorer = CreditScorer(model_dir=str(credit_dir))
        credit_data = generate_credit_data(n_samples=min(args.samples, 2000))

        metrics = scorer.train(credit_data)
        logger.info("Credit model: %s", metrics)

    except Exception:
        logger.exception("Failed to train credit scoring model.")

    # ── 4. Attrition Prediction ───────────────────────────────────────

    logger.info("")
    logger.info("=== Training Attrition Prediction Model ===")
    try:
        from app.ml.attrition import AttritionPredictor

        attrition_dir = output_dir / "attrition"
        attrition_dir.mkdir(parents=True, exist_ok=True)

        attrition = AttritionPredictor(model_dir=str(attrition_dir))
        attrition_data = generate_attrition_data(n_samples=min(args.samples, 3000))

        metrics = attrition.train(attrition_data)
        logger.info("Attrition model: %s", metrics)

    except Exception:
        logger.exception("Failed to train attrition prediction model.")

    # ── Summary ───────────────────────────────────────────────────────

    logger.info("")
    logger.info("=== Training Complete ===")

    # List all saved model files
    for model_dir_child in sorted(output_dir.rglob("*.pkl")):
        size_kb = model_dir_child.stat().st_size / 1024
        logger.info("  %s (%.1f KB)", model_dir_child.relative_to(output_dir), size_kb)

    logger.info("")
    logger.info("All models trained and saved to %s", output_dir)


if __name__ == "__main__":
    main()
