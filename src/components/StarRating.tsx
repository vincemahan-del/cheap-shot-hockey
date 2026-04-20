export function StarRating({ value, count }: { value: number; count?: number }) {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return (
    <div className="flex items-center gap-1 text-xs">
      <div className="flex" aria-label={`Rated ${value.toFixed(1)} out of 5`}>
        {Array.from({ length: 5 }).map((_, i) => {
          const fill =
            i < full ? "#f59e0b" : i === full && half ? "url(#half)" : "transparent";
          return (
            <svg
              key={i}
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="half">
                  <stop offset="50%" stopColor="#f59e0b" />
                  <stop offset="50%" stopColor="transparent" />
                </linearGradient>
              </defs>
              <path
                d="M12 2l3 6.9 7.5.6-5.7 4.9 1.8 7.3L12 17.8 5.4 21.7l1.8-7.3L1.5 9.5l7.5-.6L12 2z"
                fill={fill}
                stroke="#f59e0b"
                strokeWidth="1.2"
              />
            </svg>
          );
        })}
      </div>
      <span className="font-semibold text-[color:var(--foreground)]">{value.toFixed(1)}</span>
      {count != null && (
        <span className="text-[color:var(--muted)]">({count})</span>
      )}
    </div>
  );
}
