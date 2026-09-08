"""Model 1 (manganese prospectivity) inference service.

Loads the trained preprocessor.pkl + xgboost_manganese_model.pkl exactly
once at startup and never calls fit()/fit_transform() on them. Reproduces
training-time preprocessing exactly by delegating to the loaded
ColumnTransformer, then applies the model's own decision threshold from
model_config.json.
"""
from __future__ import annotations

import logging

import joblib
import pandas as pd

from app.core.config import Settings
from app.core.exceptions import InferenceError, ModelNotLoadedError
from app.ml.model1.feature_schema import (
    get_binary_features,
    get_decision_threshold,
    get_feature_columns,
)

logger = logging.getLogger("app.model1")


def _install_sklearn_compat_shim() -> None:
    """preprocessor.pkl was pickled with scikit-learn 1.6.1. Newer sklearn
    versions removed the internal `_RemainderColsList` marker class used by
    ColumnTransformer's pickled state, which otherwise breaks unpickling
    with an AttributeError. It is purely a list subclass used for a display
    warning, so a stand-in is safe. Only installed if actually needed."""
    import sklearn.compose._column_transformer as ct

    if not hasattr(ct, "_RemainderColsList"):
        class _RemainderColsList(list):
            pass

        ct._RemainderColsList = _RemainderColsList
        logger.info("Installed sklearn compatibility shim for _RemainderColsList.")


class Model1Service:
    def __init__(self) -> None:
        self._preprocessor = None
        self._model = None
        self._threshold = get_decision_threshold()
        self._feature_columns = get_feature_columns()
        self._binary_features = set(get_binary_features())

    @property
    def is_loaded(self) -> bool:
        return self._preprocessor is not None and self._model is not None

    def load(self, settings: Settings) -> None:
        try:
            _install_sklearn_compat_shim()
            self._preprocessor = joblib.load(settings.model1_preprocessor_path)
            self._model = joblib.load(settings.model1_model_path)
            logger.info(
                "Model 1 loaded: %d raw features -> %d model inputs, threshold=%.4f",
                len(self._feature_columns),
                getattr(self._model, "n_features_in_", -1),
                self._threshold,
            )
        except Exception:
            logger.exception("Failed to load Model 1 artifacts.")
            self._preprocessor = None
            self._model = None

    def predict(self, feature_dict: dict) -> dict:
        if not self.is_loaded:
            raise ModelNotLoadedError(
                "Model 1 is not loaded.",
                details="preprocessor.pkl / xgboost_manganese_model.pkl failed to load at startup.",
            )

        missing = [c for c in self._feature_columns if c not in feature_dict]
        if missing:
            raise InferenceError(
                "Feature vector is incomplete.",
                details=f"Missing columns: {missing}",
            )

        row = {c: feature_dict[c] for c in self._feature_columns}
        df = pd.DataFrame([row], columns=self._feature_columns)

        # SimpleImputer in current scikit-learn rejects bool-dtype columns
        # outright; the trained pipeline's "binary" branch expects a
        # numeric/most-frequent-imputable column, so cast without changing
        # the values themselves (True/False -> 1.0/0.0).
        for col in self._binary_features:
            if col in df.columns:
                df[col] = df[col].astype(float)

        try:
            transformed = self._preprocessor.transform(df)
            proba = self._model.predict_proba(transformed)
        except Exception as exc:
            logger.exception("Model 1 inference failed.")
            raise InferenceError("Model 1 inference failed.", details=str(exc)) from exc

        positive_probability = float(proba[0][1])
        label = "manganese_present" if positive_probability >= self._threshold else "manganese_absent"
        return {
            "prediction": label,
            "probability": positive_probability,
            "decision_threshold": self._threshold,
            "features_used": self._feature_columns,
        }


model1_service = Model1Service()
