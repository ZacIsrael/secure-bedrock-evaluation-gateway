// Use Node's built-in assertions and test runner.
import assert from "node:assert/strict";
import { test } from "node:test";

// Test the same event builder that the gateway uses for CloudWatch.
import { classificationSucceededEvent } from "./operational-event.js";

// Check that an event contains only its approved top-level fields.
// Extra properties must not appear even if passed at runtime.
test("operational events exclude ticket text, response text, and credentials", () => {
  // Supply recognizable sensitive values alongside legitimate event fields.
  // The cast deliberately bypasses TypeScript's extra-property check.
  const message = classificationSucceededEvent({
    promptId: "support-ticket-classification-v2",
    modelId: "amazon.nova-micro-v1:0",
    evidenceKey: "artifacts/synthetic.json",
    latencyMs: 120,
    usage: { inputTokens: 30, outputTokens: 12, totalTokens: 42 },
    ticket: "SECRET_TICKET",
    summary: "SECRET_SUMMARY",
    jwt: "SECRET_TOKEN",
  } as Parameters<typeof classificationSucceededEvent>[0]);

  // Verify the serialized event exposes exactly the intended field names.
  assert.deepEqual(Object.keys(JSON.parse(message)), [
    "event",
    "promptId",
    "modelId",
    "evidenceKey",
    "latencyMs",
    "usage",
  ]);

  // Verify none of the recognizable sensitive values reached the log message.
  assert.equal(message.includes("SECRET_TICKET"), false);
  assert.equal(message.includes("SECRET_SUMMARY"), false);
  assert.equal(message.includes("SECRET_TOKEN"), false);
});