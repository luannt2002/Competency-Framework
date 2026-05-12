# RBAC — Role-Based Access Control (Technical)

> **Audience:** Engineers working on the competency-roadmap codebase. For the
> business-facing (Vietnamese) version see [`docs/business/PHAN_QUYEN.md`](../business/PHAN_QUYEN.md).

## 1. Goal

Introduce a single, predictable authorization layer for every workspace-scoped
mutation. The current model is *owner-only*: every server action checks
`workspaces.owner_user_id = current_user.id`. That works for solo learners but
collapses the moment a workspace needs a collaborator, a reviewer, a TA, or a
read-only public link.

RBAC replaces ad-hoc owner checks with one entry point —
[`requireMinLevel(workspaceId, requiredLevel)`](../../src/lib/rbac/server.ts) —
and one **numeric** scale of access. A required level is just an integer; an
effective level is just an integer; `effective >= required` means allowed.

## 2. The 7-tier numeric model

The SSoT for these constants is
[`src/lib/rbac/levels.ts`](../../src/lib/rbac/levels.ts). The DB never stores
the integer — it stores a canonical role name in `workspace_members.role` (or
implies `workspace_owner` via `workspaces.owner_user_id`).

| Level | Canonical role         | Storage location                           | Notes                                                                 |
|------:|------------------------|--------------------------------------------|-----------------------------------------------------------------------|
|   100 | `super_admin`          | env `PLATFORM_ADMIN_USER_IDS` (comma list) | Platform-wide; bypasses workspace scope. Used for support/ops.        |
|    80 | `workspace_owner`      | `workspaces.owner_user_id`                 | Full CRUD on their workspace, including delete + transfer.            |
|    60 | `workspace_editor`     | `workspace_members.role`                   | CRUD on roadmap content (tree nodes, lessons, labs). No delete-others.|
|    40 | `workspace_contributor`| `workspace_members.role`                   | Adds new child nodes + own notes; cannot edit other people's content. |
|    20 | `learner`              | `workspace_members.role`                   | Marks progress + writes own notes. Default for invited members.       |
|    10 | `viewer`               | `workspace_members.role` (or default)      | Logged-in read-only. Sees XP/streak; cannot mutate.                   |
|     0 | `guest`                | (no row, no user)                          | Not logged in. Reaches only `/share/*` + health endpoints.            |

Aliases (`admin`, `owner`, `reader`, `student`, …) are accepted by
`getRoleLevel()` for forward compatibility but are normalized back to the
canonical name in `getEffectiveLevel()`.

### 2.1 Dev convenience

When `process.env.DEV_AUTH_BYPASS_USER_ID` matches the current user and
`NODE_ENV !== 'production'`, the resolver treats the user as `super_admin`.
This mirrors the existing dev-bypass in
[`src/lib/auth/dev-bypass.ts`](../../src/lib/auth/dev-bypass.ts) so a single
local user can both own a workspace AND impersonate the support role. The
guard is hard-gated by `NODE_ENV`; a production build cannot accidentally
grant super_admin via this path.

## 3. Resolver — `getEffectiveLevel`

See [`src/lib/rbac/server.ts`](../../src/lib/rbac/server.ts). The order of
checks is significant:

1. `userId` null → `guest (0)`.
2. Dev-bypass user (non-production) → `super_admin (100)`.
3. `PLATFORM_ADMIN_USER_IDS` contains userId → `super_admin (100)`.
4. `workspaceId` null → logged-in `viewer (10)` (used for platform-level
   checks before a workspace is resolved).
5. `workspaces.owner_user_id = userId` → `workspace_owner (80)`. Owner is
   never stored in `workspace_members`; the workspaces table is the SSoT.
6. `workspace_members` row exists → `getRoleLevel(member.role)`.
7. Fallback for logged-in non-members → `viewer (10)`.

The owner check is *independent* of `workspace_members`. This avoids drift
between two sources of truth: ownership can only change via a transfer
mutation that updates `workspaces.owner_user_id`.

## 4. Guard — `requireMinLevel`

```ts
const ctx = await requireMinLevel(workspaceId, RBAC_LEVELS.EDITOR);
// ctx: { user: { id }, level: number, role: RoleName, workspaceId }
```

Throws `RBACError('UNAUTHORIZED')` if a logged-in user is required but
absent. Throws `RBACError('FORBIDDEN')` if the user is logged in but their
level is too low. The returned `role` is the canonical name that will be
written into `audit_log.actor_role`.

Server actions should catch `RBACError` and translate to a 404-style error
(`WORKSPACE_NOT_FOUND_OR_FORBIDDEN`) so non-members cannot distinguish a
forbidden workspace from a nonexistent one. See
[`src/actions/tree-nodes.ts → resolveWorkspace`](../../src/actions/tree-nodes.ts)
for the canonical pattern.

## 5. Per-action level matrix

Live wiring in [`src/actions/tree-nodes.ts`](../../src/actions/tree-nodes.ts):

| Action                | Function           | Required level | Audit action          |
|-----------------------|--------------------|---------------:|-----------------------|
| List tree             | `listTreeForWorkspace` | 20 (learner)   | — (read, no audit)    |
| Create tree node      | `createTreeNode`   | 60 (editor)    | `tree_node.create`    |
| Update tree node      | `updateTreeNode`   | 60 (editor)    | `tree_node.update`    |
| Move tree node        | `moveTreeNode`     | 60 (editor)    | — (low-risk reorder)  |
| Delete tree node      | `deleteTreeNode`   | 80 (owner)     | `tree_node.delete`    |
| Toggle done           | `toggleNodeDone`   | 60 (editor)    | `tree_node.toggle_done` |

The split keeps destructive mutations (delete) restricted to the owner and
super_admin even when an editor is present. This matches the principle of
least privilege.

## 6. Page-level gates remain

`src/lib/workspace.ts → requireWorkspaceAccess(slug)` still performs the
owner-only check. It is the **page-level** gate for `/w/[slug]/*` and was
intentionally left untouched so the URL surface area of this PR is small.
Future work: migrate it to `requireMinLevel(ws.id, RBAC_LEVELS.LEARNER)` so
shared members can land on the workspace page.

## 7. Schema additions

See [`src/lib/db/schema-rbac.ts`](../../src/lib/db/schema-rbac.ts) and the
SQL in [`drizzle/migrations/0002_rbac_tables.sql`](../../drizzle/migrations/0002_rbac_tables.sql).

### 7.1 `workspace_members`

```
id            uuid pk
workspace_id  uuid FK workspaces.id ON DELETE CASCADE
user_id       uuid NOT NULL
role          varchar(32) NOT NULL DEFAULT 'learner'
invited_by    uuid
invited_at    timestamptz DEFAULT now()
joined_at     timestamptz
UNIQUE (workspace_id, user_id)
INDEX  (user_id)
```

The owner is not stored here. The unique `(workspace_id, user_id)` constraint
makes "two grants for one person" impossible.

### 7.2 `audit_log`

```
id            uuid pk
workspace_id  uuid FK workspaces.id ON DELETE SET NULL
actor_user_id uuid
actor_role    varchar(32)        -- canonical role at time of action
action        varchar(64) NOT NULL  -- 'tree_node.update', etc.
resource_type varchar(32) NOT NULL  -- 'tree_node'
resource_id   varchar(128)
before        jsonb
after         jsonb
created_at    timestamptz NOT NULL DEFAULT now()
INDEX (workspace_id, created_at DESC)
INDEX (actor_user_id, created_at DESC)
```

`workspace_id` uses `SET NULL` on workspace deletion so audit history outlives
the resource it audited. The role is *snapshotted* — if someone gets demoted
later, the audit row still shows the level they had when they acted.

## 8. Audit writer

```ts
await writeAudit({
  workspaceId,
  actorUserId: user.id,
  actorRole: ctx.role,
  action: 'tree_node.update',
  resourceType: 'tree_node',
  resourceId: node.id,
  before: { title: oldTitle },
  after:  { title: newTitle },
});
```

`writeAudit` swallows errors (logs to console) so a primary mutation cannot
be rolled back by a downstream audit failure. The DB constraint set is
permissive (nullable actor, nullable resource_id) so the row goes in even
when context is partial.

## 9. TOCTOU defense

The reference doc warns against `SELECT id → UPDATE id` patterns where the
tenant scope is only checked in the SELECT. The fix is to repeat the tenant
filter in the UPDATE/DELETE itself:

```ts
// Safe pattern used in tree-nodes.ts
await db.update(roadmapTreeNodes)
  .set(patch)
  .where(and(
    eq(roadmapTreeNodes.id, parsed.nodeId),
    eq(roadmapTreeNodes.workspaceId, ws.id),   // <-- repeated tenant scope
  ));
```

If a malicious client sends a `nodeId` belonging to a different workspace,
the WHERE clause matches zero rows and the UPDATE is a no-op. No leak.

All mutations in `tree-nodes.ts` already follow this pattern. The
`deleteTreeNode` DELETE statement also includes `workspace_id = ${ws.id}`.

## 10. 404 vs 403

Per §6 of the reference: when tenant scope mismatches, return 404 rather
than 403 to avoid leaking resource existence. `resolveWorkspace()` does
exactly this — both "no such workspace" and "forbidden" surface as
`WORKSPACE_NOT_FOUND_OR_FORBIDDEN`. The 403/UNAUTHORIZED distinction is kept
*inside* the RBAC error type for logs but is collapsed at the action
boundary.

## 11. Testing

The pure level math (`getRoleLevel`, `checkMinLevel`,
`canonicalRoleForLevel`) has no DB dependencies and can be unit-tested
without a Postgres fixture. The resolver paths that touch DB should be
covered by integration tests once a test-DB harness is added (see
DESIGN_FUTURE.md).

Existing test suite is unaffected: `pnpm test` continues to pass 82/82
because all tests are pure logic tests that don't exercise server actions.

## 12. Operational queries

```sql
-- Recent audit trail for a workspace
SELECT created_at, actor_role, action, resource_id
FROM audit_log
WHERE workspace_id = '...'
ORDER BY created_at DESC
LIMIT 50;

-- All grants for a user
SELECT workspace_id, role, joined_at
FROM workspace_members
WHERE user_id = '...';

-- Who acted on a specific resource
SELECT created_at, actor_user_id, actor_role, action
FROM audit_log
WHERE resource_type = 'tree_node' AND resource_id = '...'
ORDER BY created_at;
```

## 13. Quick reference

```ts
import { RBAC_LEVELS } from '@/lib/rbac/levels';
import { requireMinLevel, writeAudit } from '@/lib/rbac/server';

// In a server action:
const ctx = await requireMinLevel(workspaceId, RBAC_LEVELS.EDITOR);
// ... mutation ...
await writeAudit({
  workspaceId,
  actorUserId: ctx.user.id,
  actorRole:   ctx.role,
  action:      'lesson.publish',
  resourceType:'lesson',
  resourceId:  lessonId,
  before, after,
});
```

| You want…                        | Required level         |
|----------------------------------|-----------------------:|
| Read workspace (logged-in)       | `RBAC_LEVELS.LEARNER`  |
| Add a note to your own progress  | `RBAC_LEVELS.LEARNER`  |
| Add a new child node             | `RBAC_LEVELS.CONTRIBUTOR` |
| Edit content others wrote        | `RBAC_LEVELS.EDITOR`   |
| Delete content / transfer        | `RBAC_LEVELS.OWNER`    |
| Cross-workspace admin            | `RBAC_LEVELS.SUPER_ADMIN` |
