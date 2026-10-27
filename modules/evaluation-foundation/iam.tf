# Allow only the specified existing IAM principal to assume this role.
# The operator principal ARN is supplied through the module input.
data "aws_iam_policy_document" "gateway_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "AWS"
      identifiers = [var.operator_principal_arn]
    }
  }
}

# Create the role that the authenticated gateway operator can assume.
resource "aws_iam_role" "gateway" {
  name               = "${var.environment}-bedrock-evaluation-gateway"
  assume_role_policy = data.aws_iam_policy_document.gateway_trust.json

  # Identify the project and environment alongside any shared tags.
  # These tags make the gateway role easier to find and manage.
  tags = merge(
    var.tags,
    {
      Project     = "secure-bedrock-evaluation-gateway"
      Environment = var.environment
    }
  )
}

# Determine the AWS partition for resource ARNs.
# This keeps the Bedrock ARN consistent with the deployment partition.
data "aws_partition" "current" {}

# Grant the gateway only the permissions needed during evaluation.
# Each statement limits an action to its relevant AWS resource.
data "aws_iam_policy_document" "gateway_runtime" {
  # Allow non-streaming Converse requests to the selected Bedrock model.
  # Restrict invocation to that model in the configured AWS Region.
  statement {
    sid     = "InvokeSelectedModel"
    effect  = "Allow"
    actions = ["bedrock:InvokeModel"]

    resources = [
      "arn:${data.aws_partition.current.partition}:bedrock:${var.region}::foundation-model/${var.model_id}"
    ]
  }

  # Allow the gateway to upload evaluation artifacts to S3.
  # Restrict writes to objects under the configured artifact prefix.
  statement {
    sid     = "WriteEvaluationArtifacts"
    effect  = "Allow"
    actions = ["s3:PutObject"]

    resources = [
      "${aws_s3_bucket.evaluation_evidence.arn}/${var.artifact_prefix}*"
    ]
  }

  # Allow the gateway to write events to its pre-created log stream.
  # No log-stream creation permission is needed for this setup.
  statement {
    sid       = "WriteGatewayLogs"
    effect    = "Allow"
    actions   = ["logs:PutLogEvents"]
    resources = [aws_cloudwatch_log_stream.gateway.arn]
  }
}

# Attach the runtime permissions to the gateway role.
# The trust policy controls who assumes it; this policy controls what it can do.
resource "aws_iam_role_policy" "gateway_runtime" {
  name   = "${var.environment}-gateway-runtime"
  role   = aws_iam_role.gateway.id
  policy = data.aws_iam_policy_document.gateway_runtime.json
}
