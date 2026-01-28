export function SectionHeading({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return (
    <div className="space-y-2">
      {eyebrow && (
        <span className="text-xs uppercase tracking-[0.3em] text-[color:var(--brand)] opacity-70">
          {eyebrow}
        </span>
      )}
      <h2 className="text-3xl font-semibold text-[color:var(--foreground)] md:text-4xl">{title}</h2>
      {description && (
        <p className="text-base text-[color:var(--muted)] md:text-lg">{description}</p>
      )}
    </div>
  );
}
