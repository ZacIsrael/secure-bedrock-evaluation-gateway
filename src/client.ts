// The purpose of this file is to send one synthetic development ticket through the gateway.
// It gets its identity from SPIRE, while AWS credentials stay in the gateway.

import { readFile } from "node:fs/promises";
import { SpiffeClient } from "@jeengbe/spiffe";
import { gatewayPost } from "./gateway-request.js";

// The client sends ticket data, but keeps any expected answer out of the request.
type DevelopmentCase = {
  id: string;
  ticket: string;
};

// Read the development cases packaged with the client container.
const casesPath = "eval/cases/development.jsonl";

// Select the first nonempty JSONL line for this single-request smoke test.
// The full evaluation runner handles the separate set of 20 frozen cases.
const firstLine = (await readFile(casesPath, "utf8"))
  .split(/\r?\n/)
  .find((line) => line.trim().length > 0);

// Stop before contacting SPIRE or Bedrock if there is no ticket to submit.
if (!firstLine) {
  throw new Error("No development cases found");
}

// Parse into unknown first so the file's fields must be checked explicitly.
const parsed: unknown = JSON.parse(firstLine);

// Require the case ID and ticket text used by the gateway request.
// Other fields, including expected answers, are not sent to the gateway.
if (
  typeof parsed !== "object" ||
  parsed === null ||
  !("id" in parsed) ||
  typeof parsed.id !== "string" ||
  !("ticket" in parsed) ||
  typeof parsed.ticket !== "string"
) {
  throw new Error("Development case must contain an ID and ticket");
}

// Construct a request containing only the fields the gateway needs.
const developmentCase: DevelopmentCase = {
  id: parsed.id,
  ticket: parsed.ticket,
};

// Connect to the local SPIRE Workload API through the mounted agent socket.
const spiffe = new SpiffeClient();

// Obtain this workload's SPIFFE ID and a JWT intended for the gateway.
// The HTTPS helper separately obtains an X.509-SVID for the mTLS connection.
const ownId = await spiffe.getSpiffeId();
const token = await spiffe.getJwt("bedrock-evaluation-gateway");

// Present the SPIRE-issued client certificate and send the JWT with the ticket.
// The helper verifies the gateway's certificate chain and SPIFFE ID.
const response = await gatewayPost(spiffe, "/tickets", token, developmentCase);

// Print the result of this synthetic request so the smoke test is reviewable.
console.log(`${ownId}: HTTP ${response.status} ${response.body}`);

// Treat anything other than a completed classification as a failed smoke test.
if (response.status !== 200) {
  process.exitCode = 1;
}
