// Build the small operational event sent to CloudWatch after a successful request.
// Select fields explicitly so extra data is not copied into the log.
export function classificationSucceededEvent(input: {
    // Identify the prompt and model responsible for this invocation.
    promptId: string;
    modelId: string;
  
    // Link the event to the result saved in S3 without logging that result.
    evidenceKey: string;
  
    // Record performance and token usage for operational review.
    latencyMs: number;
    usage: {
      // Bedrock may omit a count; JSON serialization omits undefined values.
      inputTokens: number | undefined;
      outputTokens: number | undefined;
      totalTokens: number | undefined;
    };
  }): string {
    // Build a new object from the approved fields rather than serializing input.
    // This excludes unexpected properties supplied at runtime.
    return JSON.stringify({
      event: "classification_succeeded",
      promptId: input.promptId,
      modelId: input.modelId,
      evidenceKey: input.evidenceKey,
      latencyMs: input.latencyMs,
      usage: input.usage,
    });
  }