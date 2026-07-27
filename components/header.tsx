"use client";

export function Header({
  title = "Finance Hub",
  onSettingsClick,
}: {
  title?: string;
  onSettingsClick?: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 pt-4">
      <span className="text-sm font-medium text-secondary">{title}</span>
      <button
        onClick={onSettingsClick}
        aria-label="Einstellungen"
        className="w-9 h-9 rounded-full bg-surface border border-border flex items-center justify-center transition-transform active:scale-90"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111113" strokeWidth="1.8">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      </button>
    </div>
  );
}
