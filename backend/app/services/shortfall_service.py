from __future__ import annotations

import datetime as dt
import logging

from app.core.config import Settings
from app.ml.model2.feature_schema import LIVE_SOURCEABLE_FEATURES, NUMERIC_FEATURES
from app.schemas.shortfall import ShortfallRequest, ShortfallResponse
from app.services.external_data_service import resolve_environment_features
from app.services.model2_service import model2_service
from app.services.recommendation_service import build_recommendations, calculate_risk

logger = logging.getLogger("app.shortfall")


async def predict_shortfall(request: ShortfallRequest, settings: Settings) -> ShortfallResponse:
    request_dict = request.model_dump()

    env_values, env_sources = await resolve_environment_features(request_dict, settings)
    request_dict.update(env_values)

    timestamp = dt.datetime.fromisoformat(request.timestamp.replace("Z", "+00:00"))
    request_dict["month"] = timestamp.month
    request_dict["day_of_week"] = timestamp.weekday()

    raw_prediction = model2_service.predict(request_dict)

    # Model 2's fitted XGBRegressor (objective=reg:squarederror, no target
    # transform, no built-in non-negativity constraint - verified directly
    # against the artifact, not assumed) is free to extrapolate below zero
    # for inputs far from its training distribution; this has been
    # empirically confirmed to happen for realistic inputs under the
    # current 150-600 tonnes/shift target range (see the 2026-09 negative-
    # prediction audit). A negative extracted-tonnage figure is not a
    # meaningful real-world quantity - production this shift was either
    # some non-negative amount or effectively zero - so the operational
    # prediction is floored at 0 tonnes here, at the single point where
    # the model's raw output becomes a business quantity. This is a
    # physical-domain floor applied uniformly to every request, not a
    # percentage cap: shortfall_percentage staying within [0, 100] falls
    # out of this floor as a mathematical consequence (shortfall can never
    # exceed target once predicted can never go below 0), it is not
    # separately clamped anywhere.
    prediction = max(0.0, raw_prediction)
    if raw_prediction < 0:
        logger.info(
            "Model 2 raw prediction %.2f tonnes was negative for pit=%s shift=%s target=%.2f; "
            "floored to 0.0 tonnes for the operational report.",
            raw_prediction, request.pit_id, request.shift_type, request.target_production_tonnes,
        )

    target = request.target_production_tonnes
    shortfall = max(0.0, target - prediction)
    shortfall_percentage = (shortfall / target * 100) if target > 0 else 0.0
    risk = calculate_risk(shortfall_percentage)

    causes, measures = build_recommendations(request_dict)

    feature_sources: dict[str, str] = {"shift_type": "user", "pit_id": "user"}
    for field in NUMERIC_FEATURES:
        if field in LIVE_SOURCEABLE_FEATURES:
            feature_sources[field] = env_sources.get(field, "user")
        else:
            feature_sources[field] = "user"
    feature_sources["month"] = "derived_from_timestamp"
    feature_sources["day_of_week"] = "derived_from_timestamp"

    return ShortfallResponse(
        pit_id=request.pit_id,
        shift_type=request.shift_type,
        target_production_tonnes=round(target, 2),
        predicted_production_tonnes=round(prediction, 2),
        shortfall_tonnes=round(shortfall, 2),
        shortfall_percentage=round(shortfall_percentage, 2),
        risk=risk,
        primary_causes=causes,
        corrective_measures=measures,
        feature_sources=feature_sources,
    )
