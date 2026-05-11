# 🟡 PHASE 2 — Q2 (Tháng 4–6)
## Kubernetes Deep Dive + EKS Production + Golang Advanced (Operators, Controllers, Custom Providers)

> **Output cuối phase:** ShopMaster v2 chạy trên EKS với Istio + Karpenter; 1 Custom Kubernetes Operator (Go + kubebuilder); 1 Custom Terraform Provider; CKA pass.

---

## 🎯 PHASE OVERVIEW

### Mục tiêu
1. Master Kubernetes core ở mức tự tin debug production incidents.
2. Vận hành EKS production-grade: Karpenter, Auto Mode (2026), Istio, Gateway API, addons.
3. Golang nâng cao: HTTP/gRPC services production, controller-runtime, kubebuilder, custom resources, admission webhooks.
4. Viết **1 Custom Kubernetes Operator** giải quyết bài toán thực (FeatureFlag/Tenant/Backup).
5. Viết **1 Custom Terraform Provider** quản lý nội bộ (vd: provider quản lý FeatureFlags hoặc Internal API).
6. Pass **CKA** + chuẩn bị **AWS DevOps Pro**.

### Outcome
- ShopMaster v2: 5 Go microservices trên EKS, Istio sidecars, Karpenter auto-scaling, ExternalDNS, cert-manager, Helm charts có values per env.
- Có thể debug `CrashLoopBackOff`, `ImagePullBackOff`, network policy block, DNS issue, OOMKill bằng `kubectl` + `eksctl` + observability.
- Viết Go service production-grade theo Clean Architecture, đầy đủ test, metrics (Prometheus), tracing (OTel), structured logging (slog).

### Production Readiness Target (Phase 2 Exit)
| Aspect | Target |
|--------|--------|
| EKS version | Latest -1 (vd 1.32, ko bleeding edge) |
| Node strategy | Karpenter v1 + Spot mix, ≥ 70% Spot dev, 30–50% prod |
| Pod density | requests/limits set 100%, QoS Burstable cho default |
| Network | Cilium hoặc VPC CNI + NetworkPolicy block by default |
| Service mesh | Istio ambient mode (sidecar optional) |
| Secrets | External Secrets Operator + Secrets Manager |
| Observability | Prom + Grafana + Tempo + Loki; SLO 99.9% defined |
| Security | OPA/Kyverno baseline policies, RBAC least-priv, IRSA |
| Cost | EKS + workload < $200/tháng dev (Spot + Karpenter consolidation) |

---

## 🛠️ CORE KEY SKILLS PHASE 2

### Kubernetes
- Architecture: API server, etcd, scheduler, controller manager, kubelet, kube-proxy.
- Core objects: Pod, Deployment, StatefulSet, DaemonSet, Job, CronJob, Service, Endpoint, Ingress, Gateway API.
- Config: ConfigMap, Secret, Downward API, Env from valueFrom.
- Storage: PV/PVC, StorageClass, CSI, EBS CSI vs EFS CSI, snapshots.
- Networking: ClusterIP, NodePort, LoadBalancer, Ingress vs Gateway API, NetworkPolicy.
- Scheduling: nodeSelector, affinity/anti-affinity, taints/tolerations, topologySpreadConstraints, PodDisruptionBudget.
- Security: RBAC, ServiceAccount, PodSecurityStandards (PSS), seccomp, AppArmor, OPA Gatekeeper, Kyverno.
- Observability: kube-state-metrics, metrics-server, HPA, VPA, KEDA.
- Lifecycle: probes (startup/liveness/readiness), graceful shutdown, preStop hooks.

### EKS (AWS specifics)
- Cluster modes: Standard vs **Auto Mode** (2026 default for new clusters in many cases).
- Node groups: managed, self-managed, Fargate profile, Karpenter (v1 stable).
- IAM: cluster role, node role, **IRSA**, **EKS Pod Identity** (2024+ alternative).
- Add-ons: VPC CNI, CoreDNS, kube-proxy, EBS CSI, ALB controller, ExternalDNS, cert-manager, External Secrets, Karpenter.
- Networking: VPC CNI prefix delegation, custom networking (secondary CIDR), Cilium chained mode.

### Golang Advanced
- HTTP server production: graceful shutdown, middleware chain, request context, timeouts (read/write/idle), pprof.
- gRPC + protobuf + buf tooling.
- Project layout: Clean Architecture (handlers → usecase → repo → entity).
- Testing: table-driven, testify, testcontainers-go (real Postgres/Redis in CI).
- Observability instrumentation (Prometheus client + OTel).
- Concurrency patterns: worker pool, fan-out/fan-in, errgroup, semaphore.
- controller-runtime: Reconciler pattern, predicate, owner refs.
- kubebuilder scaffold + CRD + webhook.
- Terraform Plugin Framework v1+ (NOT SDKv2 — đã legacy 2026).

### Helm / Kustomize
- Helm 3: charts, values, templates, lookup, hooks, dependencies.
- Kustomize: bases, overlays, strategic merge, JSON 6902.
- Helm vs Kustomize hybrid (helm template | kustomize).

---

## 📅 WEEKLY BREAKDOWN — 12 WEEKS

---

### 🗓️ **WEEK 13 — Kubernetes Fundamentals + Local Cluster (kind/k3d)**

#### Main Topics
- Containers refresher (cgroups, namespaces, OCI).
- Kubernetes architecture & control plane vs data plane.
- Pod, Deployment, Service, ConfigMap, Secret.
- Local dev: kind, k3d, minikube. Choose **kind** (CNCF, multi-node easy).

#### Core Knowledge & Key Concepts
- Imperative vs declarative `kubectl`.
- Pod lifecycle states: Pending → Running → Succeeded/Failed.
- Init containers vs sidecar pattern (and 2026 native sidecar API).
- Service types and DNS resolution (`svc.namespace.svc.cluster.local`).
- Endpoints vs EndpointSlices.

#### Hands-on Projects / Labs
**Lab 13.1: kind multi-node cluster**
- 1 control plane + 3 workers, install metrics-server, ingress-nginx.
- Deploy `product` Go service from Phase 1.

**Lab 13.2: kubectl muscle memory**
- 30 commands drill (without doc): get/describe/logs/exec/port-forward/cp/scale/rollout/edit/patch/explain/...
- Speed target: < 3s/command.

**Lab 13.3: First Helm chart**
- `charts/product/`: Deployment + Service + ConfigMap + Secret + HPA.
- `helm install` to kind.

#### AI-Assisted Tasks
- Prompt: *"Tạo cho tôi 50 kubectl commands cheatsheet ngắn gọn, group theo: inspection, debug, edit, scale, RBAC. Mỗi command 1 dòng giải thích."*
- Prompt: *"Tôi gặp Pod stuck Pending. Đặt 10 câu hỏi chẩn đoán theo thứ tự để zero-in root cause."*

#### Resources
- Book: *Kubernetes Up & Running* — Ch. 1–8.
- Video: TechWorld with Nana — full K8s playlist.
- KodeKloud: CKA course (start).

#### Milestone & Deliverables
- [ ] kind cluster + ShopMaster product service running.
- [ ] First Helm chart works on kind.
- [ ] 30-command drill: < 5 min.

#### Self-Assessment
- Vẽ K8s control plane components và mô tả từng component bằng 1 câu.
- Phân biệt readiness vs liveness probe với ví dụ.

---

### 🗓️ **WEEK 14 — Kubernetes Networking + Storage + Stateful**

#### Main Topics
- Service deep: kube-proxy iptables vs IPVS; LB controller.
- Ingress NGINX vs Gateway API (focus Gateway API 2026).
- NetworkPolicy: deny-all default + allow per service.
- Storage: PV, PVC, StorageClass, dynamic provisioning, ReadWriteOnce vs ReadWriteMany.
- StatefulSet + headless service.

#### Core Knowledge & Key Concepts
- Cluster DNS internals (CoreDNS Corefile).
- Pod-to-Pod traffic flow (cni, veth, bridge, iptables).
- East-West vs North-South.
- Volume lifecycle: bound, released, retained, deleted.

#### Hands-on Projects / Labs
**Lab 14.1: Gateway API**
- Install Gateway API CRDs + a controller (e.g., `kgateway` or NGINX Gateway Fabric).
- Define Gateway + HTTPRoute for `product`.

**Lab 14.2: NetworkPolicy lockdown**
- Deploy 3 namespaces: `frontend`, `backend`, `data`.
- Default-deny NetworkPolicy + allowlist only required flows.
- Test via `kubectl exec` curl.

**Lab 14.3: Postgres StatefulSet**
- Deploy CloudNativePG operator + Postgres cluster trên kind.
- PVC dynamic via local-path-provisioner.

#### AI-Assisted Tasks
- Prompt: *"Diff Ingress (networking.k8s.io/v1) vs Gateway API. Show 1 example mỗi cái cho cùng use case (host routing + TLS). Pros/cons 2026."*

#### Resources
- Book: *Networking and Kubernetes* — James Strong.
- Docs: gateway-api.io.

#### Milestone & Deliverables
- [ ] Gateway API serving product service với TLS (cert-manager + self-signed).
- [ ] NetworkPolicy đẩy default-deny, only allowlisted flows pass.

#### Self-Assessment
- Tại sao Service ClusterIP không phải là IP thực của Pod?

---

### 🗓️ **WEEK 15 — Helm Advanced + Kustomize + GitOps Intro**

#### Main Topics
- Helm advanced: subcharts, library charts, hooks, `lookup`, post-rendering.
- Kustomize: overlays per env, generators, transformers.
- Hybrid: `helm template | kustomize` for env customization.
- GitOps philosophy (Flux/ArgoCD overview — deep dive Q3).

#### Core Knowledge & Key Concepts
- Helm release naming + rollback.
- Helm chart-testing (`ct`) + `helm-unittest`.
- Kustomize `replacements` (replace `varsReference`).
- Why GitOps > push-based CI/CD.

#### Hands-on Projects / Labs
**Lab 15.1: Library chart**
- Create `charts/common-lib/` with shared templates (helpers, labels, ingress macro).
- Refactor `product` chart to use library.

**Lab 15.2: Kustomize overlays**
- `kustomize/base/` + `overlays/{dev,stg,prod}/` for product service.
- Patch resources, env, replicas per env.

**Lab 15.3: helm-unittest**
- Add tests for `product` chart: assert resource counts, image tag templating, NetworkPolicy enforced.

#### AI-Assisted Tasks
- Prompt: *"Khi nào Helm tốt hơn Kustomize và ngược lại? Cho 3 tình huống thực tế (multi-tenant SaaS, internal tool, third-party app). Recommend hybrid cho từng case."*

#### Resources
- Helm docs + Bitnami chart source code (chuẩn để học).
- Kustomize docs.

#### Milestone & Deliverables
- [ ] Library chart hoạt động.
- [ ] Kustomize overlays apply được dev/stg/prod.
- [ ] helm-unittest CI step.

---

### 🗓️ **WEEK 16 — EKS Production Setup (Terraform-managed)**

#### Main Topics
- EKS cluster Terraform module (custom hoặc community `terraform-aws-modules/eks/aws`).
- IRSA setup (OIDC provider + IAM roles).
- EKS Pod Identity (alternative to IRSA, 2024+).
- VPC CNI configuration, prefix delegation.
- Cluster addons (managed): VPC CNI, CoreDNS, kube-proxy, EBS CSI.

#### Core Knowledge & Key Concepts
- Public vs private endpoint access.
- aws-auth ConfigMap → **EKS Access Entries** (2024+, recommended).
- IRSA vs Pod Identity (Pod Identity preferred for new setups).
- VPC CNI custom networking with secondary CIDR (when subnets exhaust IPs).

#### Hands-on Projects / Labs
**Lab 16.1: EKS module from scratch**
- Module `modules/eks-cluster/`: cluster, OIDC, managed addons, security groups.
- Access entries: dev role admin, prod role read-only.

**Lab 16.2: Deploy ShopMaster to EKS**
- Use Helm charts from W15.
- ALB Ingress controller installed via Terraform (Helm provider).
- ExternalDNS installed.

**Lab 16.3: IRSA for product service**
- `product` reads S3 bucket — give SA role via IRSA.
- Verify with `aws sts get-caller-identity` inside pod.

#### AI-Assisted Tasks
- Prompt: *"Show EKS Pod Identity setup end-to-end with Terraform: identity association, IAM role with trust policy, SA annotation. So sánh với IRSA về setup & cost."*

#### Resources
- AWS EKS Best Practices Guide (aws.github.io/aws-eks-best-practices).
- Adrian Cantrill — EKS course.

#### Milestone & Deliverables
- [ ] EKS dev cluster live qua Terraform.
- [ ] ShopMaster product service expose qua ALB.
- [ ] IRSA cho ≥ 1 service.

#### Self-Assessment
- Tại sao IRSA cần OIDC provider riêng cho cluster?

---

### 🗓️ **WEEK 17 — Karpenter + Cost Optimization + Spot**

#### Main Topics
- Karpenter v1 (stable từ 2024): NodePool, NodeClass, consolidation, drift, expiration.
- Spot instance integration + interruption handling.
- EKS Auto Mode (2026): managed Karpenter, when to use vs self-managed Karpenter.
- Compute Savings Plans strategy.

#### Core Knowledge & Key Concepts
- Karpenter vs Cluster Autoscaler (Karpenter wins for flexibility & speed).
- Bin-packing, consolidation policy (`WhenUnderutilized`).
- Topology spread + Karpenter.
- PodDisruptionBudget interplay.

#### Hands-on Projects / Labs
**Lab 17.1: Install Karpenter**
- Via Helm + Terraform.
- NodePool with mixed instance types (m, c, t families) + Spot 80%.

**Lab 17.2: Stress test scaling**
- Deploy load generator (k6 in Go).
- Observe Karpenter scale up & consolidate.
- Measure pod ready time (target < 60s).

**Lab 17.3: Cost optimization audit**
- `shopctl k8s cost` command (Go): list nodes, requests vs limits utilization, recommendations.

#### AI-Assisted Tasks
- Prompt: *"Design Karpenter NodePool cho workload mixed: 30% latency-sensitive (on-demand m), 70% batch (Spot c). Show YAML + giải thích từng knob."*

#### Resources
- karpenter.sh docs.
- AWS blog "EKS Auto Mode".

#### Milestone & Deliverables
- [ ] Karpenter scaling functional, observed in CloudWatch.
- [ ] Node cost analysis report from `shopctl k8s cost`.

---

### 🗓️ **WEEK 18 — Istio / Service Mesh + Observability Stack (Prometheus, Grafana, Tempo, Loki)**

#### Main Topics
- Istio ambient vs sidecar (2026 ambient is GA, preferred).
- Traffic management: VirtualService, DestinationRule, Gateway.
- mTLS, AuthorizationPolicy.
- Kube-Prometheus-Stack chart.
- Loki + Promtail/Vector.
- Tempo + OTel exporter.

#### Core Knowledge & Key Concepts
- Mesh value-add vs cost (latency, complexity).
- Istio ambient: ztunnel + waypoint proxies.
- PromQL basics, recording rules.
- LogQL basics.

#### Hands-on Projects / Labs
**Lab 18.1: Istio ambient install**
- Install Istio ambient via Helm + Terraform.
- Enable mTLS strict.
- Authorization policy: `product` only callable from `order`.

**Lab 18.2: kube-prom-stack**
- Install via Helm. Configure Grafana with persistent storage.
- Import dashboards: Node Exporter, K8s cluster, Istio.

**Lab 18.3: SLO dashboard**
- Define SLO: `product` latency p99 < 300ms, error rate < 0.1%.
- Use Sloth (Go tool) generates PrometheusRule.

#### AI-Assisted Tasks
- Prompt: *"Viết PrometheusRule SLO 99.9% availability cho service Y. Calculate burn rate alert thresholds (1h, 6h windows). Giải thích formula."*

#### Resources
- istio.io docs.
- Book: *Implementing SLOs* (Hidalgo).

#### Milestone & Deliverables
- [ ] Istio mTLS strict + authz hoạt động.
- [ ] Grafana với ≥ 5 dashboards.
- [ ] Sloth SLO rules deployed.

---

### 🗓️ **WEEK 19 — Golang Advanced: HTTP/gRPC Service Production + Testing**

#### Main Topics
- HTTP server production: `chi`/`echo`, middleware (logging, recover, request id, rate-limit).
- gRPC server + client + reflection + health.
- buf for protobuf workflow.
- Testing: table-driven, testify, gomock, testcontainers-go (real DB).
- Structured logging (`slog`), correlation IDs.

#### Core Knowledge & Key Concepts
- Graceful shutdown via `signal.NotifyContext`.
- Context propagation HTTP → DB → external service.
- `errors.Join` (Go 1.20+).
- Race detector (`go test -race`).

#### Hands-on Projects / Labs
**Lab 19.1: Build `order` service (Go gRPC + HTTP)**
- Clean architecture: handlers/usecase/repo/entity.
- DB: Postgres via `pgx`.
- gRPC server + HTTP gateway (grpc-gateway).
- Prometheus metrics + OTel traces.

**Lab 19.2: Integration tests with testcontainers**
- Spin up Postgres + Redis in tests.
- Assert end-to-end create order → events.

**Lab 19.3: Benchmark + pprof**
- `go test -bench`, `pprof` cpu + mem.
- Identify bottleneck, optimize, re-measure.

#### AI-Assisted Tasks
- Prompt: *"Review Go HTTP server sau theo production checklist 2026: shutdown, timeouts, middleware order, leak risk, observability. Đề xuất diff."*

#### Resources
- Book: *Learning Go* — Ch. 9–16.
- *100 Go Mistakes* — Ch. 1–10.
- Ardan Labs: Ultimate Service.

#### Milestone & Deliverables
- [ ] `order` service deployed to EKS, p99 < 200ms under 100 RPS load.
- [ ] Test coverage ≥ 75%.
- [ ] pprof report saved in repo.

---

### 🗓️ **WEEK 20 — Kubernetes CRD + controller-runtime + kubebuilder**

#### Main Topics
- CRD: schema (OpenAPI v3), versions, conversion webhook.
- controller-runtime: Manager, Reconciler, Client, Cache.
- kubebuilder scaffold: `init`, `create api`, `create webhook`.
- Reconciliation loop: idempotent, level-triggered.

#### Core Knowledge & Key Concepts
- Owner references + garbage collection.
- Status vs spec (controller writes status only).
- Predicates + event filtering.
- Finalizers for safe deletion.

#### Hands-on Projects / Labs
**Lab 20.1: Scaffold `FeatureFlag` operator**
- `kubebuilder init --domain shopmaster.io && kubebuilder create api --group platform --version v1 --kind FeatureFlag`.
- CRD: `spec.flagName, spec.enabled, spec.percentage`; status: `lastApplied, currentValue`.

**Lab 20.2: Reconciler logic**
- On FeatureFlag CR change → update ConfigMap consumed by services.
- Use `controllerutil.CreateOrUpdate`.
- Add owner reference.

**Lab 20.3: Unit tests with envtest**
- `setup-envtest use` for kube-apiserver + etcd bin.
- Reconcile loop tested without cluster.

#### AI-Assisted Tasks
- Prompt: *"Show finalizer pattern in controller-runtime: add on create, handle on delete with external cleanup (e.g., remove DNS record). Full reconcile loop code."*

#### Resources
- *Programming Kubernetes* — full read.
- book.kubebuilder.io.

#### Milestone & Deliverables
- [ ] `featureflag-operator` repo scaffolded, reconciler implemented.
- [ ] envtest passing.

---

### 🗓️ **WEEK 21 — Operator Production: Webhooks, Metrics, Deployment via Helm**

#### Main Topics
- Validation + mutation webhooks (cert-manager for serving certs).
- Operator metrics (Prometheus).
- Leader election for HA operator.
- Operator deployment via Helm chart.
- OLM (awareness only).

#### Core Knowledge & Key Concepts
- Webhook timeout (10s default; keep < 2s ideal).
- `kube-rbac-proxy` sidecar for metrics auth.
- Operator `status.conditions` pattern.

#### Hands-on Projects / Labs
**Lab 21.1: Validation webhook for FeatureFlag**
- Reject `percentage > 100` or `flagName` empty.

**Lab 21.2: Operator metrics**
- Add `reconcile_total`, `reconcile_errors_total`, `reconcile_duration_seconds`.
- Grafana dashboard.

**Lab 21.3: Package as Helm chart + install via ArgoCD (preview)**
- `charts/featureflag-operator/` with CRDs in `crds/`.
- Install on EKS.
- Demo: create FeatureFlag CR → ConfigMap updated → services pick up via mounted file.

#### AI-Assisted Tasks
- Prompt: *"Write Go admission webhook validating Pod requests CPU < 2 cores in dev namespace. Show full handler + cert-manager Certificate + ValidatingWebhookConfiguration."*

#### Resources
- kubebuilder webhook chapter.
- prometheus-operator examples.

#### Milestone & Deliverables
- [ ] FeatureFlag operator GA on EKS dev.
- [ ] 5+ FeatureFlag CRs running in ShopMaster.
- [ ] Operator dashboard live.

---

### 🗓️ **WEEK 22 — Custom Terraform Provider in Go (Plugin Framework v1)**

#### Main Topics
- Why custom provider? Internal APIs, SaaS integration, abstraction layer.
- Plugin Framework v1 (SDKv2 deprecated for new providers).
- Resource lifecycle: Schema → Create → Read → Update → Delete → ImportState.
- Acceptance tests with `terraform-plugin-testing`.

#### Core Knowledge & Key Concepts
- Schema types: String/Int/Bool/List/Map/Object.
- Plan modifiers: `RequiresReplace`, `UseStateForUnknown`.
- Validators.
- Provider configuration vs resource configuration.

#### Hands-on Projects / Labs
**Lab 22.1: Provider scaffold `terraform-provider-shopmaster`**
- Use `terraform-plugin-framework`.
- Backing API: a simple Go REST API (`tools/platform-api/`) managing FeatureFlags.
- Resource: `shopmaster_feature_flag`.

**Lab 22.2: Implement CRUD**
- POST /flags, GET /flags/{id}, PATCH /flags/{id}, DELETE /flags/{id}.
- Provider calls API; state stored in TF.

**Lab 22.3: Acceptance tests**
- `TF_ACC=1 go test` against real local API via testcontainers.

#### AI-Assisted Tasks
- Prompt: *"Walk me through writing a Terraform provider resource using plugin-framework v1: Schema, Create, Read, Update, Delete with full Go code, error handling, import support."*

#### Resources
- developer.hashicorp.com/terraform/plugin/framework.
- Reference providers: HashiCorp `terraform-provider-random`, `terraform-provider-tls`.

#### Milestone & Deliverables
- [ ] `terraform-provider-shopmaster` v0.1.0 published to GitHub.
- [ ] `make testacc` green.
- [ ] Usage example in `examples/` dir.
- [ ] (Optional) Publish to Terraform Registry private namespace.

---

### 🗓️ **WEEK 23 — Multi-tenancy, Quotas, PSS, OPA/Kyverno Basics**

#### Main Topics
- Namespace as tenancy boundary; vCluster awareness.
- ResourceQuota + LimitRange.
- Pod Security Standards: privileged/baseline/restricted.
- Policy engines: OPA Gatekeeper vs Kyverno (Kyverno more popular 2026 for K8s-native).

#### Core Knowledge & Key Concepts
- Tenancy patterns: namespace-per-team, cluster-per-team, vCluster, hybrid.
- Cost allocation via namespace labels.
- ImagePolicy: only allow signed images from your registry (preview for Q3 supply chain).

#### Hands-on Projects / Labs
**Lab 23.1: ShopMaster tenancy**
- Namespace per service team: `team-product`, `team-order`, `team-payment`.
- ResourceQuota: CPU/memory caps per namespace.
- LimitRange default + max per Pod.

**Lab 23.2: Kyverno policies baseline**
- Require labels `app, env, owner, cost-center`.
- Disallow `latest` tag.
- Disallow `privileged: true`.

**Lab 23.3: Audit existing workloads**
- Run `kyverno` in audit mode → fix violations → switch to enforce.

#### Resources
- kyverno.io docs.
- CNCF Multi-tenancy WG docs.

#### Milestone & Deliverables
- [ ] Kyverno enforced in dev with ≥ 5 policies.
- [ ] All ShopMaster workloads pass policies.

---

### 🗓️ **WEEK 24 — CKA Crunch + Phase 2 Capstone**

#### Main Topics
- CKA exam practice: killer.sh sessions + KodeKloud labs.
- Phase 2 capstone polish.

#### Hands-on Projects / Labs
**CKA practice**
- 2 killer.sh sessions (full 36 hours each).
- Focus: speed (~30s/q for easy, 5min for hard), `kubectl` aliases, `--dry-run=client -o yaml`, etcd backup/restore.

**Capstone polish**
- README updates with diagrams.
- Blog post: *"How I built ShopMaster v2 on EKS with custom operators & TF provider"*.
- Demo Loom 7 phút.

#### Milestone & Deliverables
- [ ] CKA PASS.
- [ ] AWS DevOps Pro practice tests started.
- [ ] Capstone Loom + blog posted.
- [ ] Phase 2 retro doc.

---

## 🏆 END OF PHASE 2 ASSESSMENT & PORTFOLIO ITEMS

### Portfolio Artifacts
1. `shopmaster-infra` v2: EKS modules, Karpenter, Istio, observability stack.
2. `shopmaster-operator` (FeatureFlag) — separate repo, Helm chart.
3. `terraform-provider-shopmaster` — separate repo, registry-ready.
4. `shopmaster-services`: product, order, payment (Go, gRPC + HTTP).
5. Blog: 3 more posts (M4, M5, M6).
6. **CKA cert**.
7. Diagrams: ShopMaster v2 architecture (EKS + service mesh).

### Capstone Demo Requirements
- `make eks-up` provisions cluster + addons + apps in < 45 min.
- `kubectl apply -f featureflag.yaml` toggles a feature live in service within 30s.
- Spot interruption simulation → no user-facing errors (PDB working).
- SLO dashboard green for 24h soak test.

### Self-Assessment
1. Tôi có thể debug `CrashLoopBackOff` < 5 phút? (Y/N)
2. Tôi đọc Helm chart 1000+ dòng và hiểu? (Y/N)
3. Tôi viết được CRD + Reconciler từ scratch? (Y/N)
4. Tôi viết được Custom TF provider CRUD đầy đủ? (Y/N)
5. Tôi config IRSA + Pod Identity và biết khi nào dùng cái nào? (Y/N)
6. Tôi giải thích được Karpenter consolidation policy? (Y/N)
7. CKA PASSED? (Y/N)

> Cần **≥ 6/7 YES** trước khi sang Phase 3.

---

## ⚠️ COMMON PITFALLS — PHASE 2

| Pitfall | Triệu chứng | Cách tránh |
|---------|-------------|-----------|
| **No resource requests/limits** | OOMKill, node hotspots | Kyverno enforce + VPA recommendation |
| **Using LoadBalancer Service per app** | NLB cost explodes | Use ALB Ingress / Gateway API with host-based routing |
| **Helm chart hardcode image tag** | Rollbacks broken | Use `appVersion` + Helm-aware updater (preview) |
| **Operator without finalizer** | Orphan external resources | Always finalize external resources |
| **Reconciler not idempotent** | Drift, infinite loops | Test reconcile twice → no diff |
| **EKS public endpoint open** | Security risk | Private endpoint + bastion via SSM |
| **VPC CNI IP exhaustion** | Pods stuck Pending "no IP" | Prefix delegation or secondary CIDR |
| **No PDB** | Karpenter consolidation kills all replicas | PDB minAvailable for every Deployment > 1 replica |
| **Istio sidecar in init container init order** | Race condition startup | Use Istio native sidecar (K8s 1.29+) or holdApplicationUntilProxyStarts |
| **Custom provider state drift** | Created resource externally not in state | Implement `Read` correctly + use `terraform import` |

---

## ➡️ TIẾP THEO

Mở `04_PHASE3_DEVSECOPS_GITOPS_ADVANCED_Q3.md` khi:
- [x] 12 tuần đánh dấu xong.
- [x] CKA passed.
- [x] ShopMaster v2 stable, SLO 99.9% trong tuần soak test.

🚀 See you in Phase 3.
