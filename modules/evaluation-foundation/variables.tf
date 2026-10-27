# Inputs: Region, project/environment, operator principal ARN, 
# model ID, artifact prefix, retention, and tags.

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
