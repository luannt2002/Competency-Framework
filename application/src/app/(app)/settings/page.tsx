/**
 * Settings — wired client form persisted in localStorage.
 */
import { requireUser } from '@/lib/auth/supabase-server';
import { SettingsForm } from '@/components/settings/settings-form';
import { Settings as SettingsIcon } from 'lucide-react';

export default async function SettingsPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-2xl p-6 md:p-8 space-y-6">
      <header className="flex items-center gap-3">
        <SettingsIcon className="size-6 text-cyan-400" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Personal preferences — stored in your browser.
          </p>
        </div>
      </header>

      <SettingsForm />
    </div>
  );
}
