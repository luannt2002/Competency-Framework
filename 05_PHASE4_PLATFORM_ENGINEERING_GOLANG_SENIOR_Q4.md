# 🔴 PHASE 4 — Q4 (Tháng 10–12)
## Platform Engineering + FinOps + Multi-Region HA + Golang Production Services (Senior Track)

> **Output cuối phase:** ShopMaster v4 multi-region active-active; Internal Developer Platform (Backstage + Crossplane + Argo CD + Go services); FinOps automation; Chaos engineering; **Sẵn sàng apply Mid-Senior DevOps role.**

---

## 🎯 PHASE OVERVIEW

### Mục tiêu
1. Xây dựng **Internal Developer Platform (IDP)** dùng Backstage + Crossplane + Go custom services.
2. Multi-region active-active cho ShopMaster (RTO < 5 phút, RPO < 1 phút).
3. FinOps end-to-end: showback/chargeback, auto right-sizing, anomaly detection.
4. Chaos engineering: Chaos Mesh / Litmus + game days.
5. Viết **4 Go production microservices** internal: cost-optimizer, deployment-manager, compliance-scanner upgrade, platform-api.
6. Senior-level soft skills: tech writing, presenting RFC, mentoring junior, on-call playbook.
7. Polish portfolio + apply Mid/Senior DevOps roles + interview prep.

### Outcome
- IDP gives developers self-service: `backstage scaffold new-service` → repo + CI + chart + dashboard auto.
- ShopMaster active-active 2 regions, traffic 50/50 via Route 53 + Global Accelerator.
- FinOps dashboard: % saved monthly, recommendations, automated actions where safe.
- Chaos game day every 2 weeks; runbooks updated from learnings.
- 5 Go production services running internal.

### Production Readiness Target (Phase 4 Exit)
| Aspect | Target |
|--------|--------|
| Multi-region | Active-active 2 regions, automated failover < 5 min |
| Data | Aurora Global, DynamoDB Global, S3 CRR |
| Platform | IDP with 5+ software templates, self-service > 80% requests |
| FinOps | 20–30% cost reduction vs Q3 baseline; tag coverage 100% |
| Chaos | Monthly game days, runbook coverage 90% |
| Docs | Architecture decision records (ADR) for every major decision |
| Hiring | Portfolio + 5 mock interviews + 5 applications submitted |

---

## 🛠️ CORE KEY SKILLS PHASE 4

### Platform Engineering
- Backstage: Catalog, TechDocs, Software Templates, plugins.
- Crossplane v2: Compositions, Providers, Functions (Composition Functions), Managed Resources.
- Self-service portals & Golden Paths.
- Team Topologies (Stream-aligned, Platform team, Enabling team).
- Platform as Product mindset, North Star metrics.

### Multi-region & HA
- Aurora Global Database.
- DynamoDB Global Tables.
- S3 Cross-Region Replication, S3 Multi-Region Access Points.
- Route 53 routing policies: latency, weighted, geolocation, failover.
- AWS Global Accelerator.
- Active-active vs active-passive trade-offs.

### FinOps
- Showback vs chargeback.
- Anomaly Detection (AWS Cost Anomaly Detection + custom Go).
- Reserved Capacity strategy (Savings Plans Compute > EC2 specific in 2026 for flexibility).
- Spot strategy at scale.
- Kubernetes-native cost (OpenCost / Kubecost).
- Sustainability (carbon footprint).

### Chaos Engineering
- Principles: Chaos Engineering, by Casey Rosenthal.
- Tools: Chaos Mesh (CNCF), Litmus, AWS Fault Injection Service.
- Game days, hypothesis-driven experiments.

### Go Production Services
- Clean Architecture, hex/onion structures.
- Database migrations (goose / migrate).
- Background workers, job queues (SQS, Asynq).
- Feature flags (LaunchDarkly OSS alternative — OpenFeature spec).
- Distributed tracing across services.

### Senior Soft Skills
- Writing RFCs (e.g., Squarespace style).
- ADRs (Architecture Decision Records).
- Incident commander basics.
- Mentoring + code reviewing.

---

## 📅 WEEKLY BREAKDOWN — 12 WEEKS

---

### 🗓️ **WEEK 37 — Platform Engineering Foundations + Backstage Install**

#### Main Topics
- Platform Engineering vs DevOps vs SRE.
- Backstage architecture (frontend + backend, plugins, catalog).
- Software catalog as code (`catalog-info.yaml`).
- TechDocs (MkDocs-based).

#### Core Knowledge & Key Concepts
- Backstage local dev: yarn workspace, plugins, backend system.
- AuthN/AuthZ Backstage (GitHub OAuth).
- Catalog entities: Component, System, Domain, API, Resource, User, Group.

#### Hands-on Projects / Labs
**Lab 37.1: Deploy Backstage on EKS**
- Fork `backstage/backstage`, customize org config.
- Helm chart (community `backstage`) install on EKS via Argo CD.
- Postgres backend via Vault dynamic creds.

**Lab 37.2: Register ShopMaster catalog**
- Add `catalog-info.yaml` to each service repo.
- `shopmaster-system.yaml` + `team-shopmaster-group.yaml`.
- Verify discovery in Backstage.

**Lab 37.3: TechDocs for `product` service**
- `mkdocs.yml` + `docs/` in repo.
- Backstage renders docs.

#### AI-Assisted Tasks
- Prompt: *"Compare Backstage vs Port vs Cortex (2026 state). For a 50-engineer org adopting platform engineering first time, which to choose and why. Give 3-month rollout plan."*

#### Resources
- backstage.io.
- Book: *Platform Engineering on Kubernetes* — Manning.

#### Milestone & Deliverables
- [ ] Backstage live, GitHub SSO.
- [ ] 5+ ShopMaster components in catalog.
- [ ] TechDocs rendering.

---

### 🗓️ **WEEK 38 — Backstage Software Templates + Scaffolder**

#### Main Topics
- Templates: scaffold a new repo + CI + chart + dashboard from form input.
- Cookiecutter-style with Backstage scaffolder actions.
- Custom scaffolder action plugin (Go bridge or TS).

#### Hands-on Projects / Labs
**Lab 38.1: Template "New Go Service"**
- Inputs: name, owner, port, has-db (bool).
- Generates:
  - Git repo from skeleton (clean architecture Go).
  - GH Actions workflow.
  - Helm chart.
  - Argo CD Application manifest.
  - Backstage catalog entry.
  - Grafana dashboard JSON.

**Lab 38.2: Template "New AWS Resource via Crossplane"** (preview W39).

#### AI-Assisted Tasks
- Prompt: *"Design Backstage Scaffolder template Go service: list inputs, files generated, post-create actions (PR creation, ArgoCD register). Show template.yaml."*

#### Milestone & Deliverables
- [ ] Template "New Go Service" works end-to-end: from form → repo + chart + ArgoCD app → running pod in 10 min.
- [ ] Loom recording of self-service flow.

---

### 🗓️ **WEEK 39 — Crossplane v2 + Compositions**

#### Main Topics
- Crossplane v2: Managed Resources, Compositions, Functions.
- Why Crossplane: K8s-native AWS provisioning + composition for golden paths.
- Provider AWS (Upbound official).
- Composition Functions (Go).

#### Core Knowledge & Key Concepts
- Crossplane vs Terraform: not replacement, complement. Crossplane shines for self-service abstractions ("give me a PostgreSQL").
- Compositions = abstraction.
- CompositeResourceDefinition (XRD) = API.

#### Hands-on Projects / Labs
**Lab 39.1: Install Crossplane**
- Helm + Terraform.
- Provider AWS installed with IRSA.

**Lab 39.2: First Composition: `PostgresInstance`**
- XRD with fields: size, multi_az, region.
- Composition creates: VPC subnet group + RDS + Secrets Manager + IAM role.
- Claim: `kind: PostgresInstance` → developer self-service.

**Lab 39.3: Composition Function (Go)**
- Write `function-set-tags` (Go template) auto-adding CostCenter, Env, Owner tags from claim labels.

#### AI-Assisted Tasks
- Prompt: *"Compare Terraform + AFT vs Crossplane for multi-tenant cloud resources. For 'developer asks for SQS queue' use case, which is better and why."*

#### Resources
- crossplane.io docs.

#### Milestone & Deliverables
- [ ] Crossplane installed.
- [ ] `PostgresInstance` Composition working: developer applies claim → RDS provisioned in 5 min.
- [ ] Composition Function (Go) applied tags.

---

### 🗓️ **WEEK 40 — Multi-Region Architecture Design**

#### Main Topics
- Active-active vs active-passive.
- Data replication: Aurora Global (sub-second), DynamoDB Global, S3 CRR.
- Traffic routing: Route 53 latency-based, weighted, Global Accelerator.
- Failover automation.

#### Core Knowledge & Key Concepts
- Split-brain risk in active-active.
- Stateful workloads coordination (use cell-based architecture awareness).
- Cost of multi-region (~1.5–2x).

#### Hands-on Projects / Labs
**Lab 40.1: Architecture Decision Record (ADR)**
- Write ADR-001: "ShopMaster Multi-Region Strategy" — choose active-active, justify, list trade-offs.

**Lab 40.2: Terraform multi-region modules**
- Refactor `envs/prod/` to support `regions = ["ap-southeast-1", "ap-southeast-2"]`.
- Provider aliases per region.
- Aurora Global cluster (primary + secondary).

**Lab 40.3: Route 53 + Health Checks**
- Latency routing with failover.
- Health checks on each region ALB.

#### AI-Assisted Tasks
- Prompt: *"Design active-active 2-region architecture cho e-commerce: data tier choice, write conflicts handling, traffic split. Vẽ ASCII diagram + list 5 failure modes + recovery plan."*

#### Resources
- AWS Well-Architected: Reliability Pillar.
- Book: *Architecting for Scale* (Lee Atchison).

#### Milestone & Deliverables
- [ ] ADR-001 published.
- [ ] Aurora Global cluster up.
- [ ] Both regions serve traffic (verify with `curl --resolve`).

---

### 🗓️ **WEEK 41 — Multi-Region Deployment + Failover Drill**

#### Main Topics
- Deploy EKS in both regions.
- Argo CD cluster-of-clusters pattern.
- Failover drill.

#### Hands-on Projects / Labs
**Lab 41.1: Secondary region EKS**
- Apply same Terraform with `region=ap-southeast-2`, separate state.

**Lab 41.2: Argo CD multi-cluster**
- Register both EKS clusters as Argo CD destinations.
- ApplicationSet generator deploys to both.

**Lab 41.3: Failover drill**
- Inject failure: stop ALB in region A (`aws elbv2 modify-listener`).
- Route 53 detects unhealthy → traffic shifts to B in < 2 min.
- Measure RTO, RPO, document.

**Lab 41.4: Aurora Global failover**
- Promote secondary cluster.
- Update app config / service discovery.

#### AI-Assisted Tasks
- Prompt: *"Write detailed failover runbook for ShopMaster active-active going to A-only mode: trigger criteria, steps, validations, rollback steps, comms template."*

#### Milestone & Deliverables
- [ ] Failover drill complete, < 5 min RTO observed.
- [ ] Runbook published in TechDocs.

---

### 🗓️ **WEEK 42 — Chaos Engineering: Chaos Mesh + Game Days**

#### Main Topics
- Chaos Engineering principles (steady state, hypothesis, minimize blast radius).
- Chaos Mesh CRDs: PodChaos, NetworkChaos, IOChaos, TimeChaos.
- AWS Fault Injection Service (FIS) for AWS-native faults.
- Game day formats.

#### Hands-on Projects / Labs
**Lab 42.1: Chaos Mesh on EKS**
- Install + dashboard.
- Experiments:
  - Kill 30% pods of `product` for 5 min → SLO breach?
  - Inject 200ms network latency `product → order` → cascade?
  - DNS failure for 1 min → fallback?

**Lab 42.2: AWS FIS scenario**
- Stop random EC2 in ASG, reboot RDS, throttle EBS.
- Observe Karpenter + RDS Multi-AZ behavior.

**Lab 42.3: First game day**
- Team scenario (you + maybe a friend / AI as ops): RDS primary fails at 14:00.
- Run actual fault injection, debug live, document.

#### AI-Assisted Tasks
- Prompt: *"Write 5 chaos experiments hypothesis-driven for ShopMaster: hypothesis, fault, expected steady-state, blast radius, abort conditions, success/failure criteria."*

#### Resources
- *Chaos Engineering* — Rosenthal & Jones.
- chaos-mesh.org.

#### Milestone & Deliverables
- [ ] 5 chaos experiments documented + run.
- [ ] 1 game day completed with retro.

---

### 🗓️ **WEEK 43 — Go Production Service: `cost-optimizer` (Tool #5)**

#### Main Topics
- Building production-grade Go services from scratch.
- Database (Postgres + pgx + migrations with `goose`).
- Background workers (Asynq or native + Redis).
- OpenAPI spec → generated code (oapi-codegen).
- Deployment to ShopMaster IDP.

#### Hands-on Projects / Labs
**Tool #5: `cost-optimizer` Go service**
- Architecture:
  - Ingest: AWS Cost Explorer + CUR Athena + Compute Optimizer + OpenCost API.
  - DB: Postgres for historical.
  - Engine: recommendation rules + ML-lite anomaly detection (simple z-score).
  - API: REST (chi) + gRPC.
  - UI: Backstage plugin (TS) consuming API.
- Features:
  - "Show me opportunities > $100/mo savings."
  - "Right-size all dev EC2 below 20% CPU utilization."
  - "Propose Savings Plans purchase 1Y compute, show NPV."
- Output: PR to IaC repo with proposed changes (uses `go-github` to open PR with diff).

#### AI-Assisted Tasks
- Prompt: *"Architect Go service that: pulls CUR via Athena (async query), stores cost facts in Postgres, computes 30/60/90-day anomalies (z-score), exposes REST API. Include schema, package layout, error handling."*

#### Milestone & Deliverables
- [ ] `cost-optimizer` v0.1.0 deployed on EKS.
- [ ] 10+ actionable recommendations generated for ShopMaster.
- [ ] Backstage plugin shows cost dashboard.

---

### 🗓️ **WEEK 44 — Go Production Service: `deployment-manager` (Tool #6)**

#### Main Topics
- Build a deployment orchestration service that wraps Argo CD + GitHub.
- Approval workflows.
- Slack interactive bots (Block Kit).

#### Hands-on Projects / Labs
**Tool #6: `deployment-manager`**
- API: REST `/deploy?service=x&version=y&env=prod`.
- Flow:
  1. Validate: signed image? policies pass?
  2. Open PR to gitops repo bumping image tag.
  3. Await approvals (config: 2 required for prod).
  4. Merge PR.
  5. Argo CD syncs; manager polls Argo CD API; reports status to Slack.
- Audit log persisted (who deployed what when).

#### AI-Assisted Tasks
- Prompt: *"Design deployment service architecture: state machine for deploy lifecycle, idempotency, retry, audit. Show Go state machine implementation using interface."*

#### Milestone & Deliverables
- [ ] `deployment-manager` deployed.
- [ ] Slack `/deploy product 1.2.3 prod` works end-to-end with approvals.
- [ ] Audit log queryable.

---

### 🗓️ **WEEK 45 — Go Production Service: `platform-api` (Tool #7) + Open Feature**

#### Main Topics
- "Platform API" as facade for Backstage + tools.
- Open Feature SDK Go.
- Migrating FeatureFlag Operator to OpenFeature backend.

#### Hands-on Projects / Labs
**Tool #7: `platform-api`**
- Aggregates:
  - Catalog (Backstage proxy).
  - Cost (cost-optimizer).
  - Deploy (deployment-manager).
  - Compliance (shopscan).
- gRPC + REST gateway.
- AuthN: GitHub OAuth + JWT.
- AuthZ: RBAC via Casbin or simple.

**Lab 45.1: OpenFeature**
- Replace custom flag client with OpenFeature SDK (Go) + flagd provider.
- FeatureFlag Operator updates flagd's config.

#### Milestone & Deliverables
- [ ] `platform-api` integrated with 4 tools.
- [ ] Backstage uses `platform-api` for actions.
- [ ] OpenFeature replaces custom client.

---

### 🗓️ **WEEK 46 — FinOps Automation: Anomaly + Auto Right-size**

#### Main Topics
- Anomaly detection beyond z-score: STL decomposition (basic).
- Auto-actions safe set: stop dev resources off-hours, delete unused EBS, terminate idle ALB.
- Right-sizing pipeline: detect → recommend → PR → approve → apply.

#### Hands-on Projects / Labs
**Lab 46.1: Off-hours automation**
- Lambda Go (or EKS CronJob) stops dev resources 22:00–07:00 weekdays, all weekend.
- Tag-driven (only `shutdown:auto-stop=true`).

**Lab 46.2: Unused resource cleaner**
- `cost-optimizer` cron weekly: find unattached EBS > 30 days → propose deletion PR.

**Lab 46.3: Cost dashboard for execs**
- Grafana dashboard: $ trend, % vs forecast, top 5 services, savings YTD.

#### Milestone & Deliverables
- [ ] Off-hours automation live → confirmed cost reduction ≥ 30% for dev.
- [ ] Unused resource report weekly.

---

### 🗓️ **WEEK 47 — Career Polish: Resume, LinkedIn, Mock Interview, ADRs**

#### Main Topics
- Resume tailored for DevOps Mid-Senior.
- LinkedIn rebrand.
- 5 ADRs covering major decisions in 12 months.
- Mock interviews.

#### Hands-on Projects / Labs
**Lab 47.1: Resume**
- 1-page resume, project-led (top 4 projects with outcomes + metrics).
- Quantify: "Reduced AWS cost 35% via cost-optimizer tool"; "Built 7 Go production services".

**Lab 47.2: LinkedIn**
- Headline: "DevOps Engineer | AWS · Terraform · Go · Kubernetes · Platform Engineering".
- Featured: ShopMaster repo, 3 best blog posts.
- About: story + tech stack + open to work.

**Lab 47.3: ADRs**
- ADR-001: Multi-region active-active.
- ADR-002: Crossplane for self-service vs Terraform.
- ADR-003: Vault for secrets vs AWS Secrets Manager primary.
- ADR-004: Istio ambient over sidecar.
- ADR-005: SLSA L3 supply chain pattern.

**Lab 47.4: Mock interview**
- 2 sessions with Pramp / interviewing.io (or AI mock).
- 1 system design: "Design CI/CD for 50 services".
- 1 technical deep dive: Terraform state internals.
- 1 behavioral: "Tell me about a hard production incident".

#### AI-Assisted Tasks
- Prompt: *"Conduct a Mid-Senior DevOps interview, 60 min: 10 min behavioral (STAR), 25 min technical deep dive (start broad, drill into K8s networking), 20 min system design (CI/CD for 50 services), 5 min Q&A. Ask one at a time, score me at end with rubric."*

#### Milestone & Deliverables
- [ ] Resume finalized.
- [ ] LinkedIn updated.
- [ ] 5 ADRs published in TechDocs.
- [ ] 3+ mock interviews done with notes.

---

### 🗓️ **WEEK 48 — Final Capstone + Job Applications**

#### Main Topics
- Final ShopMaster v4 polish.
- Apply to roles.
- Open source contribution (1 meaningful PR).

#### Hands-on Projects / Labs
**Lab 48.1: Final demo**
- 15-min Loom: tour ShopMaster v4 end-to-end.
  - Developer self-service via Backstage: scaffold new service → live in 10 min.
  - Cost-optimizer recommends → PR → merged → saved $.
  - Chaos game day clip.
  - Multi-region failover.
  - Compliance scan output.

**Lab 48.2: 5–10 job applications**
- Target: AWS-heavy companies, Series B+ startups, FAANG-adjacent, remote-friendly.
- Customize 1-paragraph intro per application referencing 1 specific portfolio piece.
- Reach out via LinkedIn DM to a current employee for 1 referral per company.

**Lab 48.3: Open source PR**
- Target: terraform-aws-modules, kyverno, argo-cd, crossplane, backstage.
- Find "good first issue" or doc fix; submit meaningful PR.

**Lab 48.4: Year-end blog**
- *"From Zero to DevOps Engineer in 12 Months: What I Built, Learned, and Wish I Knew Earlier"* — 3000+ words; share to HN, r/devops, LinkedIn.

#### Milestone & Deliverables
- [ ] 5+ applications submitted.
- [ ] 1 OSS PR opened.
- [ ] Year-end blog published (target: 1000+ views).
- [ ] Phase 4 + 12-month retrospective doc.

---

## 🏆 END OF PHASE 4 ASSESSMENT & PORTFOLIO ITEMS

### Portfolio Artifacts (FINAL)
1. **`shopmaster-infra`** — Terraform monorepo, 30+ modules, 3 envs × 2 regions.
2. **`shopmaster-gitops`** — Argo CD App-of-Apps + ApplicationSets.
3. **`shopmaster-services`** — 5 Go business microservices.
4. **`shopmaster-operator`** — FeatureFlag K8s operator.
5. **`terraform-provider-shopmaster`** — Custom TF provider.
6. **`shopmaster-tools`** — 7 Go tools (shopctl, shopscan, dora-collector, cost-optimizer, deployment-manager, platform-api, backup-tool).
7. **`shopmaster-platform`** — Backstage config, Crossplane compositions, IDP templates.
8. **`shopmaster-policies`** — OPA/Rego + Kyverno + tests.
9. **Blog**: 12–15 deep technical posts.
10. **Certs**: SAA, TF Associate, CKA, AWS DevOps Pro, (CKS optional).
11. **ADRs**: 5+ documented.

### Capstone Final Demo Script (15 min Loom)
1. **0:00–1:30** — Intro: 12-month journey overview.
2. **1:30–4:00** — Architecture tour: ShopMaster v4 multi-region active-active.
3. **4:00–6:30** — Self-service: developer scaffolds new service in Backstage live.
4. **6:30–9:00** — Pipeline: code commit → SLSA L3 → ArgoCD canary → prod.
5. **9:00–11:00** — Cost optimization: cost-optimizer recommends → automated PR.
6. **11:00–13:00** — Resilience: chaos experiment + failover demonstration.
7. **13:00–14:30** — Observability: SLO dashboard, DORA dashboard.
8. **14:30–15:00** — Closing + next steps.

### Self-Assessment (Final 10-question)
1. Tôi tự stand up production EKS multi-region + IDP từ scratch trong 1 tuần? (Y/N)
2. Tôi viết Go service production-grade với clean architecture + tests + observability? (Y/N)
3. Tôi viết được Custom TF Provider + K8s Operator? (Y/N)
4. Tôi giải thích SLSA L3 + run pipeline implementing? (Y/N)
5. Tôi có cost-optimization framework giảm ≥ 20% spend? (Y/N)
6. Tôi đã chạy chaos game day + viết runbook recovery? (Y/N)
7. Tôi viết ADR có cấu trúc, RFC defensible? (Y/N)
8. Tôi mentor được 1 junior trong topic K8s/Terraform? (Y/N)
9. Portfolio + LinkedIn nhận được ≥ 3 inbound recruiter? (Y/N)
10. Tôi pass technical interview Mid-Senior DevOps trong 3 lần mock? (Y/N)

> Target **≥ 8/10 YES** = sẵn sàng apply Senior. **6–7 YES** = Mid-level role with growth.

---

## ⚠️ COMMON PITFALLS — PHASE 4

| Pitfall | Triệu chứng | Cách tránh |
|---------|-------------|-----------|
| **Build IDP no one uses** | Backstage empty 6 months later | Start with 1 painful workflow, automate it, then expand |
| **Crossplane vs Terraform turf war** | Duplicate work | Crossplane for app-level on-demand, Terraform for org/foundation |
| **Active-active without conflict strategy** | Split-brain data | Pick conflict resolution upfront (last-write-wins, app-level) |
| **Chaos experiments in prod first** | Outage from your own exp | Always staging first, blast radius defined |
| **Over-engineer Go services** | Premature abstraction | Start with monolith; split when seam emerges |
| **Skip writing ADRs** | Decisions forgotten, rehashed | One ADR per significant decision, ~1 page |
| **Cert grinding > building** | Lots of certs, weak portfolio | Portfolio first, cert second always |
| **Apply too late** | Tháng 12 chưa apply gì | Apply from week 47, iterate |
| **Hide weak areas in interviews** | Disqualified | Acknowledge gaps, show learning plan |
| **Build solo only** | Weak collaboration signal | Do 1 OSS contribution + 1 paid consulting / contract gig if possible |

---

## 🎓 12-MONTH RETROSPECTIVE TEMPLATE

Cuối tuần 48, viết doc:

### What worked
- Top 3 practices that compounded.

### What didn't
- Top 3 attempts that wasted time.

### Numbers
- Hours studied (estimate): ~__
- Lines of Terraform code: ~__
- Lines of Go code: ~__
- GitHub commits: ~__
- Blog posts: __
- Certifications: __
- AWS spend total: $__

### Skills truly mastered (1–5 self-rating)
- Terraform: __
- Golang: __
- AWS networking: __
- AWS IAM: __
- EKS operations: __
- GitOps: __
- DevSecOps: __
- Platform engineering: __

### Skills still gap (next 12 months)
- ...

### Next 12 months
- 6 months: Land Mid-Senior role + onboard well.
- 12 months: Lead a platform initiative; aim Senior promo or job-hop to senior.

---

## 🎯 LIFE AFTER MONTH 12 — Career Trajectory

### Year 2 focus (suggestions)
1. **Specialize:** Pick one — Kubernetes-deep / Cloud-architect-deep / DevSecOps-deep / Platform-deep.
2. **Public speaking:** 1 meetup talk + 1 conference CFP submitted.
3. **OSS maintainer:** Move from contributor to maintainer in 1 small project.
4. **Mentor:** Mentor 1 junior dev/intern.
5. **Domain knowledge:** Pick a business domain (fintech, healthtech, ecommerce) — learn its compliance/scale concerns.

### Salaries to target (2026, USD, rough — verify on levels.fyi)
- Vietnam (local): $30–60k Mid; $50–90k Senior.
- Remote SEA roles: $50–100k Mid; $80–150k Senior.
- Remote US/EU: $90–160k Mid; $140–250k Senior.

---

## 🚀 FINAL WORDS

12 months is enough to go from zero to Mid-Senior **if and only if** you:

1. **Code daily.** Not perfect, just daily.
2. **Build > consume.** Every concept → artifact.
3. **Show your work.** GitHub commits + blog posts > silent expertise.
4. **Master fundamentals before tools.** Network, Linux, IAM, Go syntax → before EKS, Argo, Helm.
5. **Production mindset from day 1.** Tags, costs, security, backups — not "for later".
6. **Pair with AI, don't outsource thinking.** Always understand the "why".
7. **Find a community.** Discord, Slack, local meetup. Solo journey is hard.
8. **Rest.** Burnout = career end. 1 day off per week. Sleep 7+ hours.
9. **Celebrate.** Every milestone is a win. Tell people.
10. **Keep going.** Year 1 sets the trajectory. Year 2–3 compounds.

**See you in production.** 🟢

— Your DevOps Master Architect, 2026
