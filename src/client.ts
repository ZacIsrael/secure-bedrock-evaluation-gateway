import { readFile } from "node:fs/promises";
import { SpiffeClient } from "@jeengbe/spiffe";

type DevelopmentCase = {
  id: string;
  ticket: string;
};

const casesPath = "eval/cases/development.jsonl";

// Use only the ticket and ID; expected answers remain private to evaluation.
const firstLine = (await readFile(casesPath, "utf8"))
  .split(/\r?\n/)
  .find((line) => line.trim().length > 0);

if (!firstLine) {
  throw new Error("No development cases found");
}

const parsed: unknown = JSON.parse(firstLine);
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

const developmentCase: DevelopmentCase = {
  id: parsed.id,
  ticket: parsed.ticket,
};

const spiffe = new SpiffeClient();

// Obtain this workload's identity and a token intended for the gateway.
const ownId = await spiffe.getSpiffeId();
const token = await spiffe.getJwt("bedrock-evaluation-gateway");

// Send only the synthetic ticket data through the authorized gateway.
const response = await fetch("http://gateway:8080/tickets", {
  method: "POST",
  headers: {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  },
  body: JSON.stringify(developmentCase),
});

console.log(`${ownId}: HTTP ${response.status} ${await response.text()}`);

if (response.status !== 202) {
  process.exitCode = 1;
}
