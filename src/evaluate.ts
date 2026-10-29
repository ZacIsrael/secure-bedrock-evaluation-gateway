// Run the 20 frozen support tickets through the authorized gateway client.
// Save each response and its initial scores for prompt comparison and review.

import { readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { SpiffeClient } from "@jeengbe/spiffe";

// Define the ticket and private expected answers stored in each frozen case.
type EvaluationCase = {
  id: string;
  ticket: string;
  expectedCategory: string;
  expectedUrgency: string;
  requiredSummaryFacts: string[];
};

// Describe the successful classification and metrics returned by the gateway.
type GatewayResult = {
  id: string;
  promptId: string;
  modelId: string;
  output: {
    category: string;
    urgency: string;
    summary: string;
  };
  latencyMs: number;
  usage: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
};

// Require an explicit prompt ID so results cannot be mislabeled as v1 or v2.
const promptId = process.env.EVAL_PROMPT_ID;
if (
  promptId !== "support-ticket-classification-v1" &&
  promptId !== "support-ticket-classification-v2"
) {
  throw new Error("Set EVAL_PROMPT_ID to the frozen v1 or v2 prompt ID");
}

// Read the frozen cases mounted into the client container by Compose.
// Ignore blank lines so a trailing newline does not create an empty case.
const lines = (await readFile("eval/cases/frozen-evaluation.jsonl", "utf8"))
  .split(/\r?\n/)
  .filter((line) => line.trim());

// Parse each JSONL line into one ticket and its expected evaluation answers.
const cases = lines.map((line) => JSON.parse(line) as EvaluationCase);

// Stop if the dataset has changed size or contains duplicate case IDs.
// Both prompt versions must be evaluated against the same 20 distinct cases.
if (cases.length !== 20 || new Set(cases.map((item) => item.id)).size !== 20) {
  throw new Error("Expected exactly 20 uniquely identified frozen cases");
}

// Connect to the SPIRE Workload API and check this container's identity.
// The evaluator must run as the authorized client workload.
const spiffe = new SpiffeClient();
const ownId = await spiffe.getSpiffeId();
if (ownId !== "spiffe://secure-bedrock-evaluation-gateway.local/client") {
  throw new Error(`Unexpected evaluator identity: ${ownId}`);
}

// Confirm this client can reach and authenticate with the gateway.
// Stop before the evaluation if SPIRE identity or authorization is broken.
const authToken = await spiffe.getJwt("bedrock-evaluation-gateway");
const authCheck = await fetch("http://gateway:8080/authorize", {
  method: "POST",
  headers: { authorization: `Bearer ${authToken}` },
});

if (authCheck.status !== 200) {
  throw new Error(
    `Gateway authorization check failed: HTTP ${authCheck.status}`
  );
}

// Collect one result per case before writing the run to a local JSON file.
const results = [];

for (const item of cases) {
  // Obtain a JWT-SVID whose audience is the gateway.
  // Request it for each case so a long run does not reuse an expired token.
  const token = await spiffe.getJwt("bedrock-evaluation-gateway");

  // Measure the full client-to-gateway request, including network time.
  const startedAt = performance.now();

  try {
    // Send only the case ID and ticket; expected answers stay in this process.
    // Abort a request that takes longer than 60 seconds.
    const response = await fetch("http://gateway:8080/tickets", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ id: item.id, ticket: item.ticket }),
      signal: AbortSignal.timeout(60_000),
    });

    const elapsedMs = Math.round(performance.now() - startedAt);

    // Record an unsuccessful gateway response without treating it as a score.
    // The gateway does not return a classification for these responses.
    if (!response.ok) {
      results.push({
        id: item.id,
        httpStatus: response.status,
        elapsedMs,
        schemaValid: false,
        categoryCorrect: false,
        urgencyCorrect: false,
        summaryFactual: null,
        error: "Gateway did not return a valid classification",
      });
      console.log(`${item.id}: HTTP ${response.status}`);
      continue;
    }

    // Read the classification, model ID, latency, and token usage.
    const result = (await response.json()) as GatewayResult;

    // Stop if this response belongs to another case or prompt version.
    // Mixing v1 and v2 results would invalidate the comparison.
    if (result.id !== item.id || result.promptId !== promptId) {
      throw new Error(`Case or prompt mismatch for ${item.id}; stopping run`);
    }

    // HTTP 200 means the gateway accepted the model output's JSON shape.
    // Compare labels here, where the expected answers are available.
    results.push({
      id: item.id,
      httpStatus: response.status,
      elapsedMs,
      schemaValid: true,
      categoryCorrect: result.output.category === item.expectedCategory,
      urgencyCorrect: result.output.urgency === item.expectedUrgency,

      // Summary factuality needs a separate review against the ticket.
      // Leave it unset rather than guessing from matching words.
      summaryFactual: null,

      // Keep these reference answers in the local evaluation result.
      // They are never included in the gateway request.
      expectedCategory: item.expectedCategory,
      expectedUrgency: item.expectedUrgency,
      requiredSummaryFacts: item.requiredSummaryFacts,

      // Preserve the response and measurements for later comparison.
      modelId: result.modelId,
      output: result.output,
      gatewayLatencyMs: result.latencyMs,
      usage: result.usage,
    });

    console.log(`${item.id}: HTTP 200`);
  } catch (error) {
    // A case or prompt mismatch makes the run untrustworthy, so stop it.
    if (error instanceof Error && error.message.includes("mismatch")) {
      throw error;
    }

    // Record transport, timeout, or response-parsing failures by case.
    // This runner does not retry requests automatically.
    results.push({
      id: item.id,
      httpStatus: null,
      elapsedMs: Math.round(performance.now() - startedAt),
      schemaValid: false,
      categoryCorrect: false,
      urgencyCorrect: false,
      summaryFactual: null,
      error: error instanceof Error ? error.name : "UnknownError",
    });
    console.log(`${item.id}: request failed`);
  }
}

// Write results to the client container's mounted local results directory.
// The prompt ID in the filename keeps the two runs separate.
const outputPath = `eval/results/${promptId}.json`;
await writeFile(
  outputPath,
  JSON.stringify(
    {
      promptId,
      evaluatorIdentity: ownId,
      evaluatedAt: new Date().toISOString(),
      caseCount: cases.length,
      retries: 0,
      results,
    },
    null,
    2
  ) + "\n"
);

console.log(`Saved ${results.length} case results to ${outputPath}`);
