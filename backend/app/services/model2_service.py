"""Model 2 (production shortfall) inference service - "v3" artifact
(2026-09-22 deployment package: model2_xgboost_production.pkl +
model2_shap_explainer.pkl + model2_features.json).

Loads a bare xgboost.sklearn.XGBRegressor (NOT a sklearn Pipeline - there is
no bundled preprocessing/encoding in this artifact) and its paired SHAP
TreeExplainer exactly once at startup, and never re-fits either. The 15
required feature names/order come from model2_features.json - verified by
direct inspection to equal the booster's own feature_names_in_, in the same
order - so that file is the single source of truth for column order rather
than a second hardcoded list that could drift from the artifact.

Verified at inspection time:
  - model2_xgboost_production.pkl: XGBRegressor, objective=reg:squarederror,
    n_estimators=700, max_depth=5, n_features_in_=15, no classes_ (a
    regressor). All 15 features are numeric (int/float) - no categorical
    encoding step exists or is needed, and pit_id/shift_type/month/
    day_of_week (used by the retired v2 artifact - see
    model2_service_v2_legacy.py) are not among its inputs at all.
  - model2_shap_explainer.pkl: shap.explainers.TreeExplainer,
    feature_perturbation="tree_path_dependent", model_output="raw".
    Confirmed compatible with the production model directly: for a test
    row, sum(shap_values) + expected_value reproduces model.predict()
    exactly.
  - Like the retired v2 artifact, this model's raw output is NOT on the
    actual_production_tonnes scale (mean ~0, std ~59 on the 5,000-row
    backend/data/model2_training_dataset_v2.csv dataset) - the recentering
    correction lives in shortfall_service.py, applied to this service's
    raw, unmodified output.
"""
from __future__ import annotations

import json
import logging

import joblib
import pandas as pd

from app.core.config import Settings
from app.core.exceptions import InferenceError, ModelNotLoadedError

logger = logging.getLogger("app.model2")


class Model2Service:
    def __init__(self) -> None:
        self._model = None
        self._explainer = None
        self._feature_columns: list[str] = []

    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    @property
    def explainer_loaded(self) -> bool:
        return self._explainer is not None

    @property
    def feature_columns(self) -> list[str]:
        return list(self._feature_columns)

    def load(self, settings: Settings) -> None:
        try:
            with open(settings.model2_v3_features_path, encoding="utf-8") as f:
                feature_columns = json.load(f)
            if not isinstance(feature_columns, list) or not all(isinstance(c, str) for c in feature_columns):
                raise ValueError(f"{settings.model2_v3_features_path} must contain a JSON array of strings.")

            model = joblib.load(settings.model2_v3_model_path)

            model_feature_names = list(getattr(model, "feature_names_in_", []))
            if model_feature_names and model_feature_names != feature_columns:
                logger.warning(
                    "model2_features.json order does not match the model's own "
                    "feature_names_in_. Using the model's order to stay consistent "
                    "with what the artifact was actually trained on. json=%s model=%s",
                    feature_columns, model_feature_names,
                )
                feature_columns = model_feature_names

            self._feature_columns = feature_columns
            self._model = model

            try:
                self._explainer = joblib.load(settings.model2_v3_explainer_path)
            except Exception:
                logger.exception(
                    "Model 2 SHAP explainer failed to load; predictions will proceed "
                    "without explanations."
                )
                self._explainer = None

            logger.info(
                "Model 2 (v3) loaded: %d raw inputs, explainer_loaded=%s",
                len(self._feature_columns), self.explainer_loaded,
            )
        except Exception:
            logger.exception("Failed to load Model 2 (v3) artifact.")
            self._model = None
            self._explainer = None

    def _build_frame(self, raw_input: dict) -> pd.DataFrame:
        missing = [c for c in self._feature_columns if c not in raw_input]
        if missing:
            raise InferenceError(
                "Feature vector is incomplete.",
                details=f"Missing columns: {missing}",
            )
        return pd.DataFrame([{c: raw_input[c] for c in self._feature_columns}], columns=self._feature_columns)

    def predict(self, raw_input: dict) -> float:
        if not self.is_loaded:
            raise ModelNotLoadedError(
                "Model 2 is not loaded.",
                details="model2_xgboost_production.pkl failed to load at startup.",
            )

        df = self._build_frame(raw_input)

        try:
            prediction = self._model.predict(df)[0]
        except Exception as exc:
            logger.exception("Model 2 inference failed.")
            raise InferenceError("Model 2 inference failed.", details=str(exc)) from exc

        return float(prediction)

    def explain(self, raw_input: dict, top_n: int = 5) -> list[dict] | None:
        """Returns the top_n features by |SHAP value| for this exact input,
        each as {"feature", "value", "shap_value", "direction"} - direction
        is "increases_prediction"/"decreases_prediction" based on the sign
        of that feature's own SHAP value (raw margin space, matching the
        explainer's model_output="raw"). Returns None if the explainer
        failed to load; never fabricates contributions."""
        if self._explainer is None:
            return None

        df = self._build_frame(raw_input)

        try:
            shap_values = self._explainer.shap_values(df)[0]
        except Exception as exc:
            logger.exception("Model 2 SHAP explanation failed.")
            raise InferenceError("Model 2 explanation failed.", details=str(exc)) from exc

        contributions = [
            {
                "feature": feature,
                "value": df.iloc[0][feature],
                "shap_value": float(shap_value),
                "direction": "increases_prediction" if shap_value >= 0 else "decreases_prediction",
            }
            for feature, shap_value in zip(self._feature_columns, shap_values)
        ]
        contributions.sort(key=lambda c: abs(c["shap_value"]), reverse=True)
        return contributions[:top_n]


model2_service = Model2Service()
