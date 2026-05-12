import React, { useEffect, useRef, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme, type ThemeMode } from '../context/ThemeContext';

const OPTIONS: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <Sun className="w-4 h-4" /> },
  { value: 'dark', label: 'Dark', icon: <Moon className="w-4 h-4" /> },
  { value: 'system', label: 'System', icon: <Monitor className="w-4 h-4" /> },
];

export default function ThemeToggle() {
  const { mode, setMode, isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const currentIcon =
    mode === 'system' ? <Monitor className="w-4 h-4" /> :
    isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="p-2 rounded-lg transition-colors text-gray-400 hover:text-yellow-400 hover:bg-black/10 dark:hover:bg-white/10"
        title="Theme"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {currentIcon}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-40 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-tb-card shadow-lg z-50 py-1"
        >
          {OPTIONS.map(opt => {
            const active = mode === opt.value;
            return (
              <button
                key={opt.value}
                role="menuitemradio"
                aria-checked={active}
                onClick={() => { setMode(opt.value); setOpen(false); }}
                className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left transition-colors ${
                  active
                    ? 'text-accent-blue bg-accent-blue/10'
                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <span className={active ? 'text-accent-blue' : 'text-gray-500 dark:text-gray-400'}>
                  {opt.icon}
                </span>
                <span className="flex-1">{opt.label}</span>
                {active && <span className="w-1.5 h-1.5 rounded-full bg-accent-blue" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
