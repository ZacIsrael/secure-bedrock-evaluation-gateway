# Inherit shared configuration and version constraints.
include "root" {
  path = find_in_parent_folders("root.hcl")
}

# Point this deployment unit to the project's Terraform module.
terraform {
  source = "../../modules"
}