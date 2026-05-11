# 🟢 PHASE 1 — Q1 (Tháng 1–3)
## AWS Deep Dive + Terraform Mastery Foundation + Golang Basics for DevOps

> **Output cuối phase:** ShopMaster v1 chạy production-like trên AWS, 100% Terraform; 3 Go CLI tools; cert SAA + Terraform Associate.

---

## 🎯 PHASE OVERVIEW

### Mục tiêu
1. Hiểu AWS đến mức có thể design 3-tier production app: VPC → ALB → ECS Fargate → RDS → S3 → CloudFront.
2. Master Terraform cơ bản → trung cấp: state, modules, environments, testing, drift.
3. Học Go đủ để viết CLI tools tương tác AWS SDK và automation Terraform.
4. Build muscle memory về **production mindset**: IAM least privilege, cost tags, observability, backup, secrets.

### Outcome mong đợi
- Có thể stand up một 3-tier app trên AWS bằng Terraform trong < 1 giờ từ scratch.
- Đọc một module Terraform community (vd: `terraform-aws-modules/vpc`) và hiểu 80% code.
- Viết được CLI Go gọi AWS SDK v2 (list EC2, tag resources, generate cost report).
- Pass: AWS SAA-C03, HashiCorp Terraform Associate (003).

### Production Readiness Target (Phase 1 Exit)
| Aspect | Target |
|--------|--------|
| IaC coverage | 100% |
| IAM | Least-privilege, không dùng root, MFA bật |
| Encryption | At-rest (KMS) + in-transit (TLS) cho tất cả data |
| Observability | CloudWatch dashboard + 5 alarm cơ bản (CPU, 5xx, RDS connections, latency, $) |
| Backup | RDS automated backup 7 ngày; S3 versioning |
| Cost | < $50/tháng cho dev env (destroy mỗi tối) |
| CI/CD | GitHub Actions: lint → plan → apply manual approval |

---

## 🛠️ CORE KEY SKILLS PHASE 1

### Terraform (trọng tâm)
- HCL2 syntax, expressions, functions, dynamic blocks.
- Providers: `aws`, `random`, `tls`, `http`, `null`.
- State management: local → S3 + DynamoDB lock.
- Module pattern: input/output, versioning, semantic, composition.
- Workspaces vs separate state files (best practice 2026: **separate state per env**).
- `for_each` vs `count` — khi nào dùng.
- Lifecycle rules, `create_before_destroy`, `prevent_destroy`, `ignore_changes`.
- Data sources, `terraform_remote_state`.
- Testing: `terraform validate`, `tflint`, `tfsec`/`checkov`, **Terratest** cuối phase.

### Golang
- Tooling: `go mod`, `go test`, `go vet`, `golangci-lint`.
- Types, structs, interfaces, pointers.
- Error handling (sentinel, wrap, errors.Is/As).
- Goroutines, channels, `select`, `context.Context`.
- Reading/Writing JSON, YAML, env vars.
- HTTP client + server cơ bản.
- AWS SDK Go v2 (config, credentials chain).
- CLI framework: `spf13/cobra` + `viper`.

### AWS Services (in-depth)
- **IAM:** Users, Groups, Roles, Policies, Trust, Conditions, Permission Boundaries.
- **VPC:** Subnets (public/private/isolated), Route tables, IGW, NAT, VPC endpoints, Security Groups, NACLs, Flow Logs.
- **EC2:** AMI, Instance types, EBS, Snapshots, Launch Templates, ASG.
- **ECS Fargate:** Task definitions, services, ALB integration.
- **RDS:** Multi-AZ, parameter groups, read replicas, snapshot, Performance Insights.
- **S3:** Buckets, lifecycle, replication, versioning, encryption (SSE-KMS), bucket policies, presigned URLs.
- **CloudFront + Route 53:** Distributions, origins, OAC, certificates (ACM), DNS records.
- **CloudWatch:** Metrics, Logs (groups, streams, insights), Alarms, Dashboards, EventBridge.
- **Secrets Manager + SSM Parameter Store** (chọn khi nào dùng cái nào).
- **KMS:** CMK, aliases, key policy vs IAM policy, envelope encryption.

---

## 📅 WEEKLY BREAKDOWN — 12 WEEKS

---

### 🗓️ **WEEK 1 — Setup, AWS Foundations, IAM Deep Dive**

#### Main Topics
- Setup môi trường dev (local + AWS account + budgets).
- AWS Account hygiene: IAM Identity Center, MFA, billing alerts, Organizations.
- IAM deep dive: identity-based vs resource-based policy, trust policy, conditions.

#### Core Knowledge & Key Concepts
- AWS Global infra: Regions, AZs, Edge Locations, Wavelength, Local Zones.
- AWS Shared Responsibility Model.
- IAM evaluation logic: explicit deny > explicit allow > implicit deny.
- `iam:PassRole`, `sts:AssumeRole`, role chaining.
- Permission boundary vs SCP vs IAM policy vs Session policy (4-cấp).
- AWS CLI profile, `aws sso login`, credentials chain.

#### Hands-on Projects / Labs
**Lab 1.1: Setup tài khoản AWS chuẩn**
- Tạo AWS Organizations, 3 accounts: `management`, `shopmaster-dev`, `shopmaster-prod`.
- Bật IAM Identity Center, MFA, Budget Alarm $50.
- Cấu hình `aws configure sso` local.
- **Không tạo IAM User**, chỉ dùng roles + SSO.

**Lab 1.2: IAM Policy Playground**
- Viết 5 policy bằng tay (không generator): S3 read-only theo prefix; EC2 stop/start theo tag; assume-role với MFA condition; deny region != ap-southeast-1; permission boundary cho dev role.
- Test bằng IAM Policy Simulator + CLI `aws sts get-caller-identity`.

**Lab 1.3: Bash → Go warm-up**
- Cài Go 1.24, setup VSCode + gopls.
- Viết Go program `whoami` in ra `sts:GetCallerIdentity` bằng AWS SDK v2.

#### AI-Assisted Tasks
- Prompt: *"Tôi là người mới học AWS. Tạo cho tôi 10 câu hỏi multiple choice level SAA về IAM trust policy với phân tích đúng/sai chi tiết."*
- Prompt: *"Review IAM policy sau, tìm lỗi over-privileged và đề xuất phiên bản least-privilege: {paste JSON}."*

#### Resources
- Adrian Cantrill — AWS SAA-C03 course (Section: IAM).
- AWS Docs: IAM User Guide → "How IAM works".
- Book: *AWS Security* (Dylan Shields) — Ch.1–3.
- Repo: `awsdocs/aws-doc-sdk-examples` (Go subfolder).

#### Milestone & Deliverables
- [ ] AWS Org + 3 accounts thiết lập xong.
- [ ] Budget alarm hoạt động.
- [ ] 5 IAM policies trong repo `iam-playground/`.
- [ ] Go program `whoami` chạy được, commit lên GitHub repo `shopmaster-tools`.

#### Self-Assessment
1. Giải thích sự khác nhau giữa SCP, Permission Boundary, IAM Policy, Session Policy.
2. Tại sao không nên tạo IAM User cho dev?
3. Đọc 1 trust policy có Condition `aws:PrincipalOrgID`, giải thích ý nghĩa.

---

### 🗓️ **WEEK 2 — Terraform Foundation + Provider + State**

#### Main Topics
- Terraform vs OpenTofu (2026: chọn cái nào và tại sao). Hiện tại: dùng **Terraform 1.10+** vì AWS provider chính thức, OpenTofu để biết.
- HCL2 syntax, blocks, expressions.
- Provider configuration, version pinning.
- State: local → remote (S3 + DynamoDB lock).
- `terraform init/plan/apply/destroy/show/state list/state mv/state rm`.

#### Core Knowledge & Key Concepts
- Terraform graph & dependency resolution.
- State file structure (sensitive, schema_version).
- Why never commit `.tfstate` to git.
- `terraform import` workflow.
- Backend block vs `terragrunt` config — khái niệm phân biệt sớm.
- `.terraformrc` plugin cache để tiết kiệm thời gian.

#### Hands-on Projects / Labs
**Lab 2.1: First Terraform — S3 + DynamoDB backend**
- Tạo S3 bucket + DynamoDB table cho TF backend bằng… AWS CLI (bootstrap), sau đó import vào TF state.
- Viết module `bootstrap/` triển khai backend resources với `prevent_destroy`.

**Lab 2.2: Single-file đến multi-file**
- Bắt đầu `main.tf` chứa: provider, VPC, 1 EC2.
- Refactor thành `versions.tf`, `providers.tf`, `vpc.tf`, `compute.tf`, `outputs.tf`, `variables.tf`.
- Apply, destroy, apply lại — quan sát thay đổi state.

**Lab 2.3: State surgery**
- `terraform state list`, `state show`, `state mv`, `state rm`, `terraform import`.
- Cố tình rename resource → quan sát destroy+create → fix bằng `state mv`.

#### AI-Assisted Tasks
- Prompt: *"Giải thích chi tiết flow `terraform plan`: từ lúc đọc HCL, build graph, refresh state, đến output diff. Vẽ pseudo-code 30 dòng."*
- Prompt: *"Tôi có lỗi `Error acquiring the state lock`. Đặt 5 câu hỏi chẩn đoán trước khi gợi ý fix."*

#### Resources
- HashiCorp Learn — "Terraform Cloud" track + "AWS Get Started".
- *Terraform: Up & Running* — Ch. 1–3.
- Video: Ned in the Cloud — Terraform State series.

#### Milestone & Deliverables
- [ ] Repo `shopmaster-infra` với folder `bootstrap/` (S3 + DynamoDB).
- [ ] Folder `envs/dev/` với VPC + 1 EC2 hello-world chạy được.
- [ ] State đã ở S3, lock hoạt động.

#### Self-Assessment
1. Khi nào `terraform plan` không cần refresh state? (`-refresh=false`).
2. Tại sao DynamoDB cần cho state lock dù S3 đã có versioning?
3. Phân biệt `terraform import` vs `terraform state mv`.

---

### 🗓️ **WEEK 3 — VPC Networking + Terraform Variables/Outputs/Modules cơ bản**

#### Main Topics
- VPC architecture: public/private/isolated subnets, NAT, IGW, route tables.
- VPC endpoints (gateway vs interface), cost của NAT vs VPCe.
- Terraform variables, validation, `sensitive`, `nullable`.
- Outputs, locals.
- Module: định nghĩa, source, version, composition.

#### Core Knowledge & Key Concepts
- 3-tier VPC chuẩn cho production: 3 AZ × (public + private + db) = 9 subnets.
- IPv6 dual-stack basics.
- Security Group vs NACL — stateful vs stateless.
- VPC Flow Logs to CloudWatch/S3.
- Module versioning theo SemVer (git tag).

#### Hands-on Projects / Labs
**Lab 3.1: Self-built VPC Module**
- Viết module `modules/vpc/` từ scratch (không dùng community module): subnets dynamic theo `var.az_count`, NAT toggleable (`var.single_nat`).
- Outputs: vpc_id, public_subnet_ids, private_subnet_ids, nat_gw_ids.

**Lab 3.2: So sánh với community module**
- Refactor `envs/dev/network.tf` để dùng `terraform-aws-modules/vpc/aws` version pinned.
- So sánh code mình viết vs community → đọc source community module trên GitHub.

**Lab 3.3: Cost-aware networking**
- Tạo VPC endpoint cho S3 (gateway, free) và ECR (interface, $7/tháng).
- Đo cost NAT vs VPC endpoint bằng AWS Cost Explorer (mock với data 1 tuần sau).

#### AI-Assisted Tasks
- Prompt: *"Review module VPC sau theo best practice 2026. Tìm: cost issue, security issue, naming, missing tags, missing outputs. Đề xuất diff cụ thể."*

#### Resources
- AWS Whitepaper: *Building a Scalable and Secure Multi-VPC Network*.
- `terraform-aws-modules/vpc/aws` source code.
- Video: AWS re:Invent NET sessions (NET402).

#### Milestone & Deliverables
- [ ] Module `modules/vpc/` v0.1.0 (semantic versioned via git tag).
- [ ] ShopMaster dev VPC live.
- [ ] Cost projection spreadsheet (manual ok).

#### Self-Assessment
- Vẽ diagram VPC bạn vừa tạo trên giấy/Excalidraw.
- Trả lời: tại sao private subnet không cần route 0.0.0.0/0 đến IGW?

---

### 🗓️ **WEEK 4 — Compute (EC2, ALB) + Terraform `for_each`/`count`/Dynamic Blocks**

#### Main Topics
- EC2 deep: AMI, instance types (general, compute, memory, burstable), EBS gp3 vs io2.
- Application Load Balancer: listeners, target groups, health checks, sticky sessions.
- ASG, Launch Template, mixed instance policy.
- Terraform: `for_each`, `count`, `dynamic`, conditional expressions.

#### Core Knowledge & Key Concepts
- IMDSv2 enforcement.
- User-data scripts vs AMI baking (Packer awareness).
- ALB target types: instance vs IP vs Lambda.
- TLS termination + ACM cert auto-renewal.
- Choosing `count` (homogeneous, indexed) vs `for_each` (heterogeneous, keyed).

#### Hands-on Projects / Labs
**Lab 4.1: ASG + ALB module**
- Module `modules/web-asg/` deploy ASG nginx 2 instances behind ALB, healthcheck `/`.
- Use `dynamic "block_device_mappings"` để define nhiều EBS.

**Lab 4.2: Multi-service ALB với for_each**
- 1 ALB, 3 target groups (svc-a, svc-b, svc-c), path-based routing.
- Map `var.services = { a = {port=8080, path="/a/*"}, ... }` → `for_each` listener rules.

**Lab 4.3: Packer warm-up (optional)**
- Bake AMI nginx + CloudWatch agent. Tham chiếu trong TF qua data source.

#### AI-Assisted Tasks
- Prompt: *"Trong tình huống X resource có 5 instances giống nhau và 2 instances khác config, dùng count hay for_each? Show cả 2 code và trade-off."*

#### Resources
- Cantrill SAA — EC2 + ELB sections.
- Terraform docs: `for_each`, `dynamic`.

#### Milestone & Deliverables
- [ ] Module `web-asg` v0.1.0.
- [ ] ALB hoạt động, truy cập được qua DNS.
- [ ] Code dùng `for_each` ít nhất 2 chỗ.

#### Self-Assessment
- Sự khác nhau giữa "count = length(var.x)" vs "for_each = toset(var.x)" khi `var.x` thay đổi thứ tự?

---

### 🗓️ **WEEK 5 — Go Foundations + AWS SDK v2 (CLI Tool #1)**

#### Main Topics
- Go tooling, module system, project layout (Standard Go Project Layout — cautious adoption).
- Types, structs, interfaces, methods, pointers vs values.
- Errors, panics, recover, custom error types.
- Concurrency basics: goroutines, channels.
- AWS SDK Go v2: config, credential providers, service clients, paginator, waiter.

#### Core Knowledge & Key Concepts
- Why interfaces in Go are implicit ("structural typing").
- `context.Context` propagation.
- `defer`, panic ordering.
- SDK v2 difference from v1 (functional options, paginators).

#### Hands-on Projects / Labs
**🛠️ Tool #1: `shopctl` — multi-command CLI**
- Repo: `shopmaster-tools/shopctl`.
- Framework: `spf13/cobra` + `viper`.
- Commands tuần này:
  - `shopctl version`
  - `shopctl aws whoami` — print account, user, region.
  - `shopctl aws list-ec2 --tag shopmaster --region ap-southeast-1` — list EC2, format table (use `olekukonko/tablewriter`).
  - `shopctl aws find-untagged` — list resources thiếu tag `CostCenter`, `Owner`, `Environment`.
- Output formats: table, JSON, YAML (use `--output` flag).
- Tests: table-driven test cho parser, mock SDK qua interface.

#### AI-Assisted Tasks
- Prompt: *"Cho tôi 1 ví dụ mocking AWS SDK Go v2 EC2 client với gomock. Giải thích từng dòng."*
- Prompt: *"Review Go code sau theo idiomatic Go 2026. Tìm: error handling anti-pattern, goroutine leak risk, unnecessary pointer, missing context cancellation."*

#### Resources
- Book: *Learning Go* (Bodner) — Ch. 1–8.
- AWS SDK Go v2 docs (aws.amazon.com/sdk-for-go/).
- Course: Ardan Labs "Ultimate Go" — Go Foundations.

#### Milestone & Deliverables
- [ ] `shopctl` v0.1.0 published trên GitHub release.
- [ ] README đẹp với asciicast.
- [ ] Test coverage ≥ 60% cho package `internal/aws/`.

#### Self-Assessment
- Viết test cho hàm dùng AWS SDK mà không gọi AWS thật.
- Giải thích "accept interfaces, return structs".

---

### 🗓️ **WEEK 6 — RDS + Secrets Manager + Terraform Remote State Data**

#### Main Topics
- RDS Multi-AZ, parameter groups, option groups, subnet groups.
- Backups, snapshots, Point-in-time recovery.
- Secrets Manager vs SSM Parameter Store (decision tree).
- Terraform: `terraform_remote_state`, `data` sources.

#### Core Knowledge & Key Concepts
- RDS Storage: gp3 vs io2, IOPS provisioning.
- IAM Authentication for RDS.
- Secrets rotation Lambda.
- Cross-stack sharing patterns: remote_state vs SSM Parameter Store (recommended for loose coupling).

#### Hands-on Projects / Labs
**Lab 6.1: RDS Postgres module**
- Module `modules/rds-postgres/` Multi-AZ, encrypted KMS, password trong Secrets Manager auto-generate.
- Output `secret_arn`, `endpoint`.

**Lab 6.2: Cross-stack consumption**
- Stack `network/` (output VPC, subnets to SSM Param).
- Stack `data/` (consume SSM Param, deploy RDS).
- Stack `compute/` (consume RDS secret ARN).

**Lab 6.3: shopctl extend**
- Command `shopctl db get-creds --env dev` — fetch secret từ Secrets Manager, output JSON hoặc set env vars (`shopctl db env --env dev > .env`).

#### AI-Assisted Tasks
- Prompt: *"So sánh 3 cách share state giữa Terraform stacks: terraform_remote_state, SSM Parameter, Data source query. Khi nào dùng cái nào?"*

#### Resources
- AWS Docs: RDS Best Practices.
- Cantrill — RDS section.

#### Milestone & Deliverables
- [ ] RDS dev live, ShopMaster CRUD test bằng `psql` qua bastion (SSM Session Manager — không SSH).
- [ ] `shopctl db env` hoạt động.
- [ ] 3 stacks tách biệt (network/data/compute) với state riêng.

#### Self-Assessment
- Vẽ flow rotation secret 30 ngày.
- Tại sao IAM auth cho RDS hữu ích mặc dù chậm hơn password?

---

### 🗓️ **WEEK 7 — ECS Fargate + ECR + CI/CD GitHub Actions cơ bản**

#### Main Topics
- ECS Fargate: cluster, task definition, service, ALB integration.
- ECR: repository, lifecycle policy, scan on push, immutable tags.
- GitHub Actions: workflow, jobs, secrets, OIDC to AWS (no static creds!).

#### Core Knowledge & Key Concepts
- Task IAM role vs Execution IAM role (rất hay confuse).
- Fargate platform versions.
- Capacity providers + Fargate Spot.
- GH OIDC: trust policy với `token.actions.githubusercontent.com`.

#### Hands-on Projects / Labs
**Lab 7.1: Dockerize Go service**
- Service `services/product/` Go REST API (chi/echo) `/health`, `/products`.
- Multi-stage Dockerfile (distroless final).
- Push to ECR via GH Action.

**Lab 7.2: ECS Fargate module**
- Module `modules/ecs-service/` deploy 1 service Fargate behind ALB target group.
- Variables: cpu, memory, desired_count, container_port, env_vars (from SSM).

**Lab 7.3: GitHub Actions CI/CD**
- `.github/workflows/product-deploy.yml`:
  - Lint (golangci-lint) → Test (go test) → Build Docker → Trivy scan → Push ECR → Update ECS service.
  - OIDC to AWS, không secret.

#### AI-Assisted Tasks
- Prompt: *"Viết Dockerfile multi-stage tối ưu nhất cho Go REST API: build stage, security scan, distroless final. Giải thích từng layer."*
- Prompt: *"Setup GitHub OIDC với AWS bằng Terraform. Show full code: IAM OIDC provider + Role với conditions chỉ allow repo X branch main."*

#### Resources
- AWS Docs: ECS Best Practices.
- GitHub Actions docs: OIDC.

#### Milestone & Deliverables
- [ ] `product` service chạy trên ECS Fargate, accessible qua ALB.
- [ ] CI/CD green, deploy tự động khi merge main.
- [ ] Trivy scan integrated, block on HIGH+CRITICAL.

#### Self-Assessment
- Phân biệt taskRoleArn vs executionRoleArn với ví dụ S3 access.
- Tại sao OIDC > long-lived access key?

---

### 🗓️ **WEEK 8 — S3 + CloudFront + Route53 + ACM (Frontend layer)**

#### Main Topics
- S3 static website hosting (private + OAC) vs public website hosting.
- CloudFront: behaviors, origins, OAC, cache policy, response headers, functions.
- Route 53: hosted zone, A/AAAA alias, latency-based, weighted, failover.
- ACM cert (us-east-1 cho CloudFront).

#### Core Knowledge & Key Concepts
- OAC (Origin Access Control) thay thế OAI legacy.
- CloudFront price classes (cost saving).
- Cache invalidation (1000 free/month).
- Route 53 health checks + DNS failover.

#### Hands-on Projects / Labs
**Lab 8.1: Frontend module**
- Module `modules/static-site/`: S3 (private) + CloudFront + OAC + ACM + Route53 record.
- Inputs: domain, certificate_arn.

**Lab 8.2: Deploy Next.js static export**
- Build Next.js static export.
- Sync to S3 (use AWS CLI or **viết Go tool** — Tool #2).

**🛠️ Tool #2: `shopctl deploy frontend`**
- Sub-command: sync local `dist/` to S3, invalidate CloudFront.
- Concurrency: upload parallel (goroutines + semaphore).
- Progress bar (`schollz/progressbar`).

#### AI-Assisted Tasks
- Prompt: *"So sánh CloudFront Functions vs Lambda@Edge. Khi nào dùng cái nào? Cho 1 ví dụ Functions thực tế (URL rewrite cho SPA routing)."*

#### Resources
- AWS Docs: CloudFront + S3 OAC pattern.

#### Milestone & Deliverables
- [ ] `shop.example.com` live qua CloudFront + HTTPS.
- [ ] `shopctl deploy frontend` hoạt động.

#### Self-Assessment
- Tại sao ACM cho CloudFront phải ở us-east-1?

---

### 🗓️ **WEEK 9 — Observability (CloudWatch, X-Ray, OpenTelemetry basics) + Go Tool #3**

#### Main Topics
- CloudWatch Metrics, Logs, Alarms, Dashboards, Insights queries.
- CloudWatch Embedded Metric Format (EMF).
- X-Ray basics, AWS Distro for OpenTelemetry (ADOT).
- OpenTelemetry Go SDK setup.

#### Core Knowledge & Key Concepts
- USE method (Util, Saturation, Errors) vs RED (Rate, Errors, Duration).
- SLO/SLI concepts (intro).
- Log groups retention (default = never expire → cost trap).
- Composite alarms.

#### Hands-on Projects / Labs
**Lab 9.1: CloudWatch dashboards as code**
- Terraform module `modules/observability/` tạo dashboard JSON per service.
- Alarms: 5xx > 5%, latency p99 > 1s, RDS CPU > 80%, ECS CPU credits low, Estimated charges > $X.

**Lab 9.2: OTel in Go service**
- Add OpenTelemetry SDK vào `product` service.
- Export traces to AWS X-Ray (via ADOT collector sidecar).
- Manual span trong handler.

**🛠️ Tool #3: `shopctl cost-report`**
- Use AWS Cost Explorer API (`ce:GetCostAndUsage`).
- Output: weekly breakdown by service/tag, top 5 services, anomaly highlight.
- Format: text table + write `cost-report.html` (Go template).
- Tag filter: `CostCenter=shopmaster`.

#### AI-Assisted Tasks
- Prompt: *"Viết CloudWatch Insights query để: tìm top 10 IPs gây 5xx trong 24h, group by 5 minutes, sort desc. Giải thích từng dòng."*

#### Resources
- *Implementing SLOs* — Alex Hidalgo.
- AWS Docs: CloudWatch + ADOT.

#### Milestone & Deliverables
- [ ] Dashboard ShopMaster live với 8+ widgets.
- [ ] 6 alarm hoạt động, gửi SNS email.
- [ ] `shopctl cost-report` v0.1.0.
- [ ] X-Ray trace thấy được service map.

#### Self-Assessment
- Khác biệt giữa metric filter và Logs Insights?
- Tại sao CloudWatch Logs retention default rất nguy hiểm về cost?

---

### 🗓️ **WEEK 10 — Terraform Advanced: Modules pro, Testing (Terratest), Drift Detection**

#### Main Topics
- Module design: standard structure, README generation (`terraform-docs`), example tests.
- Terratest: write Go tests deploying real infra (or LocalStack), assert outputs, destroy.
- `tflint`, `tfsec`/`checkov`, `terraform-docs` in pre-commit.
- Drift detection strategy.

#### Core Knowledge & Key Concepts
- Module versioning + private registry (intro to Terraform Cloud / Spacelift).
- Trade-off: deep module (1 module per pattern) vs flat module (1 module per resource).
- Test strategy: unit (validate/plan) → integration (Terratest apply) → e2e.

#### Hands-on Projects / Labs
**Lab 10.1: Modular refactor**
- Refactor all `envs/dev/*.tf` thành chỉ gọi modules. Không có raw resource trong env.

**Lab 10.2: Terratest cho module VPC**
- File `modules/vpc/test/vpc_test.go`:
  - Use `gruntwork-io/terratest`.
  - Apply → assert `vpc_id` non-empty, subnets count == expected → destroy.
- Run trong GH Actions matrix với multiple regions.

**Lab 10.3: Pre-commit hooks**
- `.pre-commit-config.yaml`: terraform_fmt, terraform_validate, terraform_docs, tflint, checkov.
- Áp dụng cho toàn repo.

#### AI-Assisted Tasks
- Prompt: *"Tôi muốn viết Terratest cho module RDS đa AZ. Show full test (.go file): apply, assert engine version, assert multi_az=true, assert deletion_protection=true. Cleanup khi fail."*

#### Resources
- *Terraform: Up & Running* — Ch. 9 (Testing).
- HashiCorp Module standards.

#### Milestone & Deliverables
- [ ] 5+ modules có Terratest passing.
- [ ] Pre-commit chạy ok.
- [ ] CI matrix test module trên 2 regions.

#### Self-Assessment
- Khi nào unit test (plan-only) đủ, khi nào cần Terratest apply thật?

---

### 🗓️ **WEEK 11 — Multi-Environment Strategy + Stage/Prod + Secrets Hygiene**

#### Main Topics
- Multi-env pattern: workspaces vs folder-per-env (2026 recommend folder-per-env + Terragrunt-style DRY).
- Variable propagation: tfvars hierarchy.
- Promotion workflow: PR → dev → stg → prod.
- Secrets: never in tfvars; use SSM/Secrets Manager + data source.

#### Core Knowledge & Key Concepts
- Why workspaces are dangerous for prod separation.
- Backend per env, role per env (cross-account assume).
- Atlantis / Spacelift / Terraform Cloud (overview only).

#### Hands-on Projects / Labs
**Lab 11.1: Stage env**
- Duplicate `envs/dev/` → `envs/stg/`.
- Reduce instance sizes, single NAT, smaller RDS.
- Deploy ShopMaster v1 stage end-to-end.

**Lab 11.2: Prod env (minimal, accept cost)**
- `envs/prod/` with multi-AZ RDS, 2 NAT, deletion protection.
- Run apply once để verify; sau đó destroy nếu cost lo ngại; nhưng giữ code.

**Lab 11.3: GH Action multi-env promotion**
- Workflow: PR → tflint + plan on dev; merge main → apply dev; tag `stg-*` → apply stg; manual approval → apply prod.

#### AI-Assisted Tasks
- Prompt: *"Thiết kế multi-env GH workflow chi tiết cho Terraform với: OIDC cross-account assume role, manual approval prod, plan as PR comment. Show YAML."*

#### Resources
- HashiCorp blog: "Terraform Recommended Practices".

#### Milestone & Deliverables
- [ ] 3 envs deploy được.
- [ ] Promotion workflow xanh.
- [ ] Zero secret trong git (verify với `gitleaks`).

#### Self-Assessment
- Tại sao folder-per-env > workspace cho prod?

---

### 🗓️ **WEEK 12 — Cert Crunch + Capstone Polish + Phase 1 Retrospective**

#### Main Topics
- Final review for **AWS SAA-C03** + **HashiCorp Terraform Associate (003)**.
- Capstone: polish ShopMaster v1, README, diagrams, blog posts.
- Phase 1 retrospective.

#### Hands-on Projects / Labs
**Capstone polish**
- Architecture diagram (Excalidraw) cho ShopMaster v1.
- README chi tiết với GIF deploy.
- Demo Loom 5 phút.
- Blog post: *"How I built a production-like AWS e-commerce platform with 100% Terraform in 3 months"* (2000+ từ).

**Cert practice**
- KodeKloud / TutorialsDojo SAA practice tests: 65%+ trên 3 tests trước khi đăng ký.
- TF Associate: HashiCorp official study guide + Bryan Krausen practice.

#### AI-Assisted Tasks
- Prompt: *"Quiz tôi 20 câu phỏng vấn DevOps Junior-Mid về Terraform state. Hỏi từng câu, đợi tôi đáp, sau đó phản hồi đúng/sai chi tiết + tài liệu tham khảo."*

#### Resources
- AWS Skill Builder — SAA Practice.
- Bryan Krausen — Terraform Associate practice tests.

#### Milestone & Deliverables
- [ ] SAA-C03 PASS (hoặc booked).
- [ ] TF Associate PASS.
- [ ] Blog post live trên Hashnode/dev.to.
- [ ] Loom demo published.
- [ ] Retrospective doc: 5 things learned, 3 mistakes, 3 next focus.

---

## 🏆 END OF PHASE 1 ASSESSMENT & PORTFOLIO ITEMS

### Portfolio Artifacts
1. `shopmaster-infra` repo: 10+ Terraform modules, 3 envs, CI/CD.
2. `shopmaster-tools` repo: `shopctl` CLI 3 commands (whoami, deploy frontend, cost-report).
3. `shopmaster-services` repo: `product` service Go.
4. `shopmaster-frontend` repo: Next.js static site.
5. Blog: 3+ posts (one per month).
6. Diagrams: Architecture v1.
7. Certs: SAA-C03 + TF Associate.

### Capstone Demo Requirements
- 1-command `make up` deploys dev env in < 30 min.
- 1-command `make down` tears down everything.
- Cost dashboard works.
- 1 chaos test: stop RDS primary → Multi-AZ failover, RTO < 2 min.

### Self-Assessment Questionnaire (trả lời thật)
1. Tôi có thể viết module Terraform từ scratch trong < 1 giờ? (Y/N)
2. Tôi đọc 1 random Terraform plan output và hiểu 90%? (Y/N)
3. Tôi đã từng debug state lock issue và resolve? (Y/N)
4. Tôi đã viết Go CLI > 500 dòng có tests? (Y/N)
5. Tôi giải thích được IAM trust policy có condition trong 1 phút? (Y/N)
6. Cost dev env tháng này < $50? (Y/N)
7. Tôi đã commit code ≥ 5 ngày/tuần trong 12 tuần? (Y/N)

> Cần **≥ 6/7 YES** để vào Phase 2 an toàn. Nếu < 6, dành 1 tuần consolidate.

---

## ⚠️ COMMON PITFALLS — PHASE 1 (Tránh ngay)

| Pitfall | Triệu chứng | Cách tránh |
|---------|-------------|-----------|
| **Forget destroy → bill shock** | $500 bill cuối tháng | Cron `shopctl down` 22:00, Budget Alarm $50 hard |
| **Monolithic state** | 1 state file 5000 dòng, plan 10 phút | Split state theo layer (network/data/compute) từ Week 6 |
| **Hard-code AMI ID** | Module gãy khi đổi region | `data.aws_ami` filter by tag/owner |
| **Inline secrets in tfvars** | Push secret lên GitHub | gitleaks pre-commit, secrets manager only |
| **No tags** | Cost không attribute được | Default_tags trong provider block từ ngày 1 |
| **Skip IAM least privilege** | Role có `*:*` | Permission boundary + access analyzer |
| **`count` for heterogeneous resources** | Destroy + recreate khi đổi thứ tự | Dùng `for_each` với map |
| **Click console "just to test"** | Drift, không reproducible | Console = read-only. Mọi mutation qua TF |
| **Run TF in main branch only** | Conflict, không review | Plan as PR comment, apply on merge |
| **Bash scripts everywhere** | Hard to test, fragile | Move > 50 lines logic to Go |

---

## ➡️ TIẾP THEO

Mở `03_PHASE2_KUBERNETES_EKS_GOLANG_Q2.md` khi:
- [x] Tất cả 12 tuần đã đánh dấu xong.
- [x] Self-assessment ≥ 6/7.
- [x] Cost dev env trong tầm kiểm soát.

**Good luck. See you in Phase 2.** 🚀
