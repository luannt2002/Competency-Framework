# 🚀 DEVOPS ENGINEER 12-MONTH ROADMAP (2026 EDITION)
## From Zero → Mid-Senior DevOps Engineer (Terraform + Golang Focus)

> **Tác giả:** DevOps Master Architect 2026
> **Mục tiêu:** Biến người mới thành **DevOps Engineer thực chiến**, làm chủ AWS, Terraform (advanced), Golang (production-grade tooling), Kubernetes, DevSecOps, Platform Engineering.
> **Thời lượng:** 12 tháng, 6–8 giờ/ngày, 5–6 ngày/tuần.
> **Cập nhật:** Tháng 5/2026 — phản ánh best practices mới nhất (OpenTofu split, Terraform 1.10+, Go 1.24, EKS Auto Mode, Karpenter v1, Crossplane v2, Backstage 2.x, OPA → Conftest/Rego v1).

---

## 1. TỔNG QUAN 4 PHASE

| Phase | Quý | Trọng tâm | Output cốt lõi |
|-------|-----|----------|----------------|
| **Phase 1** | Q1 (M1–M3) | **AWS Deep Dive + Terraform Mastery + Go for DevOps Basics** | E-commerce v1 trên AWS bằng Terraform; 3 Go CLI tools |
| **Phase 2** | Q2 (M4–M6) | **Kubernetes + EKS + Golang Advanced (Operators, Controllers)** | E-commerce v2 trên EKS; Custom Operator + Custom Terraform Provider |
| **Phase 3** | Q3 (M7–M9) | **DevSecOps + GitOps + Advanced CI/CD + Go Tooling** | E-commerce v3 với GitOps (ArgoCD/Flux); Policy-as-Code; Compliance scanner Go |
| **Phase 4** | Q4 (M10–M12) | **Platform Engineering + FinOps + Multi-Region + Go Production Services** | Internal Developer Platform (IDP) hoàn chỉnh với Backstage + Crossplane + Go microservices |

**Triết lý xuyên suốt:**
- **Terraform-first:** Mọi resource AWS đều IaC. Không click console.
- **Go-first cho automation:** Bash chỉ dùng cho glue scripts < 50 dòng. Mọi internal tool > 100 dòng đều viết bằng Go.
- **Production mindset:** Cost, Security, Observability, Reliability, Scalability song song từ ngày đầu.
- **1 Project xuyên suốt 12 tháng:** **"ShopMaster"** — Production E-commerce Platform, được nâng cấp dần qua từng phase.

---

## 2. PROJECT XUYÊN SUỐT: **"ShopMaster" — Production E-commerce Platform**

### Mô tả
Một nền tảng e-commerce thực tế gồm:
- **Frontend:** Next.js (S3 + CloudFront, sau đó Pod trên EKS)
- **Backend:** 3–5 microservices viết Go (product, order, payment, notification, user)
- **Data:** PostgreSQL (RDS), Redis (ElastiCache), S3, DynamoDB
- **Async:** SQS, EventBridge, Kafka (MSK ở Q3)
- **Observability:** CloudWatch → Prometheus + Grafana + Tempo + Loki
- **Security:** IAM, KMS, Secrets Manager → Vault, OPA, Trivy, Falco
- **DevOps:** GitHub Actions → ArgoCD → Backstage IDP

### Tiến hoá qua các Phase

| Phase | ShopMaster nâng cấp |
|-------|---------------------|
| Q1 | v1: ECS Fargate + RDS + S3 + CloudFront. 100% Terraform. CI/CD GitHub Actions cơ bản. |
| Q2 | v2: EKS, Helm, Istio. Custom Operator quản lý feature flag. Custom Terraform Provider quản lý nội bộ. |
| Q3 | v3: ArgoCD GitOps, Vault, OPA policies, Trivy scan, SLSA L3, Falco runtime. |
| Q4 | v4: Multi-region active-active, Backstage IDP, Crossplane self-service, FinOps dashboard, chaos engineering. |

### Repo Structure đề xuất (mono-ish)
```
shopmaster/
├── infra/                  # Terraform
│   ├── modules/            # reusable modules
│   ├── envs/{dev,stg,prod}/
│   └── providers/          # custom TF provider (Q2+)
├── services/               # Go microservices
│   ├── product/
│   ├── order/
│   ├── payment/
│   └── ...
├── tools/                  # Internal Go tools
│   ├── shopctl/            # CLI để quản lý platform
│   ├── cost-optimizer/
│   ├── compliance-scanner/
│   └── deployment-manager/
├── operators/              # Kubernetes operators (Go + kubebuilder)
├── platform/               # IDP (Backstage, Crossplane, ArgoCD configs)
├── policies/               # OPA/Rego
└── .github/workflows/      # CI/CD
```

---

## 3. CORE SKILLS MAP (12 tháng)

### 🧱 Infrastructure as Code (Terraform / OpenTofu)
- **Tháng 1–2:** Syntax, providers, state, modules cơ bản.
- **Tháng 3:** Module design patterns, remote state (S3 + DynamoDB), workspaces vs envs/ folder.
- **Tháng 4–6:** terraform-aws-modules ecosystem, testing với Terratest + tflint + checkov, dynamic blocks, for_each patterns.
- **Tháng 7–9:** Atlantis/Terraform Cloud/Spacelift, drift detection, policy as code (OPA, Sentinel, Conftest).
- **Tháng 10–12:** **Viết Custom Terraform Provider bằng Go**, Terragrunt, Terranetes, OpenTofu features mới.

### 🐹 Golang for DevOps
- **Tháng 1–3:** Syntax, packages, error handling, goroutines, context, viết CLI bằng `cobra`/`urfave/cli`, làm việc với JSON/YAML, AWS SDK v2.
- **Tháng 4–6:** REST API với `chi`/`gin`, gRPC, controller-runtime, kubebuilder, write Kubernetes Operator.
- **Tháng 7–9:** Test (table-driven, testify, gomock), benchmarking, profiling (pprof), viết admission webhooks, scanner tools.
- **Tháng 10–12:** Production microservices (clean architecture), custom Terraform provider, internal platform services, performance optimization.

### ☁️ AWS
- Compute: EC2, ECS, Fargate, EKS, Lambda
- Network: VPC, TGW, PrivateLink, ALB/NLB, Route53, CloudFront, Global Accelerator
- Data: RDS, Aurora, DynamoDB, ElastiCache, S3, OpenSearch
- Async: SQS, SNS, EventBridge, Kinesis, MSK
- Security: IAM (deep), KMS, ACM, Secrets Manager, GuardDuty, Security Hub, Config, WAF
- Observability: CloudWatch, X-Ray, OpenTelemetry on AWS
- FinOps: Cost Explorer, Compute Optimizer, Savings Plans, Tag Policies
- Governance: Organizations, Control Tower, SCPs, AFT (Account Factory for Terraform)

### ☸️ Kubernetes & Cloud Native
- Core objects, RBAC, NetworkPolicy
- Helm, Kustomize
- EKS Auto Mode, Karpenter, Cluster Autoscaler
- Istio / Linkerd, Cilium, Gateway API
- Argo CD, Argo Rollouts, Argo Workflows
- Custom Resources, Operators, Webhooks
- KEDA, External Secrets, cert-manager

### 🔐 DevSecOps
- SAST (Semgrep), DAST, SCA (Trivy, Grype, Snyk)
- Secret scanning (gitleaks, trufflehog)
- SBOM (Syft) + Sigstore/Cosign signing, SLSA framework
- Runtime: Falco, Tetragon
- Policy: OPA/Gatekeeper, Kyverno
- Compliance: CIS, PCI-DSS, SOC 2 mapping

### 🔄 GitOps & CI/CD
- GitHub Actions advanced, reusable workflows, OIDC to AWS
- Argo CD App-of-Apps, ApplicationSets
- Progressive delivery (Argo Rollouts: canary, blue/green)
- Tekton, Buildkite (awareness)

### 📊 Observability
- Metrics: Prometheus + Thanos / Mimir, Grafana
- Logs: Loki / OpenSearch
- Traces: Tempo / Jaeger, OpenTelemetry SDK in Go
- SLO/SLI/Error budgets, Sloth

### 💰 FinOps
- Cost allocation tags, Cost & Usage Reports (CUR) + Athena
- Savings Plans / RIs strategy
- Right-sizing pipeline (Compute Optimizer + custom Go tool)
- Kubernetes cost visibility (OpenCost / Kubecost)

### 🏗️ Platform Engineering
- Backstage (TechDocs, Templates, Catalog)
- Crossplane v2 + Compositions
- Self-service portals, Golden Paths
- DORA metrics implementation

---

## 4. MILESTONES & DELIVERABLES (Tổng kết theo phase)

### ✅ End of Phase 1 (Tháng 3)
- ShopMaster v1 live trên AWS, 100% Terraform.
- Repo `shopmaster-infra` với 10+ Terraform modules tái sử dụng.
- 3 Go CLI tools: `shopctl init`, `shopctl deploy`, `shopctl cost-report`.
- AWS Certified Solutions Architect Associate (SAA-C03) **PASS** (hoặc đang thi).
- HashiCorp Terraform Associate (003) **PASS**.
- Portfolio: GitHub repo + README chi tiết + diagram + cost breakdown.

### ✅ End of Phase 2 (Tháng 6)
- ShopMaster v2 chạy trên EKS với Istio + Karpenter.
- 1 Custom Kubernetes Operator (Go + kubebuilder) — ví dụ FeatureFlagOperator.
- 1 Custom Terraform Provider quản lý nội bộ (ví dụ provider quản lý feature flags hoặc internal API).
- Helm chart + Kustomize overlays cho 3 môi trường.
- Certified Kubernetes Administrator (**CKA**) **PASS** hoặc CKAD.
- AWS Certified DevOps Pro (DOP-C02) chuẩn bị.

### ✅ End of Phase 3 (Tháng 9)
- ShopMaster v3: GitOps hoàn chỉnh (ArgoCD), progressive delivery, signed images, SBOM.
- Vault tích hợp với EKS qua agent injector + External Secrets.
- Compliance scanner Go tool (quét AWS + K8s + repos, xuất report).
- SLSA Level 3 supply chain.
- AWS DevOps Pro **PASS**.
- CKS (Certified Kubernetes Security Specialist) **PASS** hoặc chuẩn bị.

### ✅ End of Phase 4 (Tháng 12)
- ShopMaster v4 active-active 2 region, RTO < 5 phút.
- Internal Developer Platform (Backstage) với 5+ software templates.
- Crossplane Compositions cho 3+ resource types.
- 4 Go production services internal: cost-optimizer, deployment-manager, compliance-scanner, platform-api.
- DORA metrics dashboard.
- Portfolio polish + LinkedIn rebrand + 5–10 blog posts kỹ thuật + apply Mid/Senior DevOps role.

---

## 5. WEEKLY TIME ALLOCATION TEMPLATE (6–8h/ngày)

| Hoạt động | Tỉ lệ | Ghi chú |
|----------|------|---------|
| **Hands-on lab/build (Terraform + Go)** | 50% | Code thật, deploy thật, debug thật |
| **Đọc tài liệu/Docs/RFC/Source code** | 15% | AWS docs, Terraform docs, K8s docs, đọc source code OSS |
| **Khoá học video/course** | 15% | Có chọn lọc, không xem thụ động |
| **Viết blog/note (Zettelkasten)** | 10% | Học bằng cách viết lại |
| **Cộng đồng + AI pair programming** | 10% | Discord, Reddit r/devops, Claude/Cursor pair |

**Rule of thumb:** Mỗi concept học xong phải **code ra một artifact** (Terraform module hoặc Go program) — không có "học chay".

---

## 6. AI-ASSISTED LEARNING STRATEGY (Claude / Cursor / Copilot)

### Mindset
- AI là **pair programmer**, không phải Google. Hỏi để hiểu, không chỉ để copy.
- Luôn yêu cầu AI **giải thích "tại sao"** chứ không chỉ "cái gì".
- Sau mỗi tuần, dùng AI để **stress-test kiến thức**: AI hỏi mình, mình trả lời.

### Prompt patterns sẽ dùng xuyên suốt
1. **Concept explainer:** "Giải thích {concept} ở 3 levels: ELI5, junior dev, senior architect. Đưa ra 2 anti-patterns."
2. **Code review:** "Review Terraform module sau theo best practices 2026. Tìm security issues, cost issues, maintainability issues. Đề xuất refactor cụ thể."
3. **Debugging partner:** "Đây là error: {...}. Đây là code: {...}. Đặt 5 câu hỏi để chẩn đoán root cause trước khi đề xuất fix."
4. **Architecture sparring:** "Tôi đang thiết kế {X}. Liệt kê 3 phương án, so sánh trade-off (cost, complexity, scale). Bạn recommend phương án nào và tại sao?"
5. **Quiz me:** "Tạo 10 câu hỏi technical phỏng vấn DevOps Mid-Senior về {topic}. Đợi tôi trả lời từng câu rồi mới phản hồi."

---

## 7. RESOURCES STACK (Mua/đăng ký một lần dùng cả năm)

### Bắt buộc
- **AWS:** Tài khoản cá nhân + Budget alert $50/tháng (dùng nimbus.aws hoặc LocalStack khi có thể).
- **HashiCorp Learn** (free) + **Terraform Cloud free tier**.
- **GitHub** (free) + **GitHub Actions** minutes.
- **Killer.sh / KodeKloud** cho CKA/CKAD/CKS practice.
- **A Cloud Guru / Cloud Academy / Adrian Cantrill courses** (Cantrill cho AWS deep dive — cực mạnh).

### Sách must-read (đọc xong trong 12 tháng)
1. *Terraform: Up & Running* — Yevgeniy Brikman (3rd ed.)
2. *The Terraform Book* — James Turnbull (advanced patterns)
3. *Learning Go* — Jon Bodner (2nd ed.)
4. *100 Go Mistakes and How to Avoid Them* — Teiva Harsanyi
5. *Kubernetes Up & Running* — Hightower (3rd ed.)
6. *Programming Kubernetes* — Hausenblas & Schimanski
7. *Site Reliability Engineering* — Google (free)
8. *The DevOps Handbook* — Kim, Humble, Debois (2nd ed.)
9. *Cloud FinOps* — O'Reilly (2nd ed.)
10. *Team Topologies* — Skelton & Pais

### Channels / Newsletters
- **Last Week in AWS** (Corey Quinn)
- **DevOps Weekly**
- **Golang Weekly**
- **CNCF Newsletter**
- YouTube: **TechWorld with Nana, Marcel Dempers, Mischa van den Burg, Anton Putra, Ardan Labs (Go), Adrian Cantrill**

---

## 8. CERTIFICATIONS PATH

| Tháng | Cert | Bắt buộc? | Note |
|-------|------|-----------|------|
| 3 | AWS SAA-C03 | ⭐ Strongly recommended | Foundation |
| 3 | HashiCorp Terraform Associate (003) | ⭐ Recommended | Phổ biến trong JD |
| 6 | CKA | ⭐ Strongly recommended | Bắt buộc cho EKS roles |
| 6–7 | AWS DevOps Pro (DOP-C02) | Recommended | High signal |
| 9 | CKS | Optional but high value | Cho security track |
| 12 | KCNA / KCSA (CNCF) | Optional | Nice-to-have |

> **Lưu ý:** Cert không thay thế portfolio. **Repo trên GitHub là CV thật.** Cert chỉ pass filter ATS.

---

## 9. PORTFOLIO STRATEGY (Tạo signal mạnh khi apply)

Cuối tháng 12, bạn phải có:

1. **GitHub Profile chuẩn:**
   - Pinned: `shopmaster-infra`, `shopmaster-services`, `shopmaster-platform`, `terraform-provider-shopmaster`, `shopmaster-operator`.
   - README profile với architecture diagrams, tech stack badges, blog links.
2. **Blog (Hashnode/dev.to/medium):**
   - 1–2 bài/tháng = 10–15 bài tổng. Topic: deep-dive Terraform, Go DevOps tooling, EKS cost optimization, GitOps pitfalls, FinOps wins.
3. **LinkedIn:**
   - Tiêu đề: "DevOps Engineer | AWS · Terraform · Go · Kubernetes". Featured: GitHub + blog.
4. **Architecture diagrams:**
   - Sử dụng `excalidraw`, `draw.io`, hoặc `diagrams.py` (Go-equivalent: dùng `goplantuml`).
5. **Loom videos (5 phút):**
   - Demo 2–3 tools Go bạn viết, demo deploy ShopMaster end-to-end.

---

## 10. ANTI-PATTERNS — TRÁNH NGAY TỪ ĐẦU

1. ❌ **"Tutorial hell":** Xem video 8h/ngày, không code → vô dụng. Code phải > Đọc.
2. ❌ **Click ConsoleOps:** Tạo resource bằng tay trên AWS Console → ngay tháng 1 phải bỏ.
3. ❌ **Học Kubernetes trước AWS networking:** VPC/IAM yếu thì EKS sẽ thảm hoạ. Q1 hoàn thiện AWS trước.
4. ❌ **Bash mọi thứ:** Bash script > 100 dòng = nợ kỹ thuật. Viết Go.
5. ❌ **Terraform monolith state:** 1 state cho toàn bộ infra → vỡ trận. Học state splitting từ tháng 2.
6. ❌ **Không tag cost:** Bị bill $500 tháng đầu vì quên dừng EKS. Setup Budget Alarm + cron `shopctl destroy-dev` từ tuần 1.
7. ❌ **Không có observability từ đầu:** Q1 đã phải có CloudWatch dashboards + alarms cho mọi service.
8. ❌ **Học framework trước fundamental:** Học Helm trước khi hiểu `kubectl apply` raw YAML → debug hell.
9. ❌ **Skip security:** "Để sau" = không bao giờ làm. IAM least privilege từ ngày 1.
10. ❌ **Không viết blog/note:** Học rồi quên. Forced writing = forced understanding.

---

## 11. WEEKLY RITUAL (Áp dụng từ Tuần 1)

- **Thứ Hai:** Đọc lại roadmap tuần, viết 3 mục tiêu cụ thể có DoD (Definition of Done).
- **Thứ Ba–Sáu:** Code + lab + đọc docs. Commit lên GitHub mỗi ngày.
- **Thứ Bảy AM:** Review tuần: blog post (500–1000 từ), update note.
- **Thứ Bảy PM:** AI quiz tự test (10 câu/tuần).
- **Chủ nhật:** Nghỉ hoặc đọc sách nhẹ.

**Tracking:** Notion/Obsidian với template tuần. Theo dõi:
- Số commit, số PR, số resource trên AWS (đã destroy chưa).
- Số $ chi trên AWS (target < $50/tháng).
- Số bài blog, số bài đã đọc.

---

## 12. BUDGET (Cá nhân, 12 tháng)

| Khoản | Chi phí ước tính |
|------|------------------|
| AWS labs (sau credit) | $30–60/tháng × 12 = $400–700 |
| Courses (Cantrill + KodeKloud + 1 Go) | $300–500 (one-time) |
| Sách kỹ thuật (10 cuốn) | $200–300 |
| Certs (SAA + TF + CKA + CKS + DevOps Pro) | $1000–1400 |
| Domain + SaaS nhỏ (Hashnode pro tuỳ chọn) | $50 |
| **Tổng** | **~$2000–3000 cho 12 tháng** |

> **Tip giảm cost:** Dùng LocalStack/k3d/kind/minikube cho lab local. Dùng AWS Free Tier triệt để. Spin-up + tear-down mỗi ngày bằng `shopctl up` / `shopctl down` (Go CLI tự viết).

---

## 13. SUCCESS METRICS (Bạn đang đi đúng đường nếu…)

- [ ] Tuần nào cũng có ≥ 5 commits xanh trên GitHub.
- [ ] Mỗi tháng có ≥ 1 blog post chi tiết.
- [ ] Cuối Q1: bạn có thể tự stand up một 3-tier AWS app bằng Terraform trong < 1 giờ.
- [ ] Cuối Q2: bạn có thể giải thích chi tiết các thành phần của EKS Auto Mode + viết 1 simple operator.
- [ ] Cuối Q3: bạn có thể design pipeline SLSA L3 end-to-end và giải thích từng bước.
- [ ] Cuối Q4: bạn có thể nói chuyện với 1 Engineering Manager về Platform Engineering 30 phút mà không bí.
- [ ] Bạn có ít nhất 1 contribution vào open source (Terraform module hoặc Go tool).

---

## 14. TIẾP THEO

Mở các file:
- `02_PHASE1_AWS_TERRAFORM_DEEP_DIVE_Q1.md` — Bắt đầu **Tuần 1** ngay.
- `03_PHASE2_KUBERNETES_EKS_GOLANG_Q2.md`
- `04_PHASE3_DEVSECOPS_GITOPS_ADVANCED_Q3.md`
- `05_PHASE4_PLATFORM_ENGINEERING_GOLANG_SENIOR_Q4.md`

> **Cam kết:** In file này ra dán lên tường. Tick từng milestone. 365 ngày sau, bạn là DevOps Engineer thực thụ. 🚀
