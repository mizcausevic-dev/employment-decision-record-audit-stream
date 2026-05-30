# employment-decision-record-audit-stream

> **Employment Decision Record Audit Stream v0.1 draft.** Per-hiring / promotion / performance / termination AI-tool-access events, hash-chained and signed, designed to bridge HR-system semantics (Workday + UKG + Greenhouse + Lever + iCIMS) to the Kinetic Gain Protocol Suite audit-stream spine. The Operator surface that lets an employer's HRIS + ATS + vendor AI tool emit Suite-compliant audit events covering the four primary employment-AI decision surfaces — hiring (sourcing / screening / interview-scoring / offer), promotion, performance evaluation, termination — under one schema with kind enum branching.

Part of the [Kinetic Gain Protocol Suite](https://suite.kineticgain.com). Opens the **HR Tech / Employment AI** vertical alongside the existing HealthTech, EdTech, PropTech, and InsurTech 6-packs.

> Status: v0.1 draft. Schema at [`schema/employment-decision-event.schema.json`](./schema/employment-decision-event.schema.json), Node verifier at [`src/verify.mjs`](./src/verify.mjs), canonical example at [`examples/momentumhr-hiring-2026q4/`](./examples/momentumhr-hiring-2026q4/).

## Why this exists

NYC Local Law 144 took effect July 5, 2023 and enforcement began. Employers using an **Automated Employment Decision Tool (AEDT)** that substantially assists or replaces discretionary decision-making for candidates / employees in NYC must: (1) commission an independent bias audit annually; (2) publish a summary of bias-audit results on the careers site; (3) provide candidates 10 business days' notice that an AEDT will be used + the job-qualifications-and-characteristics it assesses + how to request an alternative selection process. Illinois AI Video Interview Act (820 ILCS 42/) governs video-interview AI. Maryland HB 1202 governs facial recognition in hiring. **EEOC AI Guidance (May 2023)** + ADA + Section 504 + Title VII + ADEA + GINA + OFCCP-federal-contractor obligations form the federal floor.

What's missing is a uniform audit-stream that names *which AI tool read which HR resource at which timestamp under which regulatory basis under which buyer-published Decision Card* — provable to an EEOC investigator, a NYC Department of Consumer and Worker Protection examiner, an OFCCP compliance officer, a state civil-rights agency, or a plaintiff's-side employment attorney without forcing the employer to rebuild its HRIS or the vendor to abandon its data model.

This repo defines the schema + verifier for that stream.

## Two distinct invariants

Most prior Suite audit streams enforce one human-in-loop invariant. The HR Tech audit stream enforces two, because NYC LL 144 adds an orthogonal candidate-notice obligation:

**Invariant 1: human-hiring-decision required.** Any event whose `kind` is in the adverse-action-capable set AND whose `ai_recommendation.recommendation` is in `{decline, do-not-promote, performance-below, terminate-recommended}` MUST set `ai_recommendation.human_hiring_decision_required = true`. The verifier exits **3** when violated.

**Invariant 2: NYC LL 144 candidate-notice provided.** Any event where `agent.is_aedt_per_nyc_ll_144 = true` AND `kind` is in the external-candidate-facing set MUST set `candidate_notice_provided.notice_provided = true`. The verifier exits **4** when violated.

## The shape

| Field group | Purpose |
| --- | --- |
| `event_id`, `timestamp`, `kind` | Append-only identity (14-kind taxonomy across hiring + promotion + performance + termination + accommodation-request + deletion) |
| `source` | Emitting system (HRIS, ATS, vendor AI tool) |
| `subject_ref` | **Tokenized** candidate / employee ID — raw SSN, name, DOB, email, social handle MUST NOT appear |
| `subject_role_context` | external-candidate / internal-candidate / current-employee / contingent-worker / departing-employee |
| `resource` | 18-type resource taxonomy (resume / cover-letter / application / video-interview recording or transcript / assessment / background check / credit check / social-media scrape / reference check / performance review / compensation history / time-and-attendance / workforce-planning projection / adverse-action notice / reasonable-accommodation request) + tokenized ID + logical fields accessed |
| `agent` | AI tool card URL, Decision Card URL, **`is_aedt_per_nyc_ll_144`** flag (the AEDT-or-not distinction is the LL 144 trigger), optional principal (recruiter / hiring manager / HRBP) |
| `regulatory_basis` | 15-doctrine taxonomy spanning federal (Title VII, ADA, Section 504, ADEA, GINA, OFCCP, EEOC AI Guidance) + state (NYC LL 144, IL AI Video Interview Act, MD HB 1202, CA AB 331, CO AI Act) + consent + judicial-order |
| `records_of_disclosure_status` | NYC LL 144 bias-audit record + 29 CFR §1602 EEOC recordkeeping log |
| `candidate_notice_provided` | OPTIONAL — required by invariant 2 when AEDT + external-candidate-facing kind |
| `ai_recommendation` | OPTIONAL — recommendation, reason codes, model version, **`human_hiring_decision_required`** invariant |
| `accommodation_pathway` | OPTIONAL — present on accommodation-request-evaluated events; ADA reasonable-accommodation traceability |
| `signature` | Optional ed25519 |
| `prev_hash`, `hash` | Hash chain (SHA-256 over canonical JSON of event minus `hash`) |

## Verifier exit codes

| Code | Meaning |
| --- | --- |
| 0 | All events valid + chain intact + both invariants preserved |
| 1 | Schema validation failed |
| 2 | Chain validation failed |
| 3 | human-hiring-decision invariant violated |
| 4 | NYC LL 144 candidate-notice invariant violated |
| 5 | Usage / IO error |

## Canonical example

[`examples/momentumhr-hiring-2026q4/source.json`](./examples/momentumhr-hiring-2026q4/source.json) — three events from MomentumHR Inc.'s 2026 Q4 stream:

1. **`employment.hiring.resume-screened`** — VendorE HireAssess v2.x reads four tokenized resume fields for `req-2026-1843` (Senior Backend Engineer). AEDT flag = true. NYC LL 144 candidate notice provided + alternative-selection-process offered. Candidate name / email / phone / address / DOB redacted before reaching the model.
2. **`employment.hiring.recommendation-produced`** — VendorE recommends `advance-with-followup` with model_confidence 0.78 + `human_hiring_decision_required: true`. (NOT a final decision.)
3. **`employment.hiring.adverse-action-evaluated`** — MomentumHR's human hiring manager issues the decline notice under EEOC AI Guidance + Title VII disparate-impact framework, after the structured-interview round. (Demonstrates the AI's `advance-with-followup` recommendation correctly deferred to human judgment.)

## Quick start

```bash
npm install
npm run build:examples
npm run verify
```

## Composes with

| Repo | Role |
| --- | --- |
| [`evidence-bundle-spec`](https://github.com/mizcausevic-dev/evidence-bundle-spec) | Underlying audit-stream conventions |
| [`fhir-resource-access-audit`](https://github.com/mizcausevic-dev/fhir-resource-access-audit) | Sibling HealthTech audit-stream |
| [`student-data-access-audit-stream`](https://github.com/mizcausevic-dev/student-data-access-audit-stream) | Sibling EdTech audit-stream |
| [`mortgage-decision-record-audit-stream`](https://github.com/mizcausevic-dev/mortgage-decision-record-audit-stream) | Sibling PropTech audit-stream |
| [`insurance-decision-record-audit-stream`](https://github.com/mizcausevic-dev/insurance-decision-record-audit-stream) | Sibling InsurTech audit-stream |

## Compliance posture

HR-Tech-readiness scaffolding for EEOC AI Guidance (May 2023) governance + recordkeeping, Title VII / ADA / Section 504 / ADEA / GINA federal-floor recordkeeping, OFCCP federal-contractor recordkeeping (where applicable), NYC Local Law 144 AEDT bias-audit + candidate-notice data sourcing, Illinois AI Video Interview Act recordkeeping, Maryland HB 1202 facial-recognition disclosure, and emerging state employment-AI laws. The schema + verifier support an employer's program toward those expectations but do not by themselves establish compliance with any of them. Per the standing public-language guardrail: *readiness · evidence · posture · controls · scaffolding* — never "EEOC-compliant" or "NYC-LL-144-attested" without an external attestation (NYC LL 144 attestation specifically requires an independent third-party bias auditor).

## License

MIT — see [`LICENSE`](./LICENSE).
