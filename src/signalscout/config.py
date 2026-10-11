from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, Field


class TriggerFunding(BaseModel):
    enabled: bool = True
    max_age_days: int = 14
    min_severity: int = 80


class TriggerHeadcount(BaseModel):
    enabled: bool = True
    min_pct_30d: float = 10
    gtm_titles_only: bool = True
    min_severity: int = 65


class TriggerExecHire(BaseModel):
    enabled: bool = True
    titles: list[str] = Field(default_factory=list)
    max_tenure_days: int = 45
    min_severity: int = 75


class TriggerTechChange(BaseModel):
    enabled: bool = False
    min_severity: int = 60


class Triggers(BaseModel):
    funding: TriggerFunding = Field(default_factory=TriggerFunding)
    headcount_surge: TriggerHeadcount = Field(default_factory=TriggerHeadcount)
    exec_hire: TriggerExecHire = Field(default_factory=TriggerExecHire)
    tech_change: TriggerTechChange = Field(default_factory=TriggerTechChange)


class SegmentConfig(BaseModel):
    dsl_text: str
    crustdata_filters: list[dict[str, Any]]
    search: dict[str, Any] | None = None
    crustdata_fields: list[str] = Field(default_factory=list)
    triggers: Triggers = Field(default_factory=Triggers)
    archive_below_severity: int = 70
    credit_budget_per_cycle: float = 50
    cadence_hours: int = 6
    limit_companies: int = 25
    # Cap Research/Draft LLM work so one cycle finishes in minutes
    max_signals_per_cycle: int = 5
    region: str = "US"


def load_segment(path: str | Path) -> SegmentConfig:
    data = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
    return SegmentConfig.model_validate(data)


def filters_for_crustdata(cfg: SegmentConfig) -> dict[str, Any]:
    """Build CrustData filters object (single condition or op/and)."""
    conds = list(cfg.crustdata_filters)
    if not conds:
        return {"field": "locations.country", "type": "=", "value": "USA"}
    if len(conds) == 1:
        return conds[0]
    return {"op": "and", "conditions": conds}
