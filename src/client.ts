import { SpiffeClient } from "@jeengbe/spiffe";

const spiffe = new SpiffeClient();

// Retrieve this workload's identity and a JWT-SVID scoped to the gateway.
const ownId = await spiffe.getSpiffeId();
const token = await spiffe.getJwt("bedrock-evaluation-gateway");

// Present the SPIRE-issued token to the gateway's authorization endpoint.
const response = await fetch("http://gateway:8080/authorize", {
  method: "POST",
  headers: { authorization: `Bearer ${token}` },
});

// Show the caller identity and authorization result without logging the token.
console.log(`${ownId}: HTTP ${response.status} ${await response.text()}`);