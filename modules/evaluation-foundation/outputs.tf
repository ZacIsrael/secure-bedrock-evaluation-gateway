# Outputs: bucket name/ARN, gateway role ARN, log-group name, 
# Region, and model ID. Never output credentials.

# Expose the bucket name for the gateway's S3 configuration.
# The bucket ID is its name.
output "bucket_name" {
  description = "Name of the S3 evaluation evidence bucket."
  value       = aws_s3_bucket.evaluation_evidence.id
}

# Expose the bucket ARN for policies that reference the bucket.
# Object-level permissions will also need the appropriate object ARN.
output "bucket_arn" {
  description = "ARN of the S3 evaluation evidence bucket."
  value       = aws_s3_bucket.evaluation_evidence.arn
}

# Expose the selected Bedrock model ID to the gateway configuration.
# This value comes from the module input.
output "model_id" {
  description = "Bedrock foundation model ID used for ticket evaluation."
  value       = var.model_id
}

# Expose the AWS Region selected for this deployment.
# Ensure the AWS provider uses the same Region as this input.
output "region" {
  description = "AWS Region for regional project resources and Bedrock invocation."
  value       = var.region
}

# Expose the gateway role ARN to the application configuration.
# The authenticated operator assumes this role for runtime permissions.
output "gateway_role_arn" {
  description = "ARN of the IAM role assumed by the evaluation gateway operator."
  value       = aws_iam_role.gateway.arn
}

# Expose the CloudWatch log group name used by the gateway.
# The application uses it when sending events to its log stream.
output "log_group_name" {
  description = "Name of the evaluation gateway CloudWatch log group."
  value       = aws_cloudwatch_log_group.gateway.name
}
