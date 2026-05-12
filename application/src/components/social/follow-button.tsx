'use client';

/**
 * Follow / unfollow toggle for the share page.
 *
 * Server renders the initial state (`initialFollowing`) from a query in the
 * page; this client owns the optimistic toggle. Errors revert. Anonymous
 * viewers get a redirect-to-sign-in fallback via the parent (we only render
 * this when `userId` is present).
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { followWorkspace, unfollowWorkspace } from '@/actions/follows';

type Props = {
  workspaceSlug: string;
  initialFollowing: boolean;
};

export function FollowButton({ workspaceSlug, initialFollowing }: Props) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    const next = !following;
    setFollowing(next); // optimistic
    startTransition(async () => {
      try {
        if (next) {
          await followWorkspace(workspaceSlug);
          toast.success('Đã theo dõi');
        } else {
          await unfollowWorkspace(workspaceSlug);
          toast.success('Đã bỏ theo dõi');
        }
        router.refresh();
      } catch (e) {
        // Revert on error.
        setFollowing(!next);
        toast.error('Lỗi', { description: String(e) });
      }
    });
  };

  return (
    <Button
      size="sm"
      variant={following ? 'outline' : 'default'}
      onClick={toggle}
      disabled={pending}
      type="button"
    >
      {pending ? (
        <Loader2 className="size-3 animate-spin" />
      ) : following ? (
        <Check className="size-3" />
      ) : (
        <Plus className="size-3" />
      )}
      {following ? 'Đang theo dõi' : 'Theo dõi roadmap'}
    </Button>
  );
}
