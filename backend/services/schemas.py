"""Versioned Pydantic contract for AI output. Strict enums; extra fields rejected."""
from typing import Literal

from pydantic import BaseModel, Field

SCHEMA_VERSION = "1.0"

class EvidenceItem(BaseModel):
    model_config = {"extra": "forbid"}
    document_chunk_id: str
    page_number: int = Field(ge=1)
    quoted_text: str = Field(min_length=1, max_length=2000)

class PolicyRef(BaseModel):
    model_config = {"extra": "forbid"}
    policy_id: str
    policy_version: str
    section_id: str

class FindingOut(BaseModel):
    model_config = {"extra": "forbid"}
    finding_id: str
    title: str = Field(min_length=1, max_length=300)
    description: str
    category: Literal["missing_clause","violation","inconsistency","risk","general_observation"]
    severity: Literal["low","medium","high","critical"]
    confidence: float = Field(ge=0.0, le=1.0)
    evidence: list[EvidenceItem] = []
    policy_references: list[PolicyRef] = []
    reasoning_summary: str
    recommended_action: str
    requires_human_review: bool = True

class ReviewOutput(BaseModel):
    model_config = {"extra": "forbid"}
    document_id: str
    review_status: Literal["completed"]
    summary: str
    findings: list[FindingOut] = []
