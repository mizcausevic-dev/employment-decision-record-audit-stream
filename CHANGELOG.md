# Changelog

## [0.1] — 2026-05-29

### Added

- Initial draft event schema (`schema/employment-decision-event.schema.json`).
- 14-kind event taxonomy spanning hiring + promotion + performance + termination + accommodation-request-evaluated + deletion-requested.
- 5-context subject_role_context (external-candidate / internal-candidate / current-employee / contingent-worker / departing-employee).
- 18-type resource taxonomy mapped to common HR artifacts (resume, cover-letter, application, video-interview recording + transcript, asynchronous interview, assessment, background-check, credit-check, social-media scrape, reference-check, performance review, compensation history, time-and-attendance, workforce-planning projection, adverse-action notice, reasonable-accommodation request).
- 15-doctrine `regulatory_basis` taxonomy: federal (Title VII, ADA, Section 504, ADEA, GINA, OFCCP, EEOC AI Guidance) + state (NYC LL 144, IL AI Video Interview Act, MD HB 1202, CA AB 331, CO AI Act) + consent + judicial-order.
- `agent.is_aedt_per_nyc_ll_144` boolean — the AEDT-or-not distinction that triggers LL 144 obligations.
- C/R/U/D/E action codes + 0/4/8/12 outcome codes (mirrors sibling audit streams across the five-vertical Suite).
- **Two distinct invariants**: human-hiring-decision-required (exit 3) AND NYC LL 144 candidate-notice-provided (exit 4). The NYC LL 144 invariant is orthogonal to human-in-loop; it captures the candidate-notice obligation that exists independently of whether the AI's recommendation is adverse.
- `accommodation_pathway` block for ADA reasonable-accommodation traceability.
- Hash chain conventions (SHA-256 over canonical JSON of event minus `hash`).
- Node verifier with 5 distinct exit codes (schema 1 / chain 2 / human-in-loop 3 / NYC LL 144 candidate-notice 4 / IO 5).
- Example builder.
- Canonical example: MomentumHR Inc. 2026 Q4 hiring stream — VendorE HireAssess v2.x resume-screened + recommendation + human-hiring-manager decline-notice sequence for a Senior Backend Engineer req.
- CI workflow.

### Not yet

- Promotion + performance + termination example streams.
- Reasonable-accommodation-pathway worked example.
- Cross-state regulatory-basis overlap reconciliation (e.g. when NYC LL 144 + IL AI Video Interview Act both apply).
- Optional Rust + Go verifiers (planned).
