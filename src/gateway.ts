import { createServer } from "node:http";
import { SpiffeClient } from "@jeengbe/spiffe";

const trustDomain = "secure-bedrock-evaluation-gateway.local";
const gatewayId = `spiffe://${trustDomain}/gateway`;
const allowedClientId = `spiffe://${trustDomain}/client`;
const audience = "bedrock-evaluation-gateway";
const spiffe = new SpiffeClient();

// Confirm this process received the gateway identity before accepting requests.
const ownId = await spiffe.getSpiffeId();
if (ownId !== gatewayId) {
  throw new Error(`Gateway received unexpected SPIFFE identity: ${ownId}`);
}

createServer(async (request, response) => {
  // Expose only the authorization check and ticket-processing endpoint.
  if (
    request.method !== "POST" ||
    (request.url !== "/authorize" && request.url !== "/tickets")
  ) {
    response.writeHead(404).end();
    return;
  }

  // Obtain the caller identity from a validated JWT-SVID, not request data.
  const authorization = request.headers.authorization;
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : undefined;

  if (!token) {
    response.writeHead(401).end("Missing bearer token\n");
    return;
  }

  try {
    // SPIRE validates the token's signature, expiration, and audience.
    const identity = await spiffe.validateJwt(audience, token);

    if (!identity) {
      response.writeHead(401).end("Invalid identity\n");
      return;
    }

    // Authentication alone does not authorize access to this gateway.
    if (identity.spiffeId !== allowedClientId) {
      response.writeHead(403).end("Identity not authorized\n");
      return;
    }

    if (request.url === "/authorize") {
      response.writeHead(200).end("Client authorized\n");
      return;
    }

    // Read a bounded request body only after the caller is authorized.
    let body = "";
    for await (const chunk of request) {
      body += chunk.toString();
      if (Buffer.byteLength(body, "utf8") > 4096) {
        response.writeHead(413).end("Ticket request too large\n");
        return;
      }
    }

    let input: unknown;
    try {
      input = JSON.parse(body);
    } catch {
      response.writeHead(400).end("Invalid JSON\n");
      return;
    }

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

    // Acknowledge the authorized request without logging ticket contents.
    response.writeHead(202, { "content-type": "application/json" }).end(
      JSON.stringify({
        id: input.id,
        accepted: true,
      })
    );
  } catch (error) {
    // Fail closed if SPIRE cannot validate the caller.
    console.error("Gateway request failed:", error);
    response.writeHead(503).end("Gateway unavailable\n");
  }
}).listen(8080, "0.0.0.0", () => {
  console.log(`Gateway ready as ${gatewayId}`);
});
