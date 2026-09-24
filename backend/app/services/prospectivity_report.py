"""Builds the redesigned Model 1 technical-assessment report (2026) from a
real, already-computed ProspectivityResponse only - never a second/duplicate
prediction, never a fabricated SHAP value or geological claim.

Factor selection: "supporting" = response.positive_contributors (already
sorted strongest-first by model1_service.explain()), "limiting" =
response.negative_contributors (already sorted most-negative-first). The
report keeps up to 3 supporting + 2 limiting (5 total), each additionally
required to have |shap_value| >= 5% of the strongest contributor's
|shap_value| across both lists - a display/legibility threshold on the
model's own real SHAP output, not an invented geological cutoff. If one
side has no contributor clearing that bar, fewer (or zero) are shown on
that side rather than padding with negligible ones ("do not force an
artificial balance").

Per-factor explanations and the narrative/why-it-predicted text are
template-generated from real values (label, input_value, shap_value,
direction, and app.ml.model1.feature_schema.feature_group()'s real
categorization of the feature) - never a bespoke per-feature geological
claim, since no validated human-readable feature interpretation exists
anywhere in this repository (see model1_service.py's FEATURE_LABELS
docstring). SHAP is always described as "contribution to the model's
prediction", never as proof of manganese presence/absence.

Exploration plan: no validated Model 1 field-exploration rules exist in
this repository. The consolidated plan below is a fixed, generic
validation/exploration workflow (not tied to any per-feature or numeric
threshold), gated only on the model's own real predicted class - explicitly
framed as recommended field validation guidance, never a declaration that
mining should proceed or that manganese has been proven/disproven.
"""
from __future__ import annotations

import datetime as dt

from app.ml.model1.feature_schema import feature_group
from app.schemas.prospectivity import ProspectivityContributor, ProspectivityResponse
from app.schemas.prospectivity_report import (
    ProspectivityAssessmentSummary,
    ProspectivityReportData,
    ProspectivityReportFactor,
)

_GROUP_DISPLAY = {
    "remote_sensing": "spectral",
    "environment": "environmental",
    "soil": "soil",
    "terrain": "terrain",
    "spatial_proximity_to_known_mine": "mineral-proximity",
    "land_cover": "land-cover",
    "other": "other",
}

# Display/legibility threshold on the model's OWN real SHAP magnitudes for
# this exact prediction (not a domain/geological cutoff): a contributor
# must be at least this fraction of the strongest contributor's |shap_value|
# to be "meaningful" enough for the report's curated view. The full,
# unfiltered lists remain on ProspectivityResponse.positive_contributors /
# negative_contributors regardless.
_MIN_RELATIVE_MAGNITUDE = 0.05
_SUPPORTING_TARGET = 3
_LIMITING_TARGET = 2
_TOTAL_CAP = 5


def _group_display_names(feature_names: list[str]) -> list[str]:
    """Distinct, real feature_group() categories present, for the narrative
    sentence's natural-language list. "other" (a handful of features that
    don't fit any named category, e.g. flood_risk_score_mean) is dropped
    from THIS list only - it doesn't read as a meaningful indicator type in
    prose - unless it's the only category present, in which case dropping
    it would leave nothing to say."""
    seen: list[str] = []
    for name in feature_names:
        display = _GROUP_DISPLAY.get(feature_group(name), "other")
        if display not in seen:
            seen.append(display)
    named = [g for g in seen if g != "other"]
    return named or seen


def _join_natural(items: list[str]) -> str:
    if not items:
        return "available"
    if len(items) == 1:
        return items[0]
    return ", ".join(items[:-1]) + f", and {items[-1]}"


def _select_factors(
    positive: list[ProspectivityContributor] | None, negative: list[ProspectivityContributor] | None
) -> tuple[list[ProspectivityContributor], list[ProspectivityContributor]]:
    positive = positive or []
    negative = negative or []
    magnitudes = [abs(c.shap_value) for c in positive + negative]
    if not magnitudes:
        return [], []

    threshold = max(magnitudes) * _MIN_RELATIVE_MAGNITUDE
    supporting = [c for c in positive if abs(c.shap_value) >= threshold][:_SUPPORTING_TARGET]
    limiting = [c for c in negative if abs(c.shap_value) >= threshold][:_LIMITING_TARGET]

    while len(supporting) + len(limiting) > _TOTAL_CAP:
        if len(supporting) >= len(limiting) and supporting:
            supporting.pop()
        elif limiting:
            limiting.pop()
        else:
            break
    return supporting, limiting


def _factor_explanation(contributor: ProspectivityContributor, direction: str) -> str:
    group_display = _GROUP_DISPLAY.get(feature_group(contributor.feature), "other")
    descriptor = f"{group_display} indicator" if group_display != "other" else "indicator"
    if direction == "supporting":
        return (
            f"This {descriptor} contributed positively to the model's prediction, "
            f"adding evidence toward the manganese-present class within the pattern the model "
            f"learned from training data."
        )
    return (
        f"This {descriptor} contributed negatively relative to the model's learned "
        f"pattern, representing a limiting factor in this assessment rather than direct evidence "
        f"against manganese mineralization."
    )


def _to_report_factor(contributor: ProspectivityContributor, direction: str) -> ProspectivityReportFactor:
    return ProspectivityReportFactor(
        feature=contributor.feature,
        label=contributor.label,
        input_value=contributor.input_value,
        shap_value=contributor.shap_value,
        direction=direction,
        explanation=_factor_explanation(contributor, direction),
    )


def _exploration_plan(prediction: str) -> tuple[str, list[str]]:
    if prediction == "manganese_present":
        intro = (
            "Based on the combined model evidence, this location can be considered for "
            "field-level validation and further exploration. This is exploration guidance, not "
            "a confirmed finding of manganese mineralization - the final decision remains with "
            "the analyst/geologist."
        )
        plan = [
            "Conduct geological field mapping to verify the mineralization/spectral indicators "
            "identified through remote sensing.",
            "Perform targeted geochemical sampling in higher-priority zones to determine whether "
            "the observed indicators correspond to manganese-bearing mineralization.",
            "Carry out ground-truth validation before advancing to more detailed exploration "
            "activities.",
            "Consider relevant environmental and site-access constraints when planning field "
            "surveys and sampling.",
        ]
    else:
        intro = (
            "Based on the combined model evidence, this location is not currently prioritized "
            "for field exploration. This reflects the model's assessment relative to its "
            "decision threshold, not a definitive geological conclusion."
        )
        plan = [
            "Prioritize field validation resources toward higher-probability locations "
            "identified elsewhere in the study area.",
            "Revisit this location if new geological, spectral, or field survey data becomes "
            "available.",
        ]
    return intro, plan


def build_prospectivity_report(response: ProspectivityResponse) -> ProspectivityReportData:
    contributors_available = response.positive_contributors is not None or response.negative_contributors is not None
    supporting, limiting = _select_factors(response.positive_contributors, response.negative_contributors)

    supporting_factors = [_to_report_factor(c, "supporting") for c in supporting]
    limiting_factors = [_to_report_factor(c, "limiting") for c in limiting]

    pct = response.probability * 100
    predicted_class_label = "Manganese-present" if response.prediction == "manganese_present" else "Manganese-absent"
    groups_text = _join_natural(_group_display_names(response.features_used))

    narrative = (
        f"The model predicts a {pct:.2f}% probability of this location belonging to the "
        f"manganese-present class. The prediction is based on the combined contribution of the "
        f"available {groups_text} indicators."
    )

    if not contributors_available:
        why_explanation = (
            "This prediction is generated by Model 1 from the combined pattern of its input "
            "features. Detailed factor-level SHAP explanation is unavailable for this specific "
            "prediction; the probability above reflects the full feature set, not any single "
            "indicator."
        )
    else:
        why_explanation = (
            f"This {predicted_class_label.lower()} classification (probability {pct:.2f}%, "
            f"decision threshold {response.decision_threshold * 100:.2f}%) reflects the combined "
            f"influence of {len(supporting_factors)} supporting and {len(limiting_factors)} "
            f"limiting indicator(s) identified by the model's SHAP explanation for this exact "
            f"input - not any single feature in isolation. SHAP values describe each feature's "
            f"contribution to the model's own prediction; they are not independent geological "
            f"proof of manganese presence or absence."
        )

    exploration_plan_intro, exploration_plan = _exploration_plan(response.prediction)
    overall_action = (
        "Field validation and targeted exploration"
        if response.prediction == "manganese_present"
        else "Deprioritized pending new data"
    )

    assessment_summary = ProspectivityAssessmentSummary(
        location=f"{response.location.latitude:.4f}°, {response.location.longitude:.4f}°",
        prospectivity=f"{pct:.2f}%",
        predicted_class=predicted_class_label,
        supporting_factors=", ".join(f.label for f in supporting_factors) if supporting_factors else "None identified",
        limiting_factors=", ".join(f.label for f in limiting_factors) if limiting_factors else "None identified",
        overall_action=overall_action,
    )

    return ProspectivityReportData(
        generated_at=dt.datetime.utcnow().isoformat(),
        target_mineral="Manganese",
        prospectivity_percentage=round(pct, 2),
        predicted_class_label=predicted_class_label,
        narrative=narrative,
        why_explanation=why_explanation,
        supporting_factors=supporting_factors,
        limiting_factors=limiting_factors,
        exploration_plan_intro=exploration_plan_intro,
        exploration_plan=exploration_plan,
        assessment_summary=assessment_summary,
    )
