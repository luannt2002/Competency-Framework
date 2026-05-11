/**
 * Workspace-scoped layout — sidebar + topbar + main content.
 * Ensures user owns the workspace; throws otherwise.
 */
import { AppSidebar, BottomTabBar } from '@/components/layout/app-sidebar';
import { Topbar } from '@/components/layout/topbar';
import { requireWorkspaceAccess } from '@/lib/workspace';

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ws = await requireWorkspaceAccess(slug);

  return (
    <div className="flex min-h-dvh">
      <AppSidebar workspaceSlug={ws.slug} workspaceName={ws.name} />
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        <Topbar workspaceName={ws.name} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      <BottomTabBar workspaceSlug={ws.slug} />
    </div>
  );
}
