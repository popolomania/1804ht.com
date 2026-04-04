export default function Logo() {
  return (
    <div className="flex items-center gap-2">
      <svg
        aria-label="1804ht.com"
        viewBox="0 0 36 36"
        width="36"
        height="36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* House shape with Caribbean feel */}
        <rect width="36" height="36" rx="8" fill="hsl(186 72% 28%)" />
        {/* Roof */}
        <path d="M18 6L5 16H8V30H28V16H31L18 6Z" fill="white" />
        {/* Door */}
        <rect x="14" y="20" width="8" height="10" rx="1" fill="hsl(186 72% 28%)" />
        {/* Window left */}
        <rect x="9" y="18" width="4" height="4" rx="0.5" fill="hsl(186 72% 28%)" />
        {/* Window right */}
        <rect x="23" y="18" width="4" height="4" rx="0.5" fill="hsl(186 72% 28%)" />
      </svg>
      <div className="flex flex-col leading-none">
        <span className="font-bold text-base text-foreground tracking-tight">1804ht.com</span>
        <span className="text-xs text-muted-foreground font-normal">Immobilier</span>
      </div>
    </div>
  );
}
