import { useEffect, useState } from "react";
import { downloadFile } from "../../../utils/helper";

// Lightbox — full-screen carousel for chat images.
//
// Props:
//  - urls: array of image URLs to scroll through
//  - startIndex: which image to show first
//  - onClose: closes the modal
//
// Keyboard nav: ← → for prev/next, Esc to close.
// We also swallow background clicks (clicking the dark backdrop closes it,
// clicking the image itself does not).

export default function Lightbox({ urls = [], startIndex = 0, onClose }) {
  const [index, setIndex] = useState(
    Math.min(Math.max(startIndex || 0, 0), Math.max(urls.length - 1, 0))
  );

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose?.();
      else if (e.key === "ArrowRight")
        setIndex((i) => (i + 1) % Math.max(urls.length, 1));
      else if (e.key === "ArrowLeft")
        setIndex(
          (i) => (i - 1 + Math.max(urls.length, 1)) % Math.max(urls.length, 1)
        );
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [urls.length, onClose]);

  if (!urls.length) return null;
  const url = urls[index];
  const total = urls.length;

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose?.();
        }}
        aria-label="Close"
        className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white text-xl flex items-center justify-center"
      >
        ×
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          downloadFile(url);
        }}
        className="absolute top-3 right-16 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs"
      >
        Download
      </button>

      {total > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIndex((i) => (i - 1 + total) % total);
            }}
            aria-label="Previous"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white text-xl flex items-center justify-center"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIndex((i) => (i + 1) % total);
            }}
            aria-label="Next"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white text-xl flex items-center justify-center"
          >
            ›
          </button>
        </>
      )}

      <img
        src={url}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-w-[92vw] max-h-[88vh] object-contain"
      />

      {total > 1 && (
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/10 text-white text-xs"
          onClick={(e) => e.stopPropagation()}
        >
          {index + 1} / {total}
        </div>
      )}
    </div>
  );
}
