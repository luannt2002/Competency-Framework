'use client';

/**
 * Client form for /settings — persists preferences in localStorage.
 * Real prefs (theme, sound, daily goal, reduced motion) tied to localStorage
 * so they survive reload without DB round-trip.
 */
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { Moon, Sun, Volume2, VolumeX, Zap, Sparkles } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';

const GOAL_OPTIONS = [30, 60, 120, 300] as const;

export function SettingsForm() {
  const { theme, setTheme } = useTheme();
  const [sound, setSound] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [dailyGoal, setDailyGoal] = useState<number>(60);
  const [lang, setLang] = useState<'vi' | 'en'>('vi');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      setSound(localStorage.getItem('pref:sound') === 'true');
      setReducedMotion(localStorage.getItem('pref:reduced-motion') === 'true');
      setDailyGoal(Number(localStorage.getItem('pref:daily-goal')) || 60);
      const l = (localStorage.getItem('pref:lang') ?? 'vi') as 'vi' | 'en';
      setLang(l);
    } catch {
      /* no-op */
    }
  }, []);

  const save = <T,>(key: string, value: T) => {
    try {
      localStorage.setItem(key, String(value));
    } catch {
      /* no-op */
    }
  };

  if (!mounted) {
    return <div className="surface p-6 animate-pulse h-48" />;
  }

  return (
    <div className="space-y-4">
      {/* Theme */}
      <Row
        icon={theme === 'dark' ? Moon : Sun}
        label="Dark mode"
        description="Switch between dark (recommended) and light theme."
        action={
          <Switch
            checked={theme === 'dark'}
            onCheckedChange={(v) => {
              setTheme(v ? 'dark' : 'light');
              toast.success(v ? 'Dark mode on' : 'Light mode on');
            }}
          />
        }
      />

      {/* Sound */}
      <Row
        icon={sound ? Volume2 : VolumeX}
        label="Sound effects"
        description="Play subtle audio cues on correct/wrong answers."
        action={
          <Switch
            checked={sound}
            onCheckedChange={(v) => {
              setSound(v);
              save('pref:sound', v);
              toast.success(v ? 'Sound on' : 'Sound off');
            }}
          />
        }
      />

      {/* Reduced motion */}
      <Row
        icon={Sparkles}
        label="Reduced motion"
        description="Disable confetti and large transitions (a11y)."
        action={
          <Switch
            checked={reducedMotion}
            onCheckedChange={(v) => {
              setReducedMotion(v);
              save('pref:reduced-motion', v);
            }}
          />
        }
      />

      {/* Daily goal */}
      <div className="surface p-5">
        <div className="flex items-start gap-4">
          <Zap className="size-5 text-amber-400 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium">Daily XP goal</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Target XP earned per day. Drives the streak indicator.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {GOAL_OPTIONS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => {
                    setDailyGoal(g);
                    save('pref:daily-goal', g);
                    toast.success(`Daily goal: ${g} XP`);
                  }}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    dailyGoal === g
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {g} XP {g === 60 ? '· Casual' : g === 120 ? '· Regular' : g === 300 ? '· Intense' : '· Light'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Language */}
      <div className="surface p-5">
        <h3 className="text-sm font-medium">Language</h3>
        <p className="text-xs text-muted-foreground mt-0.5">UI labels only (MVP).</p>
        <div className="mt-3 flex gap-2">
          {(['vi', 'en'] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => {
                setLang(l);
                save('pref:lang', l);
                toast.success(`Language: ${l.toUpperCase()}`);
              }}
              className={`rounded-full border px-3 py-1 text-xs font-mono uppercase transition-colors ${
                lang === l
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Danger zone */}
      <div className="surface p-5 border-destructive/30">
        <h3 className="text-sm font-medium text-destructive">Danger zone</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Reset is irreversible — you'll lose all assessments + XP for the workspace.
        </p>
        <div className="mt-3 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (window.confirm('Clear local preferences?')) {
                ['pref:sound', 'pref:reduced-motion', 'pref:daily-goal', 'pref:lang'].forEach((k) =>
                  localStorage.removeItem(k),
                );
                toast.success('Preferences cleared');
                window.location.reload();
              }
            }}
          >
            Clear preferences
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  description,
  action,
}: {
  icon: typeof Moon;
  label: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="surface p-5 flex items-center gap-4">
      <Icon className="size-5 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium">{label}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      {action}
    </div>
  );
}
