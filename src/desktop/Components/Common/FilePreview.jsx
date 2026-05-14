import { useState } from "react";
import { downloadFile, getFileNameFromUrl } from "../../../utils/helper";
import {
  isAudio,
  isImage,
  isPdf,
  isPresentation,
  isSpreadsheet,
  isVideo,
  isWordDoc,
  isArchive,
  getFileExtension,
  getFileTypeColor,
} from "../../../utils/chatHelpers";

/**
 * In-chat file preview. Supports inline preview of images, video, audio, and
 * PDF. For other formats (CSV, Excel, etc.) a colored type chip is rendered as
 * a "file-type preview indicator" per the spec (feature #9).
 *
 * Clicking the type chip or "Preview" link opens an overlay viewer where
 * possible (image lightbox / PDF / video / audio) so the user can preview
 * without downloading.
 */
export default function FilePreview({ url, compact = false }) {
  const [overlay, setOverlay] = useState(false);
  const fileName = getFileNameFromUrl(url);
  const extension = getFileExtension(url);
  const badge = extension ? extension.toUpperCase() : "FILE";

  const previewable = isImage(url) || isVideo(url) || isAudio(url) || isPdf(url);

  // The compact "type indicator" row used for non-previewable files.
  const typeRow = (
    <div className="inline-flex items-center gap-2 bg-white/90 text-gray-800 p-2 rounded-lg max-w-fit">
      <span
        className={`text-[10px] font-semibold px-2 py-0.5 rounded ${getFileTypeColor(
          url
        )}`}
        title={`${badge} file`}
      >
        {badge}
      </span>
      <span
        className="truncate w-32 text-[11px]"
        title={fileName}
      >
        {fileName}
      </span>
      {previewable && (
        <button
          type="button"
          onClick={() => setOverlay(true)}
          className="px-2 py-1 bg-slate-700 text-white text-xs rounded-full shrink-0 hover:bg-slate-800"
        >
          Preview
        </button>
      )}
      <button
        type="button"
        onClick={() => downloadFile(url)}
        className="px-2 py-1 bg-slate-900 text-white text-xs rounded-full shrink-0 shadow-md hover:bg-slate-800"
      >
        Download
      </button>
    </div>
  );

  // Inline players for media types (feature #9 — preview without downloading).
  let inline = null;
  if (compact) {
    inline = null;
  } else if (isImage(url)) {
    inline = (
      <button type="button" onClick={() => setOverlay(true)} className="block">
        <img
          src={url}
          alt={fileName}
          className="w-44 max-w-full h-auto rounded-md cursor-zoom-in"
        />
      </button>
    );
  } else if (isVideo(url)) {
    inline = (
      <video
        src={url}
        controls
        preload="metadata"
        className="w-[220px] max-w-full rounded-md"
      />
    );
  } else if (isAudio(url)) {
    inline = (
      <audio
        src={url}
        controls
        preload="metadata"
        className="w-[220px] max-w-full"
      />
    );
  } else if (isPdf(url)) {
    inline = (
      <iframe
        src={url}
        title={fileName}
        className="w-[220px] h-[160px] max-w-full rounded-md border border-gray-200 bg-white"
      />
    );
  }

  return (
    <>
      <div className="inline-flex flex-col gap-1.5 max-w-xs">
        {inline}
        {typeRow}
      </div>

      {overlay && (
        <div
          className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setOverlay(false)}
        >
          <div
            className="relative max-w-5xl max-h-[90vh] w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOverlay(false)}
              className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-white text-gray-700 shadow flex items-center justify-center"
              aria-label="Close preview"
            >
              ×
            </button>
            {isImage(url) && (
              <img
                src={url}
                alt={fileName}
                className="w-full h-full max-h-[90vh] object-contain"
              />
            )}
            {isVideo(url) && (
              <video
                src={url}
                controls
                autoPlay
                className="w-full max-h-[90vh]"
              />
            )}
            {isAudio(url) && (
              <div className="bg-white rounded p-6 flex items-center justify-center">
                <audio src={url} controls autoPlay className="w-full" />
              </div>
            )}
            {isPdf(url) && (
              <iframe
                src={url}
                title={fileName}
                className="w-full h-[85vh] bg-white rounded"
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
