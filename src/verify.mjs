#!/usr/bin/env node
// verify.mjs — Employment Decision Record Audit Stream verifier.
//
// Verifies an NDJSON stream of employment-decision-event records:
//  1. Every record validates against schema/employment-decision-event.schema.json.
//  2. The hash chain is intact (canonical-JSON SHA-256, prev_hash chained).
//  3. Human-hiring-decision invariant: any event whose recommendation could
//     trigger an adverse employment action MUST set human_hiring_decision_required = true.
//  4. NYC LL 144 candidate-notice invariant: for events where
//     agent.is_aedt_per_nyc_ll_144 = true AND kind is in an external-candidate-
//     facing set, candidate_notice_provided.notice_provided MUST be true.
//
// Exit codes:
//   0 — all events valid + chain intact + invariants preserved
//   1 — schema validation failed
//   2 — chain validation failed
//   3 — human-hiring-decision invariant violated
//   4 — NYC LL 144 candidate-notice invariant violated
//   5 — usage / IO error

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const ZERO_HASH = "0".repeat(64);

const ADVERSE_ACTION_CAPABLE_KINDS = new Set([
  "employment.hiring.recommendation-produced",
  "employment.promotion.recommendation-produced",
  "employment.performance.recommendation-produced",
  "employment.termination.recommendation-produced",
  "employment.hiring.video-interview-scored",
  "employment.hiring.assessment-scored"
]);

const ADVERSE_ACTION_CAPABLE_RECOMMENDATIONS = new Set([
  "decline",
  "do-not-promote",
  "performance-below",
  "terminate-recommended"
]);

const EXTERNAL_CANDIDATE_FACING_KINDS = new Set([
  "employment.hiring.sourcing-ranked",
  "employment.hiring.resume-screened",
  "employment.hiring.video-interview-scored",
  "employment.hiring.assessment-scored",
  "employment.hiring.recommendation-produced",
  "employment.hiring.adverse-action-evaluated"
]);

function canonicalize(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalize).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalize(value[k])).join(",") + "}";
}

function sha256Hex(s) { return createHash("sha256").update(s, "utf8").digest("hex"); }
function loadJson(path) { return JSON.parse(readFileSync(path, "utf8")); }

function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1) {
    console.error("usage: node src/verify.mjs <events.ndjson>");
    process.exit(5);
  }

  const schema = loadJson(new URL("../schema/employment-decision-event.schema.json", import.meta.url));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  const raw = readFileSync(args[0], "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== "");
  const events = lines.map((l, i) => {
    try { return JSON.parse(l); }
    catch (e) { console.error(`event ${i}: not valid JSON — ${e.message}`); process.exit(1); }
  });

  let schemaErrors = 0;
  for (const [i, ev] of events.entries()) {
    if (!validate(ev)) {
      schemaErrors++;
      console.error(`event ${i} (${ev.event_id ?? "?"}): schema errors`);
      for (const e of validate.errors ?? []) {
        console.error(`  - ${e.instancePath || "/"} ${e.message}`);
      }
    }
  }
  if (schemaErrors > 0) {
    console.error(`schema validation failed: ${schemaErrors}/${events.length} events failed`);
    process.exit(1);
  }

  let chainErrors = 0;
  for (const [i, ev] of events.entries()) {
    const expectedPrev = i === 0 ? ZERO_HASH : events[i - 1].hash;
    if (ev.prev_hash !== expectedPrev) {
      chainErrors++;
      console.error(`event ${i} (${ev.event_id}): prev_hash mismatch (expected ${expectedPrev.slice(0, 16)}…, got ${ev.prev_hash.slice(0, 16)}…)`);
      continue;
    }
    const { hash, ...rest } = ev;
    const recomputed = sha256Hex(canonicalize(rest));
    if (hash !== recomputed) {
      chainErrors++;
      console.error(`event ${i} (${ev.event_id}): hash mismatch (expected ${recomputed.slice(0, 16)}…, got ${hash.slice(0, 16)}…)`);
    }
  }
  if (chainErrors > 0) {
    console.error(`chain validation failed: ${chainErrors}/${events.length} events broken`);
    process.exit(2);
  }

  let humanInLoopErrors = 0;
  for (const [i, ev] of events.entries()) {
    if (!ADVERSE_ACTION_CAPABLE_KINDS.has(ev.kind)) continue;
    if (!ev.ai_recommendation) continue;
    const rec = ev.ai_recommendation.recommendation;
    if (!ADVERSE_ACTION_CAPABLE_RECOMMENDATIONS.has(rec)) continue;
    if (ev.ai_recommendation.human_hiring_decision_required !== true) {
      humanInLoopErrors++;
      console.error(`event ${i} (${ev.event_id}): recommendation=${rec} on kind=${ev.kind} requires human_hiring_decision_required=true (EEOC AI Guidance + NYC LL 144 + state-AI-law expectation — no autonomous adverse employment action)`);
    }
  }
  if (humanInLoopErrors > 0) {
    console.error(`human-hiring-decision invariant violated: ${humanInLoopErrors} event(s)`);
    process.exit(3);
  }

  let noticeErrors = 0;
  for (const [i, ev] of events.entries()) {
    if (!ev.agent?.is_aedt_per_nyc_ll_144) continue;
    if (!EXTERNAL_CANDIDATE_FACING_KINDS.has(ev.kind)) continue;
    if (!ev.candidate_notice_provided?.notice_provided) {
      noticeErrors++;
      console.error(`event ${i} (${ev.event_id}): NYC LL 144 AEDT in-scope event missing candidate_notice_provided.notice_provided=true (NYC LL 144 §20-871(b) ten-business-day candidate notice)`);
    }
  }
  if (noticeErrors > 0) {
    console.error(`NYC LL 144 candidate-notice invariant violated: ${noticeErrors} event(s)`);
    process.exit(4);
  }

  console.log(`OK — ${events.length} events validated, chain intact, human-in-loop + NYC LL 144 candidate-notice invariants preserved.`);
}

main();
