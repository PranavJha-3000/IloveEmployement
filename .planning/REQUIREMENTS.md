# Requirements: iLoveEmployment

**Defined:** 2026-10-31
**Core Value:** Nothing about the user gets invented, and every quality claim is backed by a measured number.

## v1 Requirements (milestone: AI engineering depth)

### Retrieval Evaluation

- [ ] **REVAL-01**: A labelled retrieval dataset exists in the repo: at least 3 synthetic resumes (different seniorities/domains) and at least 60 queries, each with graded relevant chunk ids, including paraphrase queries that share no keywords with their targets
- [ ] **REVAL-02**: A script computes recall@k (k = 3, 5, 8), MRR and nDCG@k for keyword (BM25), embeddings-only, hybrid (RRF) and any later strategy, using the same retrieval code the app uses
- [ ] **REVAL-03**: The script writes a published results table (`evals/RETRIEVAL.md`) with per-strategy metrics, per-query-type breakdown (lexical vs paraphrase) and latency
- [ ] **REVAL-04**: Keyword-only retrieval metrics run in CI without network or API key; a regression below a recorded baseline fails the build

### Reranking

- [ ] **RERANK-01**: An on-device cross-encoder reranker (Transformers.js) can rerank the hybrid top-N candidates, lazy-loaded only on opt-in
- [ ] **RERANK-02**: Reranking is evaluated through the REVAL harness against hybrid alone, including added latency
- [ ] **RERANK-03**: Reranking is enabled in the app only if it improves the primary metric; the decision and numbers are recorded either way

### LLM Evaluation

- [ ] **LEVAL-01**: The behavioural eval suite has been run against at least one real model, with the report committed
- [ ] **LEVAL-02**: The harness can run the same cases across multiple models/providers and produce a side-by-side comparison
- [ ] **LEVAL-03**: Each run records tokens, latency and estimated cost per case and per model
- [ ] **LEVAL-04**: Citation precision (cited chunks that truly support the claim) and fabrication rate are measured per run
- [ ] **LEVAL-05**: An LLM-as-judge scores output quality on a rubric, and its agreement with a hand-labelled subset is reported
- [ ] **LEVAL-06**: The eval case set grows to at least 25 cases covering every engine

### Agent Workflow

- [ ] **AGENT-01**: An "Apply to this job" workflow takes a job description and runs a bounded tool-calling loop over existing engines (fit check, tailor resume, cover letter, outreach message) as tools
- [ ] **AGENT-02**: The loop enforces a step budget and token budget, and stops with a clear reason when exceeded
- [ ] **AGENT-03**: Workflow state (steps, tool calls, outputs) persists in the vault so a run can be resumed
- [ ] **AGENT-04**: The user approves or edits at checkpoints (e.g. after fit check, before drafting outreach); a SKIP verdict ends the workflow unless overridden
- [ ] **AGENT-05**: Every artifact from the workflow carries the same grounding guarantees as the standalone tools
- [ ] **AGENT-06**: The workflow is covered by scripted-model tests (tool selection, budget stop, approval gating) and by at least 3 eval cases

### Document Intelligence

- [ ] **DOC-01**: Uploading a resume produces a typed, validated profile (contact, roles with dates, education, skills, projects) shown for the user to confirm or correct
- [ ] **DOC-02**: Extracted skills are normalized to a canonical taxonomy with aliases (e.g. "JS" → JavaScript), used by fit and ATS scoring
- [ ] **DOC-03**: Profile extraction accuracy is measured against labelled resumes (field-level precision/recall)
- [ ] **DOC-04**: The vault keeps resume versions (base and tailored) with a diff view and the job each version targeted

### Observability

- [ ] **OBS-01**: Every run emits a structured trace: retrieval, context blocks, model calls, review pass, finalizers, with timings and token counts
- [ ] **OBS-02**: Traces export to a standard backend (OpenTelemetry or Langfuse) when configured, and to the console in development; no user content is logged unless the user opts in
- [ ] **OBS-03**: The "How this was generated" panel shows the per-step timing waterfall from the trace

## v2 Requirements

- **AGENT-V2-01**: Interview prep and STAR stories as additional agent tools
- **DOC-V2-01**: LinkedIn profile PDF import into the structured profile
- **LEVAL-V2-01**: Online eval sampling from opt-in production runs

## Out of Scope

| Feature | Reason |
|---------|--------|
| Hosted vector database | Local-first vault, small corpus; IndexedDB + cosine is sufficient |
| Queues / async workers | Runs are single bounded requests |
| OCR for scanned resumes | Rare in practice |
| Recommendation systems / show-off model training | Only honest, measured ML |
| Accounts / server-side profiles | Breaks privacy promise |
| Auto-apply, logged-in scraping | Ethics and ToS |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| REVAL-01 | Phase 1 | Pending |
| REVAL-02 | Phase 1 | Pending |
| REVAL-03 | Phase 1 | Pending |
| REVAL-04 | Phase 1 | Pending |
| RERANK-01 | Phase 2 | Pending |
| RERANK-02 | Phase 2 | Pending |
| RERANK-03 | Phase 2 | Pending |
| LEVAL-01 | Phase 3 | Pending |
| LEVAL-02 | Phase 3 | Pending |
| LEVAL-03 | Phase 3 | Pending |
| LEVAL-04 | Phase 3 | Pending |
| LEVAL-05 | Phase 3 | Pending |
| LEVAL-06 | Phase 3 | Pending |
| AGENT-01 | Phase 4 | Pending |
| AGENT-02 | Phase 4 | Pending |
| AGENT-03 | Phase 4 | Pending |
| AGENT-04 | Phase 4 | Pending |
| AGENT-05 | Phase 4 | Pending |
| AGENT-06 | Phase 4 | Pending |
| DOC-01 | Phase 5 | Pending |
| DOC-02 | Phase 5 | Pending |
| DOC-03 | Phase 5 | Pending |
| DOC-04 | Phase 5 | Pending |
| OBS-01 | Phase 6 | Pending |
| OBS-02 | Phase 6 | Pending |
| OBS-03 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0

---
*Requirements defined: 2026-10-31*
*Last updated: 2026-10-31 after roadmap creation*
