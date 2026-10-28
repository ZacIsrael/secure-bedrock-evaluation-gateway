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
  // Limit this initial gateway to the authorization proof endpoint.
  if (request.method !== "POST" || request.url !== "/authorize") {
    response.writeHead(404).end();
    return;
  }

  // Require a bearer token rather than trusting a caller-supplied identity header.
  const authorization = request.headers.authorization;
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : undefined;

  if (!token) {
    response.writeHead(401).end("Missing bearer token\n");
    return;
  }

  try {
    // Validate the JWT-SVID signature, expiration, and intended audience.
    const identity = await spiffe.validateJwt(audience, token);

    if (!identity) {
      response.writeHead(401).end("Invalid identity\n");
    } else if (identity.spiffeId !== allowedClientId) {
      // A valid SPIFFE identity still needs explicit permission to use the gateway.
      response.writeHead(403).end("Identity not authorized\n");
    } else {
      response.writeHead(200).end("Client authorized\n");
    }
  } catch (error) {
    // Fail closed when the identity service cannot validate the token.
    console.error("SPIFFE validation failed:", error);
    response.writeHead(503).end("Identity service unavailable\n");
  }
}).listen(8080, "0.0.0.0", () => {
  console.log(`Gateway ready as ${gatewayId}`);
});
