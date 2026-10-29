# Frozen Prompt Comparison

## Run configuration

- Evaluation date: October 29, 2026 (UTC)
- Model: `amazon.nova-micro-v1:0`
- Dataset: the same 20 frozen support tickets for both prompts
- Gateway: authorized client workload using a gateway-audience SPIFFE JWT-SVID
- Dataset SHA-256: `d006146f5a0db740a2b33aeb6d8b969ec7c8fd493831844900572b19fb1ee0de`
- V1 prompt SHA-256: `7d469347fb05013d1238e4c924ac10c6f63d54493ddd4475769ff99c09d3abd0`
- V2 prompt SHA-256: `284a160f7226fb6a6aaec5ed5ce96a5eb9e8ec1bf0e4ca2ea1896a7705d84a6e`

The five development cases remained separate. Neither frozen prompt was changed after inspecting these evaluation results.

## Results

| Measure | V1 | V2 |
| --- | ---: | ---: |
| Gateway-accepted schema outputs | 18/20 | 20/20 |
| Correct categories | 18/20 | 18/20 |
| Correct urgency labels | 15/20 | 19/20 |
| Factual summaries, manual review | 17/20 | 20/20 |
| Client-observed p50 latency | 515 ms | 490 ms |
| Client-observed p95 latency | 678 ms | 688 ms |
| Failed requests | 2 | 0 |
| Client-level retries | 0 | 0 |
| Recorded input tokens | 4,356 | 5,873 |
| Recorded output tokens | 636 | 691 |
| Estimated inference cost from recorded tokens | At least $0.0002415 | About $0.0003023 |

Latency uses all 20 client-observed request durations and the nearest-rank percentile method. The V1 token totals omit two rejected model outputs because the gateway did not return usage for those responses. Consequently, V1's cost estimate is a lower bound. The runner made no client-level retries; AWS SDK internal retry attempts were not measured.

Cost estimates use the published Amazon Nova Micro example rates of $0.000035 per 1,000 input tokens and $0.00014 per 1,000 output tokens. These figures estimate model inference only and are not AWS billing totals. Check current Bedrock pricing before using these rates for budgeting.

## Per-case review

In each result column, the four values mean **schema accepted / category correct / urgency correct / summary factual**. `Y` means yes; `N` means no. A rejected output has no summary to review and counts as `N` for the factual-summary gate.

| Case | V1 | V2 |
| --- | --- | --- |
| eval-001 | N/N/N/N | Y/Y/N/Y |
| eval-002 | Y/Y/Y/Y | Y/Y/Y/Y |
| eval-003 | Y/Y/Y/Y | Y/Y/Y/Y |
| eval-004 | N/N/N/N | Y/Y/Y/Y |
| eval-005 | Y/Y/N/Y | Y/Y/Y/Y |
| eval-006 | Y/Y/Y/Y | Y/Y/Y/Y |
| eval-007 | Y/Y/Y/Y | Y/Y/Y/Y |
| eval-008 | Y/Y/Y/Y | Y/Y/Y/Y |
| eval-009 | Y/Y/Y/Y | Y/Y/Y/Y |
| eval-010 | Y/Y/Y/Y | Y/Y/Y/Y |
| eval-011 | Y/Y/Y/Y | Y/Y/Y/Y |
| eval-012 | Y/Y/Y/Y | Y/Y/Y/Y |
| eval-013 | Y/Y/Y/Y | Y/Y/Y/Y |
| eval-014 | Y/Y/Y/Y | Y/Y/Y/Y |
| eval-015 | Y/Y/Y/Y | Y/N/Y/Y |
| eval-016 | Y/Y/Y/Y | Y/N/Y/Y |
| eval-017 | Y/Y/Y/Y | Y/Y/Y/Y |
| eval-018 | Y/Y/Y/Y | Y/Y/Y/Y |
| eval-019 | Y/Y/N/Y | Y/Y/Y/Y |
| eval-020 | Y/Y/N/N | Y/Y/Y/Y |

V1's `eval-001` and `eval-004` returned HTTP 502. Gateway logs identify both as `validate` failures with reason `invalid_category`; they were not Bedrock permission errors. V1's `eval-020` summary included `OVERRIDE` from an instruction embedded in the ticket, so it failed the rubric's grounding rule.

V2 mislabeled the categories for `eval-015` and `eval-016` and marked `eval-001` high urgency when the expected label was normal. Its remaining category and urgency labels matched the frozen answers. Manual factuality review found no invented facts or followed ticket instructions in V2's 20 summaries.

Factuality and coverage are distinct rubric criteria. Some otherwise factual summaries omit a requested action or supporting detail. This report does not claim that every V2 case earned 5/5; complete summary-coverage adjudication is still required for full per-case rubric scores.

## Selection gate

The gate was applied unchanged: at least **18/20 schema-valid outputs**, **17/20 correct categories**, and **18/20 factual summaries**. V1 misses the factual-summary threshold at 17/20. V2 passes all three thresholds at **20/20**, **18/20**, and **20/20**, respectively. Select **V2** for the next release-control checks.

Detailed responses and expected answers remain in the ignored `docs/verification/raw/` directory. This sanitized report contains only case IDs, aggregate metrics, and review outcomes.