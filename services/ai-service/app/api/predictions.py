"""
ML prediction API endpoints.

POST /predictions/demand       — demand forecast for a store-SKU pair.
POST /predictions/stockout-scan — scan all store-SKUs for stockout risk.
POST /predictions/credit       — credit score for a store.
POST /predictions/attrition    — churn prediction for a store.
POST /predictions/route        — optimise visit route for a rep.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.core.database import DbSession
from app.core.security import CurrentUser

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Request / Response Models ────────────────────────────────────────────────


class DemandForecastRequest(BaseModel):
    """Request body for demand prediction."""

    store_id: str
    product_id: str
    horizon_days: int = 7
    company_id: str = ""


class DemandForecastResponse(BaseModel):
    """Demand forecast result."""

    store_id: str
    product_id: str
    horizon_days: int
    predicted_qty: float
    lower_bound: float = 0.0
    upper_bound: float = 0.0
    confidence: float = 0.0
    trend: str = "stable"
    model_version: str = ""


class StockoutScanRequest(BaseModel):
    """Request body for stockout scan."""

    company_id: str


class StockoutAlertItem(BaseModel):
    """Single stockout alert."""

    store_id: str
    product_id: str
    store_name: str = ""
    product_name: str = ""
    probability: float
    days_until_stockout: float
    current_stock: float = 0.0
    suggested_reorder_qty: float = 0.0
    risk_level: str = "low"
    factors: list[str] = Field(default_factory=list)


class StockoutScanResponse(BaseModel):
    """Stockout scan result."""

    company_id: str
    total_scanned: int = 0
    alert_count: int = 0
    alerts: list[StockoutAlertItem] = Field(default_factory=list)
    scan_duration_seconds: float = 0.0


class CreditScoreRequest(BaseModel):
    """Request body for credit scoring."""

    store_id: str
    company_id: str = ""


class CreditFactorItem(BaseModel):
    """A credit score contributing factor."""

    name: str
    value: float
    impact: str = "neutral"
    description: str = ""


class CreditScoreResponse(BaseModel):
    """Credit score result."""

    store_id: str
    store_name: str = ""
    tier: str
    score: int
    factors: list[CreditFactorItem] = Field(default_factory=list)
    recommended_credit_limit_inr: float = 0.0
    max_payment_terms_days: int = 0


class AttritionRequest(BaseModel):
    """Request body for attrition prediction."""

    store_id: str
    company_id: str = ""


class AttritionResponse(BaseModel):
    """Attrition prediction result."""

    store_id: str
    store_name: str = ""
    churn_probability: float
    risk_level: str
    contributing_factors: list[str] = Field(default_factory=list)
    recommended_actions: list[str] = Field(default_factory=list)


class RouteOptimizeRequest(BaseModel):
    """Request body for route optimization."""

    rep_id: str
    store_ids: list[str]
    start_location: dict[str, float] | None = None
    company_id: str = ""


class RouteStoreItem(BaseModel):
    """A store in the optimised route."""

    store_id: str
    store_name: str = ""
    lat: float
    lng: float


class RouteOptimizeResponse(BaseModel):
    """Route optimization result."""

    rep_id: str
    ordered_stores: list[RouteStoreItem] = Field(default_factory=list)
    total_distance_km: float = 0.0
    estimated_duration_minutes: float = 0.0
    optimization_status: str = "optimal"


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.post("/demand", response_model=DemandForecastResponse)
async def predict_demand(
    body: DemandForecastRequest,
    db: DbSession,
    user: CurrentUser,
) -> DemandForecastResponse:
    """Get demand forecast for a store-product pair.

    Uses Prophet + XGBoost ensemble model. If no trained model is available,
    falls back to a historical-average heuristic.
    """
    from app.ml.demand_forecast import DemandForecaster

    forecaster = DemandForecaster(db=db)
    prediction = await forecaster.predict(
        store_id=body.store_id,
        product_id=body.product_id,
        horizon_days=body.horizon_days,
    )

    return DemandForecastResponse(
        store_id=prediction.store_id,
        product_id=prediction.product_id,
        horizon_days=prediction.horizon_days,
        predicted_qty=prediction.predicted_qty,
        lower_bound=prediction.lower_bound,
        upper_bound=prediction.upper_bound,
        confidence=prediction.confidence,
        trend=prediction.trend,
        model_version=prediction.model_version,
    )


@router.post("/stockout-scan", response_model=StockoutScanResponse)
async def scan_stockouts(
    body: StockoutScanRequest,
    db: DbSession,
    user: CurrentUser,
) -> StockoutScanResponse:
    """Scan all store-SKU combinations for stockout risk.

    Returns items with stockout probability above the configured threshold
    (default 70%). This endpoint is called by the n8n stockout alert workflow
    every 4 hours.
    """
    from app.ml.stockout import StockoutPredictor

    predictor = StockoutPredictor(db=db)
    result = await predictor.scan_all(company_id=body.company_id)

    alerts = [
        StockoutAlertItem(
            store_id=a.store_id,
            product_id=a.product_id,
            store_name=a.store_name,
            product_name=a.product_name,
            probability=a.probability,
            days_until_stockout=a.days_until_stockout,
            current_stock=a.current_stock,
            suggested_reorder_qty=a.suggested_reorder_qty,
            risk_level=a.risk_level,
            factors=a.factors,
        )
        for a in result.alerts
    ]

    return StockoutScanResponse(
        company_id=result.company_id,
        total_scanned=result.total_scanned,
        alert_count=len(alerts),
        alerts=alerts,
        scan_duration_seconds=result.scan_duration_seconds,
    )


@router.post("/credit", response_model=CreditScoreResponse)
async def score_credit(
    body: CreditScoreRequest,
    db: DbSession,
    user: CurrentUser,
) -> CreditScoreResponse:
    """Get credit score and tier for a retail store.

    Returns a tier (A/B/C/D), numeric score (0-100), contributing factors,
    and recommended credit limits.
    """
    from app.ml.credit_score import CreditScorer

    scorer = CreditScorer(db=db)
    result = await scorer.score(store_id=body.store_id, company_id=body.company_id)

    return CreditScoreResponse(
        store_id=result.store_id,
        store_name=result.store_name,
        tier=result.tier,
        score=result.score,
        factors=[
            CreditFactorItem(
                name=f.name, value=f.value, impact=f.impact, description=f.description,
            )
            for f in result.factors
        ],
        recommended_credit_limit_inr=result.recommended_credit_limit_inr,
        max_payment_terms_days=result.max_payment_terms_days,
    )


@router.post("/attrition", response_model=AttritionResponse)
async def predict_attrition(
    body: AttritionRequest,
    db: DbSession,
    user: CurrentUser,
) -> AttritionResponse:
    """Predict churn probability for a retail store.

    Returns the churn probability, risk level, contributing factors,
    and recommended intervention actions.
    """
    from app.ml.attrition import AttritionPredictor

    predictor = AttritionPredictor(db=db)
    result = await predictor.predict(store_id=body.store_id, company_id=body.company_id)

    return AttritionResponse(
        store_id=result.store_id,
        store_name=result.store_name,
        churn_probability=result.churn_probability,
        risk_level=result.risk_level,
        contributing_factors=result.contributing_factors,
        recommended_actions=result.recommended_actions,
    )


@router.post("/route", response_model=RouteOptimizeResponse)
async def optimize_route(
    body: RouteOptimizeRequest,
    db: DbSession,
    user: CurrentUser,
) -> RouteOptimizeResponse:
    """Optimise the visit route for a sales rep.

    Solves the TSP to find the optimal visiting sequence that minimises
    total travel distance.
    """
    from app.ml.route_optimizer import RouteOptimizer

    optimizer = RouteOptimizer(db=db)
    result = await optimizer.optimize(
        rep_id=body.rep_id,
        store_ids=body.store_ids,
        start_location=body.start_location,
        company_id=body.company_id,
    )

    return RouteOptimizeResponse(
        rep_id=result.rep_id,
        ordered_stores=[
            RouteStoreItem(
                store_id=s.store_id,
                store_name=s.store_name,
                lat=s.lat,
                lng=s.lng,
            )
            for s in result.ordered_stores
        ],
        total_distance_km=result.total_distance_km,
        estimated_duration_minutes=result.estimated_duration_minutes,
        optimization_status=result.optimization_status,
    )
