// ImageGrid — renders a Slack/WhatsApp-style mosaic of chat images.
//
// One image  → render it at a comfortable size.
// Two       → side-by-side equal halves.
// Three     → one tall + two stacked, or a 2x2 with the last cell as the +N counter.
// Four      → 2x2 grid.
// 5+        → 2x2 grid with the last cell showing "+N more".
//
// Clicking any tile fires onOpen(index) so the parent can pop the lightbox
// at the right slide. We deliberately keep this component dumb — no internal
// state, no socket events — so it can be re-used in DMs and the Client app
// without extra wiring.

export default function ImageGrid({ urls = [], onOpen }) {
  const count = urls.length;
  if (count === 0) return null;

  // Single — full width preview tile (still smaller than the lightbox view).
  if (count === 1) {
    return (
      <button
        type="button"
        onClick={() => onOpen?.(0)}
        className="block overflow-hidden rounded-md border border-slate-200 bg-white"
      >
        <img
          src={urls[0]}
          alt=""
          loading="lazy"
          className="block max-h-[260px] max-w-[260px] object-cover"
        />
      </button>
    );
  }

  // 2 → row of two equal squares.
  if (count === 2) {
    return (
      <div className="grid grid-cols-2 gap-1 max-w-[280px]">
        {urls.map((u, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onOpen?.(i)}
            className="block overflow-hidden rounded-md border border-slate-200 bg-white aspect-square"
          >
            <img
              src={u}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>
    );
  }

  // 3 → first image takes the full first row, then two below.
  if (count === 3) {
    return (
      <div className="flex flex-col gap-1 max-w-[280px]">
        <button
          type="button"
          onClick={() => onOpen?.(0)}
          className="block overflow-hidden rounded-md border border-slate-200 bg-white"
        >
          <img
            src={urls[0]}
            alt=""
            loading="lazy"
            className="w-full h-[160px] object-cover"
          />
        </button>
        <div className="grid grid-cols-2 gap-1">
          {[1, 2].map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => onOpen?.(i)}
              className="block overflow-hidden rounded-md border border-slate-200 bg-white aspect-square"
            >
              <img
                src={urls[i]}
                alt=""
                loading="lazy"
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // 4+ → 2x2 grid. If there are more than 4, the last tile shows "+N".
  const visible = urls.slice(0, 4);
  const overflow = count - 4;
  return (
    <div className="grid grid-cols-2 gap-1 max-w-[280px]">
      {visible.map((u, i) => {
        const isLast = i === 3 && overflow > 0;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onOpen?.(i)}
            className="relative block overflow-hidden rounded-md border border-slate-200 bg-white aspect-square"
          >
            <img
              src={u}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover"
            />
            {isLast && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-white text-base font-semibold">
                +{overflow}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
