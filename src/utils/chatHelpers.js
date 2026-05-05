// Shared chat helpers — file preview, mention parsing, time-window guards, etc.
// Kept self-contained so it can be copied to Admin / Employees / Client without
// drift. Imported by Chat.jsx and ChannelChat.jsx.

import { getFileNameFromUrl } from "./helper";

// 2-hour edit/delete window per spec (features #3 + #5).
export const EDIT_WINDOW_MS = 2 * 60 * 60 * 1000;
export const isWithinEditWindow = (createdAt) => {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;
  return Date.now() - created <= EDIT_WINDOW_MS;
};

export const formatRemainingEditWindow = (createdAt) => {
  if (!createdAt) return "";
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return "";
  const remainingMs = EDIT_WINDOW_MS - (Date.now() - created);
  if (remainingMs <= 0) return "0m";
  const totalMin = Math.floor(remainingMs / 60000);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

// File-preview classification (feature #9). Mirrors the backend's regex set.
export const isImage = (url) => /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(url);
export const isVideo = (url) => /\.(mp4|webm|ogg|mov|mkv)(\?|$)/i.test(url);
export const isAudio = (url) => /\.(mp3|wav|ogg|m4a|aac)(\?|$)/i.test(url);
export const isPdf = (url) => /\.pdf(\?|$)/i.test(url);
export const isDocument = (url) =>
  /\.(pdf|docx|doc|xlsx|xls|pptx|ppt|csv|txt|zip|rar)(\?|$)/i.test(url);
export const isSpreadsheet = (url) => /\.(csv|xlsx|xls)(\?|$)/i.test(url);
export const isPresentation = (url) => /\.(ppt|pptx)(\?|$)/i.test(url);
export const isWordDoc = (url) => /\.(doc|docx)(\?|$)/i.test(url);
export const isArchive = (url) => /\.(zip|rar|7z|tar|gz)(\?|$)/i.test(url);
export const isLikelyAttachment = (url) =>
  url?.startsWith("http") &&
  (isImage(url) ||
    isDocument(url) ||
    isVideo(url) ||
    isAudio(url) ||
    url.includes("cloudinary"));

export const getFileExtension = (url) => {
  const fileName = getFileNameFromUrl(url);
  const parts = fileName.split(".");
  if (parts.length < 2) return "";
  return parts.pop().toLowerCase();
};

// Color hint per file type for the inline preview chip.
export const getFileTypeColor = (url) => {
  if (isImage(url)) return "bg-emerald-100 text-emerald-700";
  if (isVideo(url)) return "bg-purple-100 text-purple-700";
  if (isAudio(url)) return "bg-blue-100 text-blue-700";
  if (isPdf(url)) return "bg-red-100 text-red-700";
  if (isSpreadsheet(url)) return "bg-green-100 text-green-700";
  if (isPresentation(url)) return "bg-orange-100 text-orange-700";
  if (isWordDoc(url)) return "bg-sky-100 text-sky-700";
  if (isArchive(url)) return "bg-amber-100 text-amber-700";
  return "bg-gray-100 text-gray-700";
};

// Friendly message-list preview (used in reply previews etc.).
export const getMessagePreview = (value) => {
  if (!value) return "";
  if (value.startsWith("http")) {
    if (isImage(value)) return "Photo";
    if (isVideo(value)) return `Video: ${getFileNameFromUrl(value)}`;
    if (isAudio(value)) return `Audio: ${getFileNameFromUrl(value)}`;
    if (isPdf(value)) return `PDF: ${getFileNameFromUrl(value)}`;
    if (isDocument(value)) return `Document: ${getFileNameFromUrl(value)}`;
    return "Link";
  }
  return value.length > 80 ? `${value.slice(0, 80)}...` : value;
};

// ---------- Mention helpers (feature #4) ----------
//
// We store mentions as a list of user ids and render them inline by replacing
// "@Name " with a styled chip. This keeps the message text human-readable on
// older clients while letting modern clients highlight + link the mention.

// Find an active "@query" trigger ending at the cursor.
// Returns { from, to, query } if the cursor is in a mention, otherwise null.
export const detectMentionTrigger = (text, cursor) => {
  if (typeof text !== "string" || typeof cursor !== "number") return null;
  // Walk backwards from the cursor to find the most recent '@'.
  let i = cursor - 1;
  while (i >= 0) {
    const ch = text[i];
    // Trigger broken by whitespace before another '@'.
    if (ch === "\n" || ch === " ") return null;
    if (ch === "@") {
      // Must be at start of text or follow whitespace/newline to count.
      if (i === 0 || /\s/.test(text[i - 1])) {
        return { from: i, to: cursor, query: text.slice(i + 1, cursor) };
      }
      return null;
    }
    i -= 1;
  }
  return null;
};

// Score & filter candidates by the current query. Empty query returns all.
export const filterMentionCandidates = (candidates, query) => {
  const list = Array.isArray(candidates) ? candidates : [];
  if (!query) return list.slice(0, 8);
  const q = query.toLowerCase();
  return list
    .filter((c) => (c?.name || "").toLowerCase().includes(q))
    .slice(0, 8);
};

// Replace the active "@query" with a "@FullName " chunk and return the new
// text + the new cursor position.
export const insertMention = (text, trigger, name) => {
  const before = text.slice(0, trigger.from);
  const after = text.slice(trigger.to);
  const tag = `@${name} `;
  return {
    text: `${before}${tag}${after}`,
    cursor: before.length + tag.length,
  };
};

// Tokenise message text into a list of plain text and mention segments so the
// renderer can apply highlight styling. Mentions are detected by name match
// against the supplied id->name map.
export const tokenizeMessage = (text, mentionIdToName = {}) => {
  if (!text) return [];
  // Build a regex that matches "@" followed by any of the known names. We
  // sort by length so longer names match before shorter substrings.
  const names = Object.values(mentionIdToName)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  if (names.length === 0) return [{ type: "text", value: text }];
  // Escape for regex
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`@(${escaped.join("|")})`, "g");
  const tokens = [];
  let lastIndex = 0;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    tokens.push({ type: "mention", value: match[1] });
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) {
    tokens.push({ type: "text", value: text.slice(lastIndex) });
  }
  return tokens;
};
