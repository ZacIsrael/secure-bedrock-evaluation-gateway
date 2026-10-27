# Inputs: Region, project/environment, operator principal ARN, 
# model ID, artifact prefix, retention, and tags.

# Select the AWS Region for this development deployment.
# Bedrock model invocation for this project uses us-east-1.
variable "region" {
  description = "AWS Region for regional project resources and Bedrock invocation."
  type        = string
  default     = "us-east-1"
}

# Identify the existing operator allowed to assume the gateway IAM role.
# Pass the specific IAM role or user ARN used by the authenticated operator.
variable "operator_principal_arn" {
  description = "ARN of the existing IAM principal trusted to assume the gateway role."
  type        = string
}

# Identify the deployment environment used in resource names and tags.
# Pass a value such as "dev" from the Terragrunt development unit.
variable "environment" {
  description = "Deployment environment, such as dev."
  type        = string
}

# Supply common tags for resources created by this module.
# Include the project and environment when passing this value.
variable "tags" {
  description = "Common tags applied to module resources."
  type        = map(string)
  default     = {}
}

# Set how many days evaluation evidence should be retained.
# Use this value for both current and noncurrent object lifecycle rules.
variable "s3_retention_days" {
  description = "Number of days to retain evaluation evidence in S3."
  type        = number
  default     = 7
}
