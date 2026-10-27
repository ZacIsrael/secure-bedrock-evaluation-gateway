# Create a dedicated log group for evaluation gateway application logs.
# Include the project and environment in its name for easy identification.
resource "aws_cloudwatch_log_group" "gateway" {
  name = "/secure-bedrock-evaluation-gateway/${var.environment}/gateway"

  # Delete log events after the configured retention period.
  # The development deployment defaults to seven days.
  retention_in_days = var.log_retention_days

  # Apply shared project tags and identify this specific log group.
  # Set the environment tag explicitly for filtering in AWS.
  tags = merge(
    var.tags,
    {
      Name        = "${var.environment}-evaluation-gateway-logs"
      Environment = var.environment
    }
  )
}

# Create the log stream that the gateway application will write to.
# Reference the log group so Terraform creates it first.
resource "aws_cloudwatch_log_stream" "gateway" {
  name           = "gateway"
  log_group_name = aws_cloudwatch_log_group.gateway.name
}