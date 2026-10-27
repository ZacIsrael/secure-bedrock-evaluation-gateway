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
