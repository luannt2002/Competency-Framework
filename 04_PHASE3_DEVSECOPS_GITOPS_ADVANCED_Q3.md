# 🟠 PHASE 3 — Q3 (Tháng 7–9)
## DevSecOps + GitOps + Advanced CI/CD + Golang Security & Compliance Tooling

> **Output cuối phase:** ShopMaster v3 — GitOps end-to-end với ArgoCD, supply chain SLSA L3, Vault, OPA/Kyverno policy-as-code, runtime security với Falco, compliance scanner Go tool. AWS DevOps Pro + CKS pass/in-progress.

---

## 🎯 PHASE OVERVIEW

### Mục tiêu
1. Vận hành **GitOps thực thụ** (Argo CD App-of-Apps + ApplicationSets + progressive delivery).
2. Implement **supply chain security** SLSA L3: hermetic build, provenance, signed artifacts (Cosign), SBOM (Syft), policy at admission (Kyverno verify-images).
3. Secret management production: **HashiCorp Vault** + External Secrets Operator.
4. Runtime security: **Falco** + Tetragon awareness, audit logs.
5. Policy as Code đầy đủ: **OPA/Conftest** cho Terraform, Kyverno cho K8s, AWS Config Rules.
6. Build **Compliance Scanner** Go tool quét: AWS misconfig (CIS), K8s misconfig (CIS), repo (gitleaks/Trivy SBOM).
7. **AWS DevOps Pro** cert + **CKS** cert.

### Outcome
- ShopMaster v3 deploy 100% qua GitOps (no kubectl apply in CI).
- Mọi container image được sign + verify ở admission.
- Mọi Terraform PR đi qua Conftest policy gate.
- Compliance dashboard scan hàng ngày, gửi report.
- Vault dynamic secrets cho RDS, app obtain creds qua sidecar / CSI driver.
- Pipeline DORA metrics tracked: deployment frequency, lead time, MTTR, change failure rate.

### Production Readiness Target (Phase 3 Exit)
| Aspect | Target |
|--------|--------|
| Supply chain | SLSA L3 — signed + provenance + SBOM published |
| Admission | All images verified by Kyverno; unsigned blocked |
| Secrets | Zero static secrets in K8s; Vault dynamic |
| Runtime | Falco rules + SIEM forward |
| Drift | Argo CD auto-detect + alert; Terraform drift cron |
| Compliance | CIS K8s Benchmark > 90%, CIS AWS Foundations > 90% |
| DORA | Deployment frequency ≥ daily, lead time < 1 day, MTTR < 1h, CFR < 15% |

---

## 🛠️ CORE KEY SKILLS PHASE 3

### GitOps & CI/CD
- Argo CD: Applications, AppProjects, ApplicationSets, App-of-Apps, sync waves, hooks.
- Argo Rollouts: canary, blue/green, analysis templates, experiments.
- Argo Workflows / Tekton (awareness).
- GitHub Actions advanced: reusable workflows, composite actions, matrix, environments.
- Renovate / Dependabot for image + chart bumps.
- Image updater: Argo CD Image Updater or Argo CD Promoter.

### DevSecOps
- SAST: **Semgrep** (rules tuning), **CodeQL** (GitHub native).
- SCA: **Trivy**, **Grype**, **Snyk** (compare).
- Secret scanning: **gitleaks**, **trufflehog**, **GitHub Secret Scanning**.
- SBOM: **Syft** (CycloneDX + SPDX).
- Container scan: Trivy + Grype.
- Sign + verify: **Sigstore (Cosign)**, keyless OIDC.
- Provenance: **SLSA** (Build L3), in-toto.
- Policy: **OPA/Rego**, **Conftest**, **Kyverno**.
- Runtime: **Falco** + Falco rules, **Tetragon** (eBPF).
- Vulnerability mgmt workflow (triage, fix SLAs, exceptions).

### Vault
- Server architecture, seal/unseal, auto-unseal AWS KMS.
- Auth methods: Kubernetes auth, AWS IAM auth, OIDC.
- Secret engines: kv-v2, database, AWS, PKI, transit.
- Dynamic database creds, lease + rotation.
- External Secrets Operator integration.
- Vault CSI driver alternative.

### Go DevSecOps Tooling
- Building scanners (parse Terraform plan JSON, K8s resources, AWS APIs).
- Integrating with cosign, syft, trivy as libraries.
- Generating reports (HTML/JSON/SARIF).
- Webhook server in Go for policy enforcement.

---

## 📅 WEEKLY BREAKDOWN — 12 WEEKS

---

### 🗓️ **WEEK 25 — Argo CD Foundation + GitOps Mindset**

#### Main Topics
- GitOps principles: declarative, versioned, automated, observable.
- Argo CD architecture (server, repo server, application controller, redis).
- Applications, Projects, RBAC.
- Sync strategies (manual vs auto), self-heal, prune.

#### Core Knowledge & Key Concepts
- Pull-based deployment > push-based CI.
- App-of-Apps pattern.
- Sync waves & hooks.
- `kubectl apply` vs `argocd app sync` ownership.

#### Hands-on Projects / Labs
**Lab 25.1: Install Argo CD via Terraform**
- Helm provider in Terraform installs Argo CD on EKS dev.
- TLS via cert-manager.
- SSO via GitHub OAuth.

**Lab 25.2: Migrate ShopMaster to Argo CD**
- Repo `shopmaster-gitops/` with structure:
  - `apps/dev/`, `apps/stg/`, `apps/prod/` (Argo CD Applications).
  - `manifests/{product,order,payment}/` (Helm or Kustomize).
- App-of-Apps root in each env.

**Lab 25.3: Sync verification**
- Make a change in manifest, observe auto-sync.
- Test self-heal: `kubectl edit` directly → revert to git.

#### AI-Assisted Tasks
- Prompt: *"Design App-of-Apps pattern cho 5 services × 3 envs. Show folder structure + 1 sample root Application. Include RBAC AppProject."*

#### Resources
- argo-cd.readthedocs.io.
- Book: *GitOps and Kubernetes* — Manning.

#### Milestone & Deliverables
- [ ] Argo CD live on EKS dev.
- [ ] ShopMaster 5 services synced via Argo CD.
- [ ] CI no longer does `kubectl apply` — only builds & pushes images.

---

### 🗓️ **WEEK 26 — Progressive Delivery: Argo Rollouts + Analysis**

#### Main Topics
- Argo Rollouts: canary, blue/green strategies.
- AnalysisTemplate, AnalysisRun.
- Experiments.
- Service mesh integration (Istio for canary traffic split).

#### Core Knowledge & Key Concepts
- Canary steps + weights + pause.
- Metric-driven promotion (Prometheus query as gate).
- Rollback automatic on metric breach.

#### Hands-on Projects / Labs
**Lab 26.1: Canary for `product`**
- Replace Deployment with Rollout.
- Steps: 10% → analysis 5min → 50% → analysis → 100%.
- AnalysisTemplate: error rate < 1% (Prom query).

**Lab 26.2: Blue/Green for `payment`** (payment = high risk)
- Active/preview services, manual promotion.

**Lab 26.3: Chaos: bad image → auto rollback**
- Push image that panics on startup → observe Rollout abort + auto rollback.

#### AI-Assisted Tasks
- Prompt: *"Write AnalysisTemplate testing p99 latency < 200ms (Prom) + 5xx rate < 0.5% (Loki) cho service X. Detailed YAML."*

#### Resources
- argoproj.github.io/rollouts.

#### Milestone & Deliverables
- [ ] Canary deploy successful in dev.
- [ ] Auto-rollback on synthetic failure demonstrated.

---

### 🗓️ **WEEK 27 — Supply Chain Security: SBOM, Sign, Verify (Sigstore)**

#### Main Topics
- SBOM with Syft (CycloneDX, SPDX).
- Image signing with Cosign keyless (OIDC via GitHub).
- Verification at admission via Kyverno `verifyImages`.
- SLSA Level 1 → 3 progression.

#### Core Knowledge & Key Concepts
- Sigstore Fulcio (CA) + Rekor (transparency log).
- Provenance attestation (`cosign attest`).
- Why SBOM: vuln correlation, license compliance.

#### Hands-on Projects / Labs
**Lab 27.1: SBOM in CI**
- GH Action: build → Syft generate SBOM → upload to GH artifact + push to OCI registry (`oras`).

**Lab 27.2: Cosign sign keyless**
- After ECR push, `cosign sign --yes <digest>` with GH OIDC.
- Verify locally `cosign verify`.

**Lab 27.3: Kyverno verify-images policy**
- Cluster policy: only allow images signed by GH org identity `*@github.com/yourorg/*` from `ecr/shopmaster/*`.
- Unsigned image → admission deny.

#### AI-Assisted Tasks
- Prompt: *"Walk me through SLSA L3 build provenance: what artifacts, where stored, how verified, integration với GH Actions + Cosign. Concrete example."*

#### Resources
- slsa.dev specification.
- sigstore.dev.

#### Milestone & Deliverables
- [ ] All ShopMaster images signed + SBOM published.
- [ ] Kyverno blocks unsigned images.
- [ ] SLSA L2 achieved (provenance + immutability).

---

### 🗓️ **WEEK 28 — HashiCorp Vault Setup + Integration**

#### Main Topics
- Vault server architecture, HA, auto-unseal AWS KMS.
- Auth methods: Kubernetes, AWS IAM.
- Secret engines: kv-v2, database (Postgres dynamic), AWS (dynamic IAM).
- External Secrets Operator (ESO) with Vault provider.

#### Core Knowledge & Key Concepts
- Dynamic vs static secrets.
- Lease + TTL + revoke.
- Vault namespaces (Enterprise) vs OSS.
- Vault Agent vs CSI driver vs ESO (decision matrix).

#### Hands-on Projects / Labs
**Lab 28.1: Vault on EKS (OSS) via Helm + Terraform**
- HA 3-node, KMS auto-unseal.
- Bootstrap script (Go: `shopctl vault bootstrap`) initializes & stores root token in 1Password (or secure local for lab).

**Lab 28.2: Kubernetes auth + ESO**
- Configure Vault Kubernetes auth for EKS.
- Install ESO.
- Migrate `product` DB credentials to Vault → ESO → Secret.

**Lab 28.3: Dynamic RDS creds**
- Vault database secret engine for ShopMaster RDS.
- `order` service uses lease-rotated credentials (refresh every 1h).

#### AI-Assisted Tasks
- Prompt: *"Compare External Secrets Operator vs Vault CSI Driver vs Vault Agent Sidecar Injector. Cho 3 use cases: legacy app, modern microservice, batch job. Recommend cho từng case."*

#### Resources
- vault docs (developer.hashicorp.com/vault).
- external-secrets.io.

#### Milestone & Deliverables
- [ ] Vault HA on EKS, auto-unseal working.
- [ ] At least 1 service uses Vault dynamic secrets.
- [ ] No more static DB password in K8s secrets.

---

### 🗓️ **WEEK 29 — Policy as Code: OPA/Conftest cho Terraform + Kyverno cho K8s**

#### Main Topics
- OPA Rego language fundamentals.
- Conftest for Terraform plan JSON.
- Kyverno mutate + validate + generate.
- AWS Config Rules + Custom Lambda Go.

#### Core Knowledge & Key Concepts
- Rego: rules, partial eval, deny vs allow patterns.
- Conftest unit testing.
- Kyverno `verifyImages`, `validate.deny`, `mutate.patchStrategicMerge`.

#### Hands-on Projects / Labs
**Lab 29.1: Conftest gating Terraform PRs**
- Policies:
  - Deny S3 bucket without encryption.
  - Deny Security Group `0.0.0.0/0` on port != 80/443.
  - Require tag `CostCenter`, `Owner`, `Environment`.
  - Deny `aws_instance` < `t3.micro` whitelist.
- GH Action: `terraform plan -out=tfplan.bin && terraform show -json tfplan.bin > plan.json && conftest test plan.json`.
- Policy tests: `policies/*_test.rego` with sample plans.

**Lab 29.2: Kyverno enterprise baseline**
- 10 cluster policies covering: image registry allowlist, signed images, resource limits, network policy required, no privileged, runAsNonRoot, etc.

**Lab 29.3: AWS Config Rules (Go Lambda)**
- Custom rule: tag compliance for EC2 + ECS task definitions.
- Go Lambda code (`lambda-go`), Terraform-deployed.

#### AI-Assisted Tasks
- Prompt: *"Write OPA Rego policies for Terraform plan ensuring: KMS encryption everywhere, no public S3, no inline IAM policies, all RDS multi-AZ in prod. Include unit tests."*

#### Resources
- openpolicyagent.org docs.
- kyverno.io policies library.

#### Milestone & Deliverables
- [ ] Conftest blocks bad Terraform PRs.
- [ ] Kyverno enforce mode in dev/stg, audit in prod.
- [ ] Custom AWS Config rule deployed.

---

### 🗓️ **WEEK 30 — Runtime Security: Falco + Audit Logs + SIEM Forward**

#### Main Topics
- Falco architecture (kernel module / eBPF probe / modern eBPF).
- Falco rules language.
- Audit logs (K8s API audit, AWS CloudTrail).
- Centralizing security events: SIEM (e.g., Splunk-lite via OpenSearch).

#### Core Knowledge & Key Concepts
- Detection vs prevention.
- MITRE ATT&CK for Containers.
- Falco Talon (auto-response, awareness).

#### Hands-on Projects / Labs
**Lab 30.1: Falco install + custom rules**
- DaemonSet on EKS.
- Custom rules: detect `kubectl exec` to prod pod, detect process running shell in container, detect modification of `/etc/passwd`.

**Lab 30.2: Falco Sidekick → OpenSearch**
- Forward events to OpenSearch (Terraform-provisioned).
- Dashboard: top alerts, by namespace.

**Lab 30.3: Red team self-test**
- Run `kubectl exec` into `product` pod, run `nc -lvp 4444` — expect alert.
- Document findings.

#### AI-Assisted Tasks
- Prompt: *"Viết 5 Falco rules production cho EKS phòng ngừa: crypto miner, reverse shell, secret access from non-app pod, container drift (writes to image), suspicious DNS."*

#### Resources
- falco.org docs.

#### Milestone & Deliverables
- [ ] Falco running on all nodes.
- [ ] 10+ alerts triggered during red-team simulation, all forwarded to OpenSearch.

---

### 🗓️ **WEEK 31 — Go Compliance Scanner — Tool #4 (Major Project)**

#### Main Topics
- Building a Go scanner that audits: AWS account, EKS cluster, GitHub repos.
- Integrating with `aws-sdk-go-v2`, `kubernetes/client-go`, `google/go-github`.
- Outputs: SARIF (GitHub code scanning), HTML, JSON, slack notification.

#### Core Knowledge & Key Concepts
- CIS AWS Foundations Benchmark checks.
- CIS K8s Benchmark.
- Severity scoring (CVSS lite).
- Idempotent scan runs, diff against baseline.

#### Hands-on Projects / Labs
**Tool #4: `shopscan` (Go)**
- Repo `shopmaster-tools/shopscan`.
- Architecture: plugin-based (each check is a plugin).
- Checks day 1:
  - AWS: S3 public, RDS public, SG 0.0.0.0/0 unusual ports, IAM users without MFA, root key active, EBS unencrypted, CloudTrail enabled.
  - K8s: pods running as root, no resource limits, default service account used, RBAC overly permissive.
  - GitHub: secret scanning, branch protection, signed commits required.
- CLI: `shopscan run --target aws,k8s,github --output sarif --slack-webhook ...`.

#### AI-Assisted Tasks
- Prompt: *"Design plugin architecture in Go (interface + registry pattern) cho security scanner. Show interface, 1 sample plugin (S3 public check), main runner with concurrency (errgroup)."*
- Prompt: *"Generate SARIF v2.1.0 JSON for findings: list 3 sample findings. Validate against schema."*

#### Resources
- aws-sdk-go-v2.
- client-go examples.
- sarifv2 spec.

#### Milestone & Deliverables
- [ ] `shopscan` v0.1.0 with ≥ 15 checks across 3 targets.
- [ ] CI integration: nightly scan, post SARIF to GitHub Security tab.
- [ ] Slack alert on new HIGH/CRITICAL.

---

### 🗓️ **WEEK 32 — Advanced GitHub Actions + DORA Metrics**

#### Main Topics
- Reusable workflows, composite actions, environments + approvals.
- Caching strategies (`actions/cache`).
- Self-hosted runners on EKS (Actions Runner Controller).
- DORA metrics implementation.

#### Core Knowledge & Key Concepts
- DORA 4 keys: deployment frequency, lead time for changes, change failure rate, MTTR.
- Tools: Four Keys (Google), Sleuth, in-house Go.

#### Hands-on Projects / Labs
**Lab 32.1: Refactor workflows**
- Single reusable `workflow_call` for service build/test/scan/sign/push.
- Each service workflow `workflow_call` to it.
- Composite action `setup-go-with-cache`.

**Lab 32.2: Self-hosted runners (ARC)**
- Install Actions Runner Controller on EKS.
- Scale-to-zero with KEDA.

**Lab 32.3: DORA Go service**
- `tools/dora-collector/` (Go): listens to GH webhooks (push, deployment, incident) + Argo CD events.
- Computes 4 metrics, exposes Prom endpoint.
- Grafana dashboard.

#### AI-Assisted Tasks
- Prompt: *"Architect DORA metrics service Go: data model, ingestion sources, metric computation (sliding 30-day window), Prometheus exposition. Include Postgres schema."*

#### Resources
- DORA report (dora.dev).

#### Milestone & Deliverables
- [ ] DORA dashboard live with real data 30 days.
- [ ] ARC runners scale dynamically.

---

### 🗓️ **WEEK 33 — Disaster Recovery + Backup Strategy (RDS, EBS, S3, etcd)**

#### Main Topics
- Backup: AWS Backup, Velero (K8s).
- DR strategies: pilot light, warm standby, multi-region active-active (preview Phase 4).
- RTO/RPO targets.
- etcd backup (managed in EKS but understand).

#### Core Knowledge & Key Concepts
- RPO drives backup frequency; RTO drives architecture.
- Restore drills > backup count.
- Cross-account/cross-region replication for blast radius.

#### Hands-on Projects / Labs
**Lab 33.1: Velero on EKS**
- Backup namespaces to S3, schedule cron.
- Test restore: delete namespace, restore from backup → assert recovered.

**Lab 33.2: AWS Backup centralized**
- Org-level backup plan for RDS, EBS, S3 (Terraform).
- Cross-region copy to DR region.

**Lab 33.3: RDS PITR drill**
- Provision dummy RDS, write data, restore to point-in-time, verify.

#### AI-Assisted Tasks
- Prompt: *"Build a runbook: ShopMaster prod RDS corrupted at 14:32. Step-by-step restore. Include RTO breakdown, who decides, comms, validation."*

#### Resources
- velero.io.

#### Milestone & Deliverables
- [ ] Velero backup/restore drill complete with documented runbook.
- [ ] AWS Backup plan applied org-wide.

---

### 🗓️ **WEEK 34 — Cost Optimization (Pre-FinOps) + AWS DevOps Pro Prep**

#### Main Topics
- Cost allocation tags strategy.
- CUR + Athena queries.
- Savings Plans vs RIs.
- Kubernetes cost: OpenCost (CNCF).
- AWS DevOps Pro exam structure (75 questions, 180 min).

#### Hands-on Projects / Labs
**Lab 34.1: OpenCost on EKS**
- Install via Helm.
- Dashboard: cost per namespace, per service, per team.

**Lab 34.2: CUR Athena**
- Enable CUR daily Parquet.
- Athena queries: top 10 services by spend, idle EBS, unused EIPs.

**Lab 34.3: Cost optimizer Go tool (preview Q4)**
- `shopctl cost recommend`: parses Compute Optimizer recommendations + applies right-sizing diff to ASG/ECS task def (proposes, doesn't auto-apply).

#### Milestone & Deliverables
- [ ] OpenCost dashboards live.
- [ ] $ savings opportunities document (target: identify ≥ 20% reduction).

---

### 🗓️ **WEEK 35 — CKS Prep + Final Hardening**

#### Main Topics
- CKS exam topics: cluster setup, system hardening, microservice vulnerabilities, supply chain, runtime security.
- Final hardening of ShopMaster v3.

#### Hands-on Projects / Labs
**CKS practice**
- killer.sh CKS session.
- Drill: `apparmor`, `seccomp`, `falco rules`, `image policy webhook`.

**Hardening**
- Run `kube-bench` on EKS, fix all FAIL.
- Run `kube-hunter` on cluster.
- Run `cloudsploit` or `prowler` on AWS account.
- Address findings, document exceptions.

#### Milestone & Deliverables
- [ ] kube-bench ≥ 90% pass.
- [ ] Prowler critical = 0.
- [ ] CKS booked / passed.

---

### 🗓️ **WEEK 36 — Phase 3 Capstone + AWS DevOps Pro**

#### Main Topics
- AWS DevOps Pro exam.
- Phase 3 capstone polish.

#### Hands-on Projects / Labs
**Capstone**
- Demo Loom 10 phút: push code → CI → sign → ArgoCD canary → rollback simulation → compliance scan → DORA dashboard.
- Blog post: *"How I implemented SLSA L3 + GitOps on EKS with custom Go security tools"*.
- Update architecture diagrams.

#### Milestone & Deliverables
- [ ] AWS DevOps Pro PASS.
- [ ] (Optional) CKS PASS.
- [ ] Capstone artifacts published.
- [ ] Phase 3 retro.

---

## 🏆 END OF PHASE 3 ASSESSMENT & PORTFOLIO ITEMS

### Portfolio Artifacts
1. `shopmaster-gitops` repo — Argo CD manifests, App-of-Apps.
2. `shopmaster-tools/shopscan` — Go compliance scanner.
3. `shopmaster-tools/dora-collector` — Go DORA metrics service.
4. `shopmaster-policies` — OPA/Rego + Kyverno policies + tests.
5. Vault + ESO integration documented.
6. SLSA L3 documentation.
7. Certs: AWS DevOps Pro, (CKS optional).
8. Blog: 3 more posts (M7, M8, M9).

### Capstone Demo Requirements
- Push code → 12 minutes → canary deployed to dev → metric gate auto-promote → prod canary.
- Simulate vuln (high CVE in dependency) → scanner alerts → Renovate PR → fix merged → deployed.
- Simulate unsigned image push → admission denied → screenshot.
- DORA dashboard shows 30-day trend.

### Self-Assessment
1. Tôi có thể explain SLSA L3 + show pipeline implementing nó? (Y/N)
2. Tôi viết Rego policy không cần copy paste? (Y/N)
3. Vault dynamic secrets cho RDS hoạt động ổn định 1 tuần? (Y/N)
4. Falco bắt được simulated attack? (Y/N)
5. `shopscan` tool tìm ra ít nhất 5 finding thực sự trong ShopMaster? (Y/N)
6. DORA dashboard có data 30 ngày? (Y/N)
7. AWS DevOps Pro PASS? (Y/N)

> Cần **≥ 6/7 YES** trước khi sang Phase 4.

---

## ⚠️ COMMON PITFALLS — PHASE 3

| Pitfall | Triệu chứng | Cách tránh |
|---------|-------------|-----------|
| **CI pushing to K8s directly + Argo CD** | Drift, conflicts | CI builds & pushes image; Argo CD owns deploy |
| **Cosign keys leaked** | Compromised signing | Use keyless OIDC only |
| **Vault root token in git** | Catastrophic | Auto-unseal + revoke root after init |
| **Falco noise** | Alert fatigue | Tune rules, exclude legit patterns |
| **Kyverno enforce in prod first** | Outages | Always audit → fix → enforce pattern |
| **Conftest policies without tests** | Wrong policies pass | Always Rego unit tests |
| **Forget rotate dynamic secrets** | Stale leases | Build alerting on near-expiry leases |
| **GH Actions secrets for AWS** | Long-lived risk | OIDC only |
| **Scanner false positives ignored** | Real findings missed | Triage + exception register, not silence |
| **Rollouts without good metrics** | Bad canary promotes | Strong AnalysisTemplate first, then automate |

---

## ➡️ TIẾP THEO

Mở `05_PHASE4_PLATFORM_ENGINEERING_GOLANG_SENIOR_Q4.md` khi:
- [x] 12 tuần xong.
- [x] AWS DevOps Pro passed.
- [x] SLSA L3 evidence collected.
- [x] Compliance scanner running daily, < 5 critical open.

🚀 Final stretch incoming. Phase 4.
