const safeDecode = (value) => {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
};

export const getFileNameFromUrl = (url) => {
  if (!url) return "file";
  try {
    const parsed = new URL(url);
    const nameParam = parsed.searchParams.get("filename") || parsed.searchParams.get("name");
    if (nameParam) return safeDecode(nameParam);
    const name = parsed.pathname.split("/").pop();
    return safeDecode(name || "file");
  } catch (error) {
    const [pathPart, queryPart] = url.split("?");
    if (queryPart) {
      const params = new URLSearchParams(queryPart);
      const nameParam = params.get("filename") || params.get("name");
      if (nameParam) return safeDecode(nameParam);
    }
    const name = pathPart.split("/").pop() || "file";
    return safeDecode(name);
  }
};

const extensionFromContentType = (contentType = "") => {
  const type = contentType.toLowerCase();
  if (type.includes("pdf")) return "pdf";
  if (type.includes("csv")) return "csv";
  if (type.includes("msword")) return "doc";
  if (type.includes("officedocument.wordprocessingml")) return "docx";
  if (type.includes("officedocument.spreadsheetml")) return "xlsx";
  if (type.includes("officedocument.presentationml")) return "pptx";
  if (type.includes("vnd.ms-excel")) return "xls";
  if (type.includes("vnd.ms-powerpoint")) return "ppt";
  if (type.includes("zip")) return "zip";
  if (type.includes("rar")) return "rar";
  if (type.includes("text/plain")) return "txt";
  if (type.startsWith("image/")) return type.split("/")[1] || "";
  if (type.startsWith("audio/")) return type.split("/")[1] || "";
  if (type.startsWith("video/")) return type.split("/")[1] || "";
  return "";
};

const ensureExtension = (name, contentType) => {
  if (!name) return name;
  const trimmed = name.split("?")[0];
  if (trimmed.includes(".")) return name;
  const ext = extensionFromContentType(contentType);
  if (!ext) return name;
  return `${name}.${ext}`;
};

// Convert any URL into one that forces a "Save As" download with the right
// filename. For Cloudinary URLs we inject `fl_attachment:<filename>` into the
// transformation segment of the URL — this is the supported way to make
// Cloudinary set Content-Disposition: attachment so the browser downloads
// instead of opening inline (which is what was happening for PDFs / payslips
// / monthly reports). Works across image, video, and raw resource types.
const getDownloadUrl = (url, fallbackName) => {
  if (!url) return url;
  if (!url.includes("cloudinary.com")) return url;
  try {
    const parsed = new URL(url);
    // Strip any prior `filename=` query so the browser doesn't fight us.
    parsed.searchParams.delete("filename");
    parsed.searchParams.delete("name");
    const segments = parsed.pathname.split("/");
    // A typical Cloudinary URL looks like:
    //   /<cloud>/image/upload/v1700000000/folder/myfile.png
    //              ^^^^^^^ = resource type (image|video|raw)
    //                     ^^^^^^^ = delivery type (upload|fetch|...)
    // We insert the fl_attachment transformation right after the delivery
    // type. If the URL already has transformations there we slot ours in
    // alongside them.
    const deliveryIndex = segments.findIndex((s) => s === "upload");
    if (deliveryIndex === -1 || deliveryIndex >= segments.length - 1) {
      const sep = url.includes("?") ? "&" : "?";
      return `${url}${sep}fl_attachment`;
    }
    const cleanName = (fallbackName || getFileNameFromUrl(url) || "download")
      .replace(/[^A-Za-z0-9._-]+/g, "_")
      .replace(/\.[^.]*$/, ""); // strip trailing extension; Cloudinary keeps it from the asset
    const flag = `fl_attachment:${cleanName}`;
    const next = segments[deliveryIndex + 1];
    // If the next segment looks like a transformation (no dot, no version
    // marker `v123…`), prepend our flag with a comma. Otherwise insert as
    // its own segment.
    const looksLikeVersion = /^v\d+$/.test(next || "");
    const looksLikeTransform =
      next && !looksLikeVersion && !next.includes(".") && !next.includes("/");
    if (looksLikeTransform) {
      segments[deliveryIndex + 1] = `${flag},${next}`;
    } else {
      segments.splice(deliveryIndex + 1, 0, flag);
    }
    parsed.pathname = segments.join("/");
    return parsed.toString();
  } catch (error) {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}fl_attachment`;
  }
};

// Download a remote file with the right filename. We try a same-origin-style
// blob fetch first (gives the cleanest UX — direct save with no extra tab),
// and fall back to navigating the browser to the Cloudinary `fl_attachment`
// URL when CORS blocks the fetch. The fallback opens a new tab that
// immediately triggers a download because of the attachment header.
export const downloadFile = async (url, fallbackName) => {
  if (!url) return;
  const downloadUrl = getDownloadUrl(url, fallbackName);
  try {
    // We use `mode: 'cors'` explicitly so failures throw rather than returning
    // an opaque response we can't read.
    const response = await fetch(downloadUrl, { mode: "cors" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const disposition = response.headers.get("content-disposition") || "";
    const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
    const headerName = match?.[1] ? safeDecode(match[1]) : null;
    const contentType = response.headers.get("content-type") || "";
    const rawName = headerName || fallbackName || getFileNameFromUrl(url);
    const fileName = ensureExtension(rawName, contentType);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName || "download";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
  } catch (error) {
    // CORS, network, or non-OK response — fall back to opening the
    // attachment-flagged URL directly. The browser sees the
    // Content-Disposition header from Cloudinary and downloads.
    console.warn("Direct download blocked, falling back to new tab:", error?.message);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.download = fallbackName || getFileNameFromUrl(url) || "download";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
};

export const downloadImage = async (url) => downloadFile(url);
