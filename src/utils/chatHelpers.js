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

// Group an ordered list of messages into a list of "render groups" so that
// consecutive image-only messages from the same sender become a single grid
// instead of a stack of one-image bubbles. Non-image messages and any
// boundary (different sender, gap of >2 minutes, system message) end the
// current group.
//
// Each output entry is either:
//   { kind: "single", message }  — render normally
//   { kind: "image-group", sender, messages: [...] }  — render as a grid
export const groupConsecutiveImages = (messages = []) => {
  if (!Array.isArray(messages) || messages.length === 0) return [];
  const out = [];
  let currentGroup = null;

  const isPureImageMessage = (m) =>
    !!m &&
    !m.isDeleted &&
    !m.isSystem &&
    typeof m.message === "string" &&
    isImage(m.message);

  for (const msg of messages) {
    if (isPureImageMessage(msg)) {
      const sameSender =
        currentGroup &&
        String(currentGroup.sender) === String(msg.sender);
      const recentEnough =
        currentGroup &&
        currentGroup.messages.length > 0 &&
        Math.abs(
          new Date(msg.createdAt).getTime() -
            new Date(
              currentGroup.messages[currentGroup.messages.length - 1].createdAt
            ).getTime()
        ) < 2 * 60 * 1000;
      if (currentGroup && sameSender && recentEnough) {
        currentGroup.messages.push(msg);
        continue;
      }
      currentGroup = {
        kind: "image-group",
        sender: msg.sender,
        messages: [msg],
      };
      out.push(currentGroup);
    } else {
      currentGroup = null;
      out.push({ kind: "single", message: msg });
    }
  }
  return out;
};
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

// URL detector. Catches http(s) and bare www.* URLs but stays conservative —
// won't grab trailing punctuation like commas/periods that aren't part of the
// URL. Trailing parens are excluded only when they don't have a matching
// opening paren in the URL itself.
const URL_REGEX = /\b((?:https?:\/\/|www\.)[^\s<>"]+)/gi;

// Trim noisy punctuation off the end of a captured URL while keeping balanced
// brackets/parens (Wikipedia-style URLs).
const trimUrlTrailingPunct = (match) => {
  let url = match;
  // Strip trailing punctuation that's almost never part of an actual URL.
  let stripped = true;
  while (stripped && url.length > 0) {
    stripped = false;
    const last = url[url.length - 1];
    if (",.;:!?".includes(last)) {
      url = url.slice(0, -1);
      stripped = true;
    } else if (last === ")" && (url.match(/\(/g) || []).length < (url.match(/\)/g) || []).length) {
      url = url.slice(0, -1);
      stripped = true;
    } else if (last === "]" && (url.match(/\[/g) || []).length < (url.match(/\]/g) || []).length) {
      url = url.slice(0, -1);
      stripped = true;
    }
  }
  return url;
};

// Tokenise message text into a list of plain text, mention, and url segments
// so the renderer can apply highlight styling and make urls clickable.
// Mentions are detected by name match against the supplied id->name map.
export const tokenizeMessage = (text, mentionIdToName = {}) => {
  if (!text) return [];

  // Build a regex that matches "@" followed by any of the known names. We
  // sort by length so longer names match before shorter substrings.
  const names = Object.values(mentionIdToName)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  const escapedNames = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const mentionPattern = names.length
    ? new RegExp(`@(${escapedNames.join("|")})`, "g")
    : null;

  // First pass: collect non-overlapping URL matches (with trimmed trailing
  // punctuation). We do URLs first because their boundaries are unambiguous.
  const ranges = [];
  let urlMatch;
  URL_REGEX.lastIndex = 0;
  while ((urlMatch = URL_REGEX.exec(text)) !== null) {
    const raw = urlMatch[0];
    const trimmed = trimUrlTrailingPunct(raw);
    if (!trimmed) continue;
    const start = urlMatch.index;
    const end = start + trimmed.length;
    const href = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
    ranges.push({ start, end, type: "url", value: trimmed, href });
  }

  // Second pass: collect mention matches that don't overlap any URL we already
  // found. This protects names that happen to appear inside a query string.
  if (mentionPattern) {
    let m;
    mentionPattern.lastIndex = 0;
    while ((m = mentionPattern.exec(text)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      const overlaps = ranges.some(
        (r) => !(end <= r.start || start >= r.end)
      );
      if (overlaps) continue;
      ranges.push({ start, end, type: "mention", value: m[1] });
    }
  }

  ranges.sort((a, b) => a.start - b.start);

  // Stitch the tokens together with the surrounding plain text.
  const tokens = [];
  let cursor = 0;
  for (const r of ranges) {
    if (r.start > cursor) {
      tokens.push({ type: "text", value: text.slice(cursor, r.start) });
    }
    if (r.type === "url") {
      tokens.push({ type: "url", value: r.value, href: r.href });
    } else {
      tokens.push({ type: "mention", value: r.value });
    }
    cursor = r.end;
  }
  if (cursor < text.length) {
    tokens.push({ type: "text", value: text.slice(cursor) });
  }
  return tokens;
};
