# Identity, release, and recovery evidence

Observed in the local development stack on November 1, 2026. This record omits tickets, credentials, JWTs, certificate private keys, and full model responses. Detailed evaluation results remain under ignored `docs/verification/raw/`.

## Identity and mTLS

- Authorized client: SPIRE issued `spiffe://secure-bedrock-evaluation-gateway.local/client`; an X.509-mTLS plus gateway-audience JWT request returned HTTP 200.
- Missing client certificate: TLS rejected the connection with `ERR_SSL_TLSV13_ALERT_CERTIFICATE_REQUIRED`, before HTTP authorization.
- Missing and malformed JWT: a client with valid mTLS received HTTP 401 in both cases.
- Wrong JWT audience: a valid JWT-SVID minted for another audience received HTTP 401.
- Trusted but unauthorized certificate: the gateway workload's valid X.509-SVID received HTTP 403 (`Client certificate identity not authorized`). This separates chain trust from workload authorization.
- Unmatched selectors: a separately labeled container received no SVID; SPIRE agent logs reported `No identity issued` and `registered=false`. The client probe timed out, so the agent log is the direct issuance evidence rather than a clean client exception.
- Expired JWT: after waiting beyond expiry, the previously issued JWT received HTTP 401 (`Expired identity`). The first expiry test returned HTTP 200 near expiry; a strict gateway expiry guard was added and retested successfully.
- X.509-SVID renewal: an isolated 60-second-TTL probe observed serial `9EA103A0BFCD84479441FAC1C93CEFB5` expiring November 1 at 18:09:13 GMT and replacement serial `6B9A7D2C244A9E8EDDFC6D243EEE491` expiring at 18:09:38 GMT. This proves SPIRE renewal and the TypeScript watch, not independently a live gateway handshake across rotation.
- Agent outage/recovery: a fresh-client issuance failure during the agent outage has not been supplied for review. A first recovery attempt hit `ECONNREFUSED` before gateway readiness. A subsequent manual restart waited for gateway health and returned HTTP 200 authorization in 14 seconds from restart initiation; that is not total outage duration.

## Release and operational recovery

- Frozen selection gate: V1 was blocked at 17/20 factual summaries against 18/20. V2 passed with 20/20 schema-valid, 18/20 categories, and 20/20 factual summaries. `release-approval.json` records the selected prompt, model, thresholds, reviewed scores, and V2 prompt and dataset SHA-256 hashes. This reviewed decision is not enforced automatically at gateway startup.
- Controlled Bedrock denial: a temporary role inline policy explicitly denied `bedrock:InvokeModel` on the selected model. The synthetic ticket returned HTTP 502; gateway logs recorded phase `invoke`, `AccessDeniedException`, and AWS HTTP 403. After policy removal, the first request still returned HTTP 502 during propagation; a later retry returned HTTP 200. The Terraform-managed policy was unchanged.
- Configuration rollback: a disposable Compose override set an unsupported `PROMPT_ID`; the gateway exited. Removing the override and recreating the gateway restored V2 and the same approved Docker image ID, `sha256:d9235e02cd195850b198b98f20a2a93cac7e90e6d320a064a9efa40fe95afd27`. A new synthetic ticket returned HTTP 200 in 20 seconds measured from starting the bad deployment, within the 10-minute lab RTO. The override was removed.
- Final checks: `npm run typecheck`, `npm test` (one operational-event sanitization test), Compose configuration check, native Terraform formatting check, Terragrunt validation, and a plan against deployed state passed. Terraform reported no changes. This verifies infrastructure consistency, not complete automated coverage of application behavior.

## Explicit gaps

The isolated renewal probe and manual agent recovery do not prove a live gateway handshake across rotation or a bounded fresh-client issuance failure during the agent outage. Removal of the temporary renewal registration has not been independently confirmed here. The Friday presentation was not delivered. Keep these as explicit gaps rather than marking them passed.
