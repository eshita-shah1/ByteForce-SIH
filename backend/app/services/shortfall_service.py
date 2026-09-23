from __future__ import annotations

import logging

from app.core.config import Settings
from app.ml.model2.feature_schema import LIVE_SOURCEABLE_FEATURES
from app.schemas.shortfall import ShapContribution, ShortfallRequest, ShortfallResponse
from app.services.external_data_service import resolve_environment_features
from app.services.model2_service import model2_service
from app.services.recommendation_service import build_recommendations, calculate_risk

logger = logging.getLogger("app.shortfall")

# Model 2 v3's raw XGBRegressor output is NOT on the same scale as real
# actual_production_tonnes - same "target-mean-centering transform with no
# inverse in the exported artifact" signature as the retired v2 model, just
# a different constant. Re-derived 2026-09-22 against
# backend/data/model2_training_dataset_v2.csv (5,000 rows, the training
# dataset shipped alongside this exact model2_xgboost_production.pkl -
# columns match its 15 required features exactly): raw output is centered
# near 0 (mean 0.26, std 58.6 across all 5,000 rows) while real
# actual_production_tonnes is centered near 498.8 (std 57.6). Fitting the
# constant on an 80% split and evaluating on the untouched 20% holdout:
# MAE drops from 425.1 tonnes (raw, unusable) to 7.9 tonnes, with 0
# negative corrected predictions in the holdout (and 0 across all 5,000
# rows). The constant is stable across pits (424.9-425.8) and shifts
# (425.3-425.5) - a global offset, not something needing per-pit tuning.
# See backend/tests/test_shortfall_service.py for the reproducible
# recomputation of this constant against the same checked-in dataset,
# mirroring the methodology used for the retired v2 constant (421.19) -
# these are NOT the same constant and must not be conflated; each is
# specific to its own artifact.
MODEL2_TARGET_RECENTERING_TONNES = 425.49


async def predict_shortfall(request: ShortfallRequest, settings: Settings) -> ShortfallResponse:
    request_dict = request.model_dump()

    env_values, env_sources = await resolve_environment_features(request_dict, settings)
    request_dict.update(env_values)

    raw_prediction = model2_service.predict(request_dict)

    # Recover the model's real-world tonnage scale (see
    # MODEL2_TARGET_RECENTERING_TONNES above for the evidence). This is a
    # calibration recovery, not a percentage cap or a fabricated
    # adjustment - model2_service.predict() remains an unmodified,
    # honest passthrough of the raw .pkl output; this constant is applied
    # here, at the point that raw output becomes a business quantity.
    rescaled_prediction = raw_prediction + MODEL2_TARGET_RECENTERING_TONNES

    # Even after rescaling, a genuinely severe combination of conditions
    # (or an input far outside the calibration dataset's range) can still
    # drive the estimate below zero - production this shift cannot
    # actually be negative, so it is floored at 0 tonnes here, the single
    # remaining point where the model's output becomes a business
    # quantity. This floor is a physical-domain constraint applied
    # uniformly to every request, not a percentage cap: shortfall_percentage
    # staying within [0, 100] falls out of it as a mathematical
    # consequence (shortfall can never exceed target once predicted can
    # never go below 0), it is not separately clamped anywhere.
    prediction = max(0.0, rescaled_prediction)
    if rescaled_prediction < 0:
        logger.info(
            "Model 2 rescaled prediction %.2f tonnes (raw %.2f + %.2f) was still negative for "
            "pit=%s shift=%s target=%.2f; floored to 0.0 tonnes for the operational report.",
            rescaled_prediction, raw_prediction, MODEL2_TARGET_RECENTERING_TONNES,
            request.pit_id, request.shift_type, request.target_production_tonnes,
        )

    target = request.target_production_tonnes
    shortfall = max(0.0, target - prediction)
    shortfall_percentage = (shortfall / target * 100) if target > 0 else 0.0
    risk = calculate_risk(shortfall_percentage)

    causes, measures = build_recommendations(request_dict)

    # feature_sources covers the model's actual 15 required columns (order/
    # names loaded from models/model2_features.json by model2_service - see
    # its docstring), plus pit_id/shift_type (still real request fields,
    # always user-supplied, even though the v3 model no longer consumes
    # them), plus rainfall_intensity_mm specifically: it's live-sourceable
    # and still resolved every request for recommendation_service.py's rain
    # rule and the "Live Environmental Context" bar, but it is NOT one of
    # v3's 15 model columns, so it wouldn't otherwise appear here.
    feature_sources: dict[str, str] = {"shift_type": "user", "pit_id": "user"}
    for field in set(model2_service.feature_columns) | LIVE_SOURCEABLE_FEATURES:
        if field in LIVE_SOURCEABLE_FEATURES:
            feature_sources[field] = env_sources.get(field, "user")
        else:
            feature_sources[field] = "user"

    # Real SHAP output for this exact request - never fabricated; None only
    # if the explainer failed to load (see model2_service.py).
    shap_contributions = model2_service.explain(request_dict)
    shap_explanation = (
        [ShapContribution(**c) for c in shap_contributions] if shap_contributions is not None else None
    )

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
        shap_explanation=shap_explanation,
    )
