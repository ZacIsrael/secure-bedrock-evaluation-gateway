// The purpose of this file is to prepare SPIRE-issued certificates, 
// private keys, and trust bundles for Node TLS.
// It also passes along new certificates so the gateway and client can 
// update their TLS connections when SPIRE rotates them.

import { X509Certificate } from "node:crypto";
import { SpiffeClient } from "@jeengbe/spiffe";

// Keep this material in the workload's memory; the private key must never be logged.
export type X509TlsMaterial = {
  cert: string;
  key: string;
  ca: string[];
};

// SPIRE sends one or more concatenated DER certificates, not PEM text.
// Split complete ASN.1 sequences before passing each certificate to Node TLS.
function certificatesToPem(der: Uint8Array): string[] {
  const certificates: string[] = [];
  let offset = 0;

  while (offset < der.length) {
    // Each certificate starts with an ASN.1 SEQUENCE tag and a length.
    // Reject malformed data before giving it to Node TLS.
    if (der[offset] !== 0x30 || offset + 2 > der.length) {
      throw new Error("Invalid DER certificate sequence");
    }

    const lengthByte = der[offset + 1]!;
    let headerLength = 2;
    let contentLength = lengthByte;

    // A set high bit means the length occupies the following bytes.
    // Indefinite or oversized lengths are invalid for this certificate input.
    if (lengthByte & 0x80) {
      const lengthBytes = lengthByte & 0x7f;

      if (
        lengthBytes === 0 ||
        lengthBytes > 4 ||
        offset + 2 + lengthBytes > der.length
      ) {
        throw new Error("Invalid DER certificate length");
      }

      headerLength += lengthBytes;
      contentLength = 0;

      // DER length bytes are big-endian; reconstruct their numeric value.
      for (let index = 0; index < lengthBytes; index++) {
        contentLength = contentLength * 256 + der[offset + 2 + index]!;
      }
    }

    // The entire certificate must fit within the bytes SPIRE returned.
    const end = offset + headerLength + contentLength;

    if (end > der.length || contentLength === 0) {
      throw new Error("Truncated DER certificate");
    }

    // PEM wraps the original DER bytes in base64 and certificate markers.
    // Parsing the PEM catches malformed certificate data here.
    const base64 = Buffer.from(der.subarray(offset, end)).toString("base64");
    const pem =
      `-----BEGIN CERTIFICATE-----\n` +
      `${base64.match(/.{1,64}/g)?.join("\n")}\n` +
      `-----END CERTIFICATE-----\n`;

    new X509Certificate(pem);
    certificates.push(pem);
    offset = end;
  }

  // An empty identity chain or trust bundle cannot establish TLS.
  if (certificates.length === 0) {
    throw new Error("SPIRE returned an empty certificate chain");
  }

  return certificates;
}

// SPIRE supplies the private key as DER-encoded PKCS#8 bytes.
// Convert it to PEM in memory without printing or writing it to disk.
function keyToPem(der: Uint8Array): string {
  if (der.length === 0) {
    throw new Error("SPIRE returned an empty private key");
  }

  const base64 = Buffer.from(der).toString("base64");

  return (
    `-----BEGIN PRIVATE KEY-----\n` +
    `${base64.match(/.{1,64}/g)?.join("\n")}\n` +
    `-----END PRIVATE KEY-----\n`
  );
}

// Subscribe to SPIRE updates rather than keeping a one-time certificate snapshot.
// The caller must apply every yielded update to its TLS server or client.
export async function* watchX509TlsMaterial(
  spiffe: SpiffeClient,
  expectedSpiffeId: string
): AsyncGenerator<X509TlsMaterial> {
  for await (const update of spiffe.api.fetchX509SVID({})) {
    // Use only the registered identity for this specific workload.
    // Fail closed if SPIRE stops returning its expected X.509-SVID.
    const svid = update.svids.find(
      (entry) => entry.spiffeId === expectedSpiffeId
    );

    if (!svid) {
      throw new Error(`No X.509-SVID for ${expectedSpiffeId}`);
    }

    // Present the leaf and intermediate certificates to the peer.
    // Keep trusted CA certificates separate for peer verification.
    yield {
      cert: certificatesToPem(svid.x509Svid).join(""),
      key: keyToPem(svid.x509SvidKey),
      ca: certificatesToPem(svid.bundle),
    };
  }
}
