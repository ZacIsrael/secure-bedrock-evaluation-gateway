# P0: Secure Bedrock Evaluation Gateway

A project to build a secure Amazon Bedrock evaluation gateway using Terraform and Terragrunt, with workload identity, encryption, and model evaluation workflows.

## Toolchain Versions

The following installed versions were checked locally on October 27, 2026.

Development platform: macOS on Apple Silicon (`arm64`).

| Tool | Recorded version | Verification command |
| --- | --- | --- |
| Terraform | `1.16.2` | `terraform version` |
| Terragrunt | `1.1.4` | `terragrunt --version` |
| AWS CLI | `2.34.47` | `aws --version` |
| Node.js | `22.23.1` | `node --version` |
| npm | `10.9.8` | `npm --version` |
| Docker CLI | `24.0.5` (build `ced0996`) | `docker --version` |
| Docker Compose | `v2.20.2-desktop.1` | `docker compose version` |

These entries document the installed toolchain. End-to-end project compatibility has not yet been validated. The Docker version above is the CLI version; the Docker Engine version was not checked by that command.

## Dependency Pinning

Version constraints and lockfiles will be added as the infrastructure and application are implemented:

- Terraform CLI requirements in `terraform/versions.tf`.
- AWS provider requirements and committed `.terraform.lock.hcl` files.
- Application dependencies in `package.json` and `package-lock.json`.
- SPIRE releases and container image versions or digests in the relevant configuration.

Provider, application dependency, and SPIRE versions have not yet been recorded. This README documents versions; it does not enforce them.