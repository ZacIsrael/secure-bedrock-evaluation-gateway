// Create the HTTP server that receives authorized gateway requests.
import { createServer } from "node:http";

// Use the SPIRE Workload API to identify this process and validate client JWTs.
import { SpiffeClient } from "@jeengbe/spiffe";

// Load the local AWS profile and exchange its credentials for gateway-role credentials.
import {
  fromIni,
  fromTemporaryCredentials,
} from "@aws-sdk/credential-providers";

// Send a non-streaming classification request through the assumed gateway role.
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";

// Send operational events to the log stream created by Terraform.
import {
  CloudWatchLogsClient,
  PutLogEventsCommand,
} from "@aws-sdk/client-cloudwatch-logs";

// Build a bounded event without sending ticket or model text to CloudWatch.
import { classificationSucceededEvent } from "./operational-event.js";

// Read the frozen prompt text when the gateway starts.
import { readFile } from "node:fs/promises";
// Use the S3 SDK to write validated evaluation results to the evidence bucket.
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// Generate a unique object key for each saved classification.
import { randomUUID } from "node:crypto";

// Define the exact workload identities and JWT audience this gateway accepts.
const trustDomain = "secure-bedrock-evaluation-gateway.local";
const gatewayId = `spiffe://${trustDomain}/gateway`;
const allowedClientId = `spiffe://${trustDomain}/client`;
const audience = "bedrock-evaluation-gateway";
const spiffe = new SpiffeClient();

// Refuse to serve requests if SPIRE assigned this process the wrong identity.
const ownId = await spiffe.getSpiffeId();
if (ownId !== gatewayId) {
  throw new Error(`Gateway received unexpected SPIFFE identity: ${ownId}`);
}

// Read deployment settings supplied to the gateway container by Compose.
const region = process.env.AWS_REGION;
const roleArn = process.env.GATEWAY_ROLE_ARN;
const credentialsFile = process.env.AWS_SHARED_CREDENTIALS_FILE;

// Stop startup rather than falling back to an unintended AWS configuration.
if (!region || !roleArn || !credentialsFile) {
  throw new Error("Gateway AWS configuration is incomplete");
}

// Use the mounted IAM user profile only to assume the gateway IAM role.
// The provider refreshes the role's temporary credentials when needed.
const roleCredentials = fromTemporaryCredentials({
  masterCredentials: fromIni({
    profile: process.env.AWS_PROFILE ?? "default",
    filepath: credentialsFile,
  }),
  clientConfig: { region },
  params: {
    RoleArn: roleArn,
    RoleSessionName: "gateway-runtime",
  },
});

// Verify role assumption before the gateway begins accepting requests.
await roleCredentials();

// Give Bedrock the temporary gateway-role credentials, not the IAM user profile.
const bedrock = new BedrockRuntimeClient({
  region,
  credentials: roleCredentials,
});

// Give S3 the temporary gateway-role credentials used by Bedrock.
// The bucket name and object key will be supplied when saving a result.
const s3 = new S3Client({
  region,
  credentials: roleCredentials,
});

// Reuse the assumed gateway role for CloudWatch Logs writes.
const cloudWatchLogs = new CloudWatchLogsClient({
  region,
  credentials: roleCredentials,
});

// Accept only the two frozen prompt configurations.
const promptId = process.env.PROMPT_ID ?? "support-ticket-classification-v2";
if (
  promptId !== "support-ticket-classification-v1" &&
  promptId !== "support-ticket-classification-v2"
) {
  throw new Error(`Unsupported PROMPT_ID: ${promptId}`);
}

const modelId = process.env.BEDROCK_MODEL_ID;
if (!modelId) {
  throw new Error("BEDROCK_MODEL_ID is required");
}

// Require the deployed evidence bucket before accepting ticket requests.
const evidenceBucketName = process.env.EVIDENCE_BUCKET_NAME;
if (!evidenceBucketName) {
  throw new Error("EVIDENCE_BUCKET_NAME is required");
}

// Require the deployed log group; its stream is named gateway in logs.tf.
const logGroupName = process.env.CLOUDWATCH_LOG_GROUP_NAME;
if (!logGroupName) {
  throw new Error("CLOUDWATCH_LOG_GROUP_NAME is required");
}

// Load the selected prompt from the versioned files in the image.
const systemPrompt = (
  await readFile(
    new URL(`../eval/prompts/${promptId}.txt`, import.meta.url),
    "utf8"
  )
).trim();

createServer(async (request, response) => {
  // Accept only the two POST endpoints implemented by this gateway.
  if (
    request.method !== "POST" ||
    (request.url !== "/authorize" && request.url !== "/tickets")
  ) {
    response.writeHead(404).end();
    return;
  }

  // Read the caller's JWT-SVID from the Authorization header.
  const authorization = request.headers.authorization;
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : undefined;

  // Reject requests that provide no bearer token.
  if (!token) {
    response.writeHead(401).end("Missing bearer token\n");
    return;
  }

  try {
    // Ask SPIRE to validate the JWT for this gateway's audience.
    const identity = await spiffe.validateJwt(audience, token);

    // A token without a validated workload identity cannot proceed.
    if (!identity) {
      response.writeHead(401).end("Invalid identity\n");
      return;
    }

    // Permit only the registered client workload to call this gateway.
    if (identity.spiffeId !== allowedClientId) {
      response.writeHead(403).end("Identity not authorized\n");
      return;
    }

    // Let the client check authorization without submitting a ticket.
    if (request.url === "/authorize") {
      response.writeHead(200).end("Client authorized\n");
      return;
    }

    // Read ticket data after authorization and cap the request at 4 KiB.
    let body = "";
    for await (const chunk of request) {
      body += chunk.toString();
      if (Buffer.byteLength(body, "utf8") > 4096) {
        response.writeHead(413).end("Ticket request too large\n");
        return;
      }
    }

    // Return a client error if the request body is not valid JSON.
    let input: unknown;
    try {
      input = JSON.parse(body);
    } catch {
      response.writeHead(400).end("Invalid JSON\n");
      return;
    }

    // Require a bounded case ID and a nonempty ticket string.
    if (
      typeof input !== "object" ||
      input === null ||
      !("id" in input) ||
      typeof input.id !== "string" ||
      input.id.length === 0 ||
      input.id.length > 64 ||
      !("ticket" in input) ||
      typeof input.ticket !== "string" ||
      input.ticket.trim().length === 0
    ) {
      response.writeHead(400).end("Expected an id and ticket string\n");
      return;
    }

    // Send only the ticket text to the model; expected evaluation answers stay private.
    const startedAt = performance.now();

    let phase = "invoke";
    try {
      const result = await bedrock.send(
        new ConverseCommand({
          modelId,
          system: [{ text: systemPrompt }],
          messages: [
            {
              role: "user",
              content: [{ text: `Support ticket:\n${input.ticket}` }],
            },
          ],
          inferenceConfig: {
            maxTokens: 160,
            temperature: 0,
          },
        })
      );

      phase = "extract";

      // Extract model text without returning the request or AWS credentials.
      const modelText = result.output?.message?.content
        ?.map((block) => block.text ?? "")
        .join("")
        .trim();

      if (!modelText) {
        throw new Error("Bedrock returned no text");
      }

      phase = "parse";

      // Validate the model's JSON before treating it as a classification.
      const output: unknown = JSON.parse(modelText);

      phase = "validate";
      if (typeof output !== "object" || output === null) {
        throw new Error("Model output is not an object");
      }

      const fields = output as Record<string, unknown>;
      const keys = Object.keys(fields).sort();
      const summary = fields.summary;

      if (keys.join(",") !== "category,summary,urgency") {
        throw new Error("unexpected_fields");
      }
      if (
        typeof fields.category !== "string" ||
        !["billing", "technical", "account", "other"].includes(fields.category)
      ) {
        throw new Error("invalid_category");
      }
      if (
        typeof fields.urgency !== "string" ||
        !["normal", "high"].includes(fields.urgency)
      ) {
        throw new Error("invalid_urgency");
      }
      if (
        typeof summary !== "string" ||
        !summary.trim() ||
        summary.trim().split(/\s+/).length > 40
      ) {
        throw new Error("invalid_summary");
      }

      // Build the evidence from validated fields and invocation metrics.
      // Do not store the raw ticket, JWT, or unvalidated model response.
      const evidence = {
        promptId,
        modelId,
        output: {
          category: fields.category,
          urgency: fields.urgency,
          summary: summary.trim(),
        },
        latencyMs:
          result.metrics?.latencyMs ??
          Math.round(performance.now() - startedAt),
        usage: {
          inputTokens: result.usage?.inputTokens,
          outputTokens: result.usage?.outputTokens,
          totalTokens: result.usage?.totalTokens,
        },
      };

      // Mark S3 persistence as the current stage for failure logging.
      phase = "persist";

      // Reuse this key in the CloudWatch event to identify the saved object.
      const evidenceKey = `artifacts/${randomUUID()}.json`;

      // Wait for S3 to confirm the evidence write before proceeding.
      await s3.send(
        new PutObjectCommand({
          Bucket: evidenceBucketName,
          Key: evidenceKey,
          Body: JSON.stringify(evidence),
          ContentType: "application/json",
        })
      );

      // Record completion without copying the ticket or classification summary.
      // Wait for CloudWatch before reporting success to the client.
      phase = "log";
      const logResult = await cloudWatchLogs.send(
        new PutLogEventsCommand({
          logGroupName,
          logStreamName: "gateway",
          logEvents: [
            {
              timestamp: Date.now(),
              message: classificationSucceededEvent({
                promptId,
                modelId,
                evidenceKey,
                latencyMs: evidence.latencyMs,
                usage: evidence.usage,
              }),
            },
          ],
        })
      );

      // A successful API call can still report that an event was rejected.
      if (logResult.rejectedLogEventsInfo) {
        throw new Error("CloudWatch rejected the gateway event");
      }

      // Return the synthetic case result and invocation metrics, not the ticket.
      response.writeHead(200, { "content-type": "application/json" }).end(
        JSON.stringify({
          id: input.id,
          promptId,
          modelId,
          output: {
            category: fields.category,
            urgency: fields.urgency,
            summary: summary.trim(),
          },
          latencyMs:
            result.metrics?.latencyMs ??
            Math.round(performance.now() - startedAt),
          usage: {
            inputTokens: result.usage?.inputTokens,
            outputTokens: result.usage?.outputTokens,
            totalTokens: result.usage?.totalTokens,
          },
        })
      );
    } catch (error) {
      // Record the failed stage without logging ticket or model text.
      console.error("Gateway classification or evidence delivery failed:", {
        phase,
        name: error instanceof Error ? error.name : "UnknownError",
        httpStatus:
          typeof error === "object" && error !== null && "$metadata" in error
            ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata
                ?.httpStatusCode
            : undefined,
        reason:
          phase === "validate" && error instanceof Error
            ? error.message
            : undefined,
      });
      response.writeHead(502).end("Classification unavailable\n");
    }
  } catch (error) {
    // Keep validation or request-handling failures from succeeding silently.
    console.error("Gateway request failed:", error);
    response.writeHead(503).end("Gateway unavailable\n");
  }
}).listen(8080, "0.0.0.0", () => {
  // Log the gateway identity once the HTTP server is accepting requests.
  console.log(`Gateway ready as ${gatewayId}`);
});
