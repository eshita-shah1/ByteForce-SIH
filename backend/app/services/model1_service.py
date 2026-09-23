"""Model 1 (manganese prospectivity) inference service.

Loads the trained preprocessor.pkl + xgboost_manganese_model.pkl exactly
once at startup and never calls fit()/fit_transform() on them. Reproduces
training-time preprocessing exactly by delegating to the loaded
ColumnTransformer, then applies the model's own decision threshold from
model_config.json.

Explainability (2026): a shap.TreeExplainer is built directly from the
loaded XGBClassifier at load time - there is no shipped explainer artifact
for Model 1 (unlike Model 2 v3's model2_shap_explainer.pkl), so this
constructs one deterministically from the artifact itself, exact tree SHAP
(not sampled/approximated). Verified directly against this exact model
(model2-style reconciliation check): shap_values() returns ONE array per
sample (XGBoost binary:logistic has a single logit output, not one array
per class); sum(shap_values) + expected_value reproduces the model's raw
margin exactly, and sigmoid(margin) == predict_proba()[:, 1]. Since
classes_ == [0, 1] and predict_proba()[:, 1] is the "manganese_present"
probability (see module docstring above), a POSITIVE shap value pushes the
prediction TOWARD manganese_present, and a NEGATIVE shap value pushes it
AWAY from manganese_present (toward manganese_absent) - this is the
verified rule explain() implements, not an assumption about "largest
absolute value = positive".
"""
from __future__ import annotations

import logging

import joblib
import pandas as pd

from app.core.config import Settings
from app.core.exceptions import InferenceError, ModelNotLoadedError
from app.ml.model1.feature_schema import (
    get_binary_features,
    get_categorical_features,
    get_decision_threshold,
    get_feature_columns,
    get_feature_label,
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
        self._explainer = None
        # raw feature name -> list of column indices in the preprocessor's
        # transformed output that belong to it (1 index for numeric/binary
        # passthrough columns, N indices for a one-hot-encoded categorical's
        # N categories). Built once at load time from the preprocessor's own
        # get_feature_names_out(), never guessed.
        self._raw_to_transformed_indices: dict[str, list[int]] = {}
        self._threshold = get_decision_threshold()
        self._feature_columns = get_feature_columns()
        self._binary_features = set(get_binary_features())
        self._categorical_features = set(get_categorical_features())

    @property
    def is_loaded(self) -> bool:
        return self._preprocessor is not None and self._model is not None

    @property
    def explainer_loaded(self) -> bool:
        return self._explainer is not None

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
            self._explainer = None
            return

        try:
            self._raw_to_transformed_indices = self._build_raw_to_transformed_indices()
            import shap

            self._explainer = shap.TreeExplainer(self._model)
            logger.info("Model 1 SHAP explainer built (TreeExplainer over the loaded XGBClassifier).")
        except Exception:
            logger.exception(
                "Failed to build Model 1's SHAP explainer; predictions will proceed without explanations."
            )
            self._explainer = None
            self._raw_to_transformed_indices = {}

    def _build_raw_to_transformed_indices(self) -> dict[str, list[int]]:
        """Maps each of the 111 raw feature columns to its column index/indices
        in the preprocessor's 119-column transformed output, using the
        preprocessor's own get_feature_names_out() (never a guessed order).
        Numeric/binary columns map 1:1 ("numeric__<raw>" / "binary__<raw>");
        a categorical column maps to every one-hot column the fitted
        OneHotEncoder produced for it ("categorical__<raw>_<category>").
        Validated to cover every output column exactly once - if it doesn't,
        the mapping is unreliable and explain() must not be trusted."""
        out_names = list(self._preprocessor.get_feature_names_out())
        groups: dict[str, list[int]] = {c: [] for c in self._feature_columns}

        for idx, out_name in enumerate(out_names):
            _, _, rest = out_name.partition("__")
            matched_raw = None
            for raw in self._feature_columns:
                if raw in self._categorical_features:
                    if rest == raw or rest.startswith(raw + "_"):
                        matched_raw = raw
                        break
                elif rest == raw:
                    matched_raw = raw
                    break
            if matched_raw is None:
                raise ValueError(f"Transformed output column {out_name!r} did not match any raw feature column.")
            groups[matched_raw].append(idx)

        total_mapped = sum(len(v) for v in groups.values())
        if total_mapped != len(out_names):
            raise ValueError(
                f"Raw-to-transformed feature mapping is incomplete: mapped {total_mapped} of "
                f"{len(out_names)} transformed columns."
            )
        return groups

    def _transform(self, feature_dict: dict) -> tuple[dict, "pd.DataFrame", object]:
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

        transformed = self._preprocessor.transform(df)
        return row, df, transformed

    def predict(self, feature_dict: dict) -> dict:
        if not self.is_loaded:
            raise ModelNotLoadedError(
                "Model 1 is not loaded.",
                details="preprocessor.pkl / xgboost_manganese_model.pkl failed to load at startup.",
            )

        try:
            _row, _df, transformed = self._transform(feature_dict)
            proba = self._model.predict_proba(transformed)
        except InferenceError:
            raise
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

    def explain(self, feature_dict: dict, top_n: int = 5) -> dict | None:
        """Returns {"positive_contributors": [...], "negative_contributors": [...]},
        each a list of up to top_n {"feature", "label", "input_value",
        "shap_value"} dicts - real SHAP output for this exact input, never
        fabricated. positive_contributors push toward manganese_present
        (shap_value > 0), sorted strongest-first; negative_contributors push
        away from it (shap_value < 0), sorted strongest-first (most negative
        first). Returns None (not a raised error) if the explainer isn't
        available or explanation generation fails for any reason - Model 1's
        prediction must remain reliable even when its explanation can't be
        produced; the failure is logged, never silently fabricated."""
        if self._explainer is None or not self._raw_to_transformed_indices:
            return None

        try:
            row, _df, transformed = self._transform(feature_dict)
            shap_values = self._explainer.shap_values(transformed)[0]

            contributions = []
            for raw_feature in self._feature_columns:
                indices = self._raw_to_transformed_indices.get(raw_feature, [])
                if not indices:
                    continue
                aggregated = float(sum(shap_values[i] for i in indices))
                contributions.append(
                    {
                        "feature": raw_feature,
                        "label": get_feature_label(raw_feature),
                        "input_value": row[raw_feature],
                        "shap_value": aggregated,
                    }
                )
        except Exception:
            logger.exception("Model 1 SHAP explanation failed; returning no explanation for this prediction.")
            return None

        positive = sorted((c for c in contributions if c["shap_value"] > 0), key=lambda c: c["shap_value"], reverse=True)
        negative = sorted((c for c in contributions if c["shap_value"] < 0), key=lambda c: c["shap_value"])

        return {
            "positive_contributors": positive[:top_n],
            "negative_contributors": negative[:top_n],
        }


model1_service = Model1Service()
