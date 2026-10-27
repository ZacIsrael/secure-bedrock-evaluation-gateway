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

## Dependency Versions

The following application dependencies were verified locally on October 27, 2026, using `npm ls --depth=0`.

| Dependency | Pinned version | Purpose |
| --- | --- | --- |
| `@aws-sdk/client-bedrock-runtime` | `3.1157.0` | Invoke Amazon Bedrock foundation models. |
| `@aws-sdk/client-s3` | `3.1157.0` | Store and retrieve evaluation artifacts in Amazon S3. |
| `typescript` | `7.0.2` | Compile and type-check the TypeScript application. |
| `@types/node` | `22.20.5` | Provide TypeScript definitions for Node.js 22 APIs. |

The AWS SDK packages are runtime dependencies. TypeScript and Node.js type definitions are development dependencies.

## Version Pinning

- `.terraform-version` records Terraform `1.16.2`.
- `.terragrunt-version` records Terragrunt `1.1.4`.
- `.nvmrc` records Node.js `22.23.1`.
- `terraform/versions.tf` requires Terraform `1.16.2` and AWS provider `5.23.0`.
- `live/root.hcl` enforces the Terraform and Terragrunt CLI version constraints.
- `live/dev/.terraform.lock.hcl` records the resolved provider version and checksums.
- `package.json` declares exact application dependency versions and requires Node.js `22.23.1` and npm `10.9.8`.
- `package-lock.json` records the resolved npm dependency tree.
- `.npmrc` enables exact dependency versions and strict engine checks.

The tool-version files support compatible version managers; they do not independently install or switch tool versions.

## Verification Status

- Installed CLI versions recorded.
- Terraform provider initialization completed through Terragrunt.
- Installed application dependency versions confirmed with `npm ls --depth=0`.
- Bedrock Runtime and S3 SDK imports loaded successfully without making AWS requests.
- TypeScript type checking and compilation remain pending until application source files are added.
- AWS provider support for the complete resource configuration remains to be validated.
- SPIRE releases and container image pins remain pending.