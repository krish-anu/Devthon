export default function AdminLoading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--background)]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative flex items-center justify-center w-28 h-28">
          <span
            className="absolute inset-0 m-auto rounded-full border opacity-30 lag-spin-lag"
            style={{ width: 112, height: 112, borderWidth: 4, borderColor: 'rgba(0,0,0,0.08)' }}
            aria-hidden
          />

          <img
            src="/favicon.svg"
            alt="Trash2Treasure logo"
            width={80}
            height={80}
            className="relative z-10 lag-spin"
          />
        </div>

        <div className="text-sm text-(--muted)">Loading admin…</div>
      </div>
    </div>
  );
}
