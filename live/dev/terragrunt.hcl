include "root" {
  path = find_in_parent_folders("root.hcl")
}

locals {
  aws_region = "us-east-1"
}

terraform {
  source = "../../modules/evaluation-foundation"
}

inputs = {
  environment            = "dev"
  region                 = local.aws_region
  operator_principal_arn = get_env("OPERATOR_PRINCIPAL_ARN")

  tags = {
    Project     = "secure-bedrock-evaluation-gateway"
    Environment = "dev"
  }
}

generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite_terragrunt"

  contents = <<EOF
provider "aws" {
  region = "${local.aws_region}"
}
EOF
}