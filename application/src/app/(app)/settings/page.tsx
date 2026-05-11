/**
 * Settings — minimal MVP. M5 will add: theme toggle UI, sound, reduced motion, etc.
 */
import { requireUser } from '@/lib/auth/supabase-server';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Settings as SettingsIcon } from 'lucide-react';

export default async function SettingsPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-2xl p-6 md:p-8 space-y-6">
      <header className="flex items-center gap-3">
        <SettingsIcon className="size-6 text-cyan-400" />
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Theme & visual preferences</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Dark mode is the default. Light theme toggle coming in M5.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Learning preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-muted-foreground space-y-1.5">
            <li>· Daily XP goal — M5</li>
            <li>· Sound effects — M5</li>
            <li>· Reduced motion — M5</li>
            <li>· Streak freeze days — M5</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
