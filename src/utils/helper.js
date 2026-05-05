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

const getDownloadUrl = (url) => {
  if (!url) return url;
  if (url.includes("cloudinary")) {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}fl_attachment`;
  }
  return url;
};

export const downloadFile = async (url, fallbackName) => {
  try {
    const downloadUrl = getDownloadUrl(url);
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error("Download failed");
    }
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const disposition = response.headers.get("content-disposition") || "";
    const match = disposition.match(/filename="?([^"]+)"?/i);
    const headerName = match?.[1];
    const contentType = response.headers.get("content-type") || "";
    const rawName = headerName || fallbackName || getFileNameFromUrl(url);
    const fileName = ensureExtension(rawName, contentType);

    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error("File download failed:", error);
    const fallbackUrl = getDownloadUrl(url);
    if (fallbackUrl) {
      window.open(fallbackUrl, "_blank", "noopener");
    }
  }
};

export const downloadImage = async (url) => downloadFile(url);
