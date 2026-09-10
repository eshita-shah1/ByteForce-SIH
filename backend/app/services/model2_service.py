"""Model 2 (production shortfall) inference service.

Loads the trained sklearn Pipeline (preprocessor + XGBRegressor) exactly
once at startup and never re-fits it. Prefers MOIL_Module2_Final_Model.pkl
(a dict wrapper with metadata: {"pipeline", "model_type", "target",
"module", "version"}); falls back to the bare moil_production_pipeline.pkl
if that dict form is unavailable, since both were verified to contain the
structurally identical fitted Pipeline.
"""
from __future__ import annotations

import logging

import joblib
import pandas as pd

from app.core.config import Settings
from app.core.exceptions import InferenceError, ModelNotLoadedError
from app.ml.model2.feature_schema import RAW_FEATURE_COLUMNS, TARGET_COLUMN

logger = logging.getLogger("app.model2")


class Model2Service:
    def __init__(self) -> None:
        self._pipeline = None
        self._metadata: dict = {}

    @property
    def is_loaded(self) -> bool:
        return self._pipeline is not None

    def load(self, settings: Settings) -> None:
        try:
            import sklearn.compose._column_transformer as ct

            if not hasattr(ct, "_RemainderColsList"):
                class _RemainderColsList(list):
                    pass

                ct._RemainderColsList = _RemainderColsList

            try:
                artifact = joblib.load(settings.model2_pipeline_path)
                if isinstance(artifact, dict) and "pipeline" in artifact:
                    self._pipeline = artifact["pipeline"]
                    self._metadata = {k: v for k, v in artifact.items() if k != "pipeline"}
                else:
                    self._pipeline = artifact
            except FileNotFoundError:
                self._pipeline = joblib.load(settings.model2_pipeline_fallback_path)

            logger.info(
                "Model 2 loaded: %d raw inputs, target=%s, metadata=%s",
                len(RAW_FEATURE_COLUMNS),
                TARGET_COLUMN,
                self._metadata,
            )
        except Exception:
            logger.exception("Failed to load Model 2 artifact.")
            self._pipeline = None

    def predict(self, raw_input: dict) -> float:
        if not self.is_loaded:
            raise ModelNotLoadedError(
                "Model 2 is not loaded.",
                details="MOIL_Module2_Final_Model.pkl / moil_production_pipeline.pkl failed to load at startup.",
            )

        missing = [c for c in RAW_FEATURE_COLUMNS if c not in raw_input]
        if missing:
            raise InferenceError(
                "Feature vector is incomplete.",
                details=f"Missing columns: {missing}",
            )

        df = pd.DataFrame([{c: raw_input[c] for c in RAW_FEATURE_COLUMNS}], columns=RAW_FEATURE_COLUMNS)

        try:
            prediction = self._pipeline.predict(df)[0]
        except Exception as exc:
            logger.exception("Model 2 inference failed.")
            raise InferenceError("Model 2 inference failed.", details=str(exc)) from exc

        return float(prediction)


model2_service = Model2Service()
