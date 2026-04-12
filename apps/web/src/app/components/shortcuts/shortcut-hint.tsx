'use client';

interface ShortcutHintProps {
  keys: string;
}

export function ShortcutHint({ keys }: ShortcutHintProps) {
  const parts = keys.split(/[+ ]/).map((k) => {
    if (k === 'ctrl') return 'Ctrl';
    if (k === 'cmd') return 'Cmd';
    if (k === 'Escape') return 'Esc';
    return k.toUpperCase();
  });

  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden="true">
      {parts.map((part, i) => (
        <kbd
          key={i}
          className="inline-flex items-center justify-center rounded border border-neutral-200 bg-neutral-100 px-1 font-mono text-[10px] text-neutral-500"
        >
          {part}
        </kbd>
      ))}
    </span>
  );
}
