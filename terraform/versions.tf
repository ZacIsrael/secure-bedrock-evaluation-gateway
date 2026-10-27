terraform {
  # Require the exact Terraform CLI version used by this project.
  required_version = "= 1.16.2"

  # Declare the providers required by this Terraform configuration.
  required_providers {
    aws = {
      # Use the official AWS provider published by HashiCorp.
      source = "hashicorp/aws"

      # Require exactly AWS provider version 5.23.0.
      version = "= 5.23.0"
    }
  }
}
