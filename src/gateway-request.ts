// The purpose of this file is to send client requests to the gateway over mTLS.
// It obtains fresh SPIRE credentials and checks the gateway's SPIFFE identity.

import { request } from "node:https";
import { SpiffeClient } from "@jeengbe/spiffe";
import { watchX509TlsMaterial } from "./spiffe-x509.js";

// These are the workload identities SPIRE must issue to the two processes.
// A valid certificate for a different workload must not gain access.
const clientId = "spiffe://secure-bedrock-evaluation-gateway.local/client";
const gatewayId = "spiffe://secure-bedrock-evaluation-gateway.local/gateway";

// Send an authorization check or ticket request using client-side mTLS.
// Return the HTTP status and body without exposing certificate private keys.
export async function gatewayPost(
  spiffe: SpiffeClient,
  path: "/authorize" | "/tickets",
  token: string,
  body?: unknown
): Promise<{ status: number; body: string }> {
  // Subscribe to the Workload API for this client's X.509-SVID and CA bundle.
  // A later call gets the current credentials after SPIRE rotates them.
  const updates = watchX509TlsMaterial(spiffe, clientId);
  let material;

  try {
    // Wait for SPIRE to supply usable credentials before opening HTTPS.
    const first = await updates.next();

    if (first.done) {
      throw new Error("SPIRE did not provide client TLS credentials");
    }

    material = first.value;
  } finally {
    // This request needs one current snapshot, not a long-running update stream.
    // Closing it releases the subscription after the credentials are obtained.
    await updates.return(undefined);
  }

  // The authorization check has no JSON body; ticket requests do.
  const payload = body === undefined ? undefined : JSON.stringify(body);

  // Resolve with the gateway response or reject on TLS and transport errors.
  return new Promise((resolve, reject) => {
    const req = request(
      {
        // Docker Compose resolves "gateway" to the gateway container.
        // TLS identity is checked against its SPIFFE URI below.
        hostname: "gateway",
        port: 8080,
        path,
        method: "POST",

        // Present the client's certificate and key to the gateway.
        // Use SPIRE's CA bundle to verify the gateway's certificate chain.
        ...material,
        rejectUnauthorized: true,

        // Bound the complete request so a stalled gateway cannot hang the run.
        signal: AbortSignal.timeout(60_000),

        // A SPIFFE certificate identifies a workload by URI, not Docker DNS.
        // Reject even a trusted certificate unless it names this gateway.
        checkServerIdentity: (_hostname, certificate) =>
          certificate.subjectaltname === `URI:${gatewayId}`
            ? undefined
            : new Error("Gateway SPIFFE identity does not match"),

        // Send the gateway-scoped JWT in addition to the client certificate.
        // Include JSON headers only when submitting a request body.
        headers: {
          authorization: `Bearer ${token}`,
          ...(payload === undefined
            ? {}
            : {
                "content-type": "application/json",
                "content-length": Buffer.byteLength(payload),
              }),
        },
      },
      async (response) => {
        try {
          // Collect the small gateway response for the client or evaluator.
          let responseBody = "";

          for await (const chunk of response) {
            responseBody += chunk.toString();
          }

          // Preserve the HTTP status, including authorization failures.
          resolve({ status: response.statusCode ?? 0, body: responseBody });
        } catch (error) {
          reject(error);
        }
      }
    );

    // TLS failures, identity mismatches, and connection errors reach the caller.
    req.on("error", reject);

    // Send the optional JSON body and finish writing the request.
    req.end(payload);
  });
}
