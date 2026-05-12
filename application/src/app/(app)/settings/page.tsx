/**
 * Settings — wired client form persisted in localStorage.
 */
import { requireUser } from '@/lib/auth/supabase-server';
import { SettingsForm } from '@/components/settings/settings-form';
import { EffectsSection } from '@/components/settings/effects-section';
import { Settings as SettingsIcon } from 'lucide-react';

export default async function SettingsPage() {
  await requireUser();

  return (
    <div
      className="mx-auto max-w-2xl p-6 md:p-8 space-y-8"
      style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
    >
      <header className="flex items-center gap-3 sm:gap-4">
        <div className="size-10 sm:size-12 rounded-2xl accent-gradient flex items-center justify-center shadow-lg shadow-cyan-500/20 shrink-0">
          <SettingsIcon className="size-5 sm:size-6 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Personal preferences — stored in your browser.
          </p>
        </div>
      </header>

      <SettingsForm />

      <EffectsSection />
    </div>
  );
}
