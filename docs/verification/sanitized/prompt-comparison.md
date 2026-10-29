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

Cost estimates use the Amazon Nova Micro example rates of $0.000035 per 1,000 input tokens and $0.00014 per 1,000 output tokens published in this [AWS cost example](https://aws.amazon.com/blogs/machine-learning/cost-efficient-custom-text-to-sql-using-amazon-nova-micro-and-amazon-bedrock-on-demand-inference/). These figures estimate model inference only and are not AWS billing totals. Check [current Bedrock pricing](https://aws.amazon.com/bedrock/pricing/) before using these rates for budgeting.

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

## Complete 5-point rubric adjudication

Summary coverage earns one point when the summary conveys every fact listed in requiredSummaryFacts for the case, including equivalent wording. A response that fails schema validation receives 0/5 under the scoring rubric.

| Case | V1 coverage | V1 score | V2 coverage | V2 score | Coverage review |
| --- | --- | ---: | --- | ---: | --- |
| eval-001 | No output | 0 | No | 3 | V2 omits the reversal request. |
| eval-002 | Yes | 5 | Yes | 5 | Both include the invoice problem and request. |
| eval-003 | Yes | 5 | No | 4 | V2 omits the status-check request. |
| eval-004 | No output | 0 | No | 4 | V2 omits the request to explain the difference. |
| eval-005 | No | 3 | No | 4 | Both omit that the customer launch is today. |
| eval-006 | Yes | 5 | Yes | 5 | Both describe the failing date filter and working searches. |
| eval-007 | Yes | 5 | Yes | 5 | Both describe the empty export despite report records. |
| eval-008 | Yes | 5 | Yes | 5 | Both describe the unavailable dashboard and team impact. |
| eval-009 | Yes | 5 | Yes | 5 | Both describe the affected agents and reply failure. |
| eval-010 | No | 4 | No | 4 | Both omit that tickets without attachments can be submitted. |
| eval-011 | Yes | 5 | Yes | 5 | Both describe the reset-link problem and sign-in need. |
| eval-012 | Yes | 5 | Yes | 5 | Both convey the account-email request. |
| eval-013 | Yes | 5 | Yes | 5 | Both include the alert and unauthorized password change. |
| eval-014 | No | 4 | No | 4 | Both omit that the only administrator is locked and today's orders are affected. |
| eval-015 | No | 4 | Yes | 4 | V1 gives the symptom but omits the setup request; V2 conveys it. |
| eval-016 | Yes | 5 | Yes | 4 | Both cover the dark-mode request; V2 loses its category point. |
| eval-017 | Yes | 5 | Yes | 5 | Both convey the documentation request. |
| eval-018 | Yes | 5 | Yes | 5 | Both cover the nonprofit-discount and eligibility request. |
| eval-019 | No | 3 | No | 4 | Both omit that the review cannot proceed and begins in one hour. |
| eval-020 | Yes | 3 | Yes | 5 | V1 covers dark mode but loses urgency and grounding points. |

| Rubric total | V1 | V2 |
| --- | ---: | ---: |
| Cases with complete summary coverage | 13/20 | 13/20 |
| Total points | 81/100 | 90/100 |
| Average score | 4.05/5 | 4.50/5 |
| Cases scoring 5/5 | 12/20 | 11/20 |

The 5-point scores supplement the unchanged selection gate; a 5/5 case count was not one of the gate thresholds.

## Selection gate

The gate was applied unchanged: at least **18/20 schema-valid outputs**, **17/20 correct categories**, and **18/20 factual summaries**. V1 misses the factual-summary threshold at 17/20. V2 passes all three thresholds at **20/20**, **18/20**, and **20/20**, respectively. Select **V2** for the next release-control checks.

Detailed model responses remain in the ignored `docs/verification/raw/` directory. Expected answers are defined in `eval/cases/frozen-evaluation.jsonl` and were not sent to the gateway. This sanitized report contains case IDs, aggregate metrics, and review outcomes without reproducing ticket text or model responses.