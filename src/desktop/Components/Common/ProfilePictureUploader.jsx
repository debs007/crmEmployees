import { useRef, useState } from "react";
import Avatar from "./Avatar";

/**
 * Modal-friendly avatar uploader. POSTs to /profile/avatar (multipart) and
 * notifies the parent on success so the rest of the app can refresh the visible
 * avatar everywhere.
 */
export default function ProfilePictureUploader({
  name,
  currentAvatar,
  onUpdated,
  size = 96,
  showRemove = true,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(currentAvatar || "");
  const fileRef = useRef(null);

  const apiBase = import.meta.env.VITE_BACKEND_API;
  const token = () => localStorage.getItem("token");

  const handlePick = () => fileRef.current?.click();

  const handleChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be smaller than 5MB.");
      return;
    }
    setError("");
    setBusy(true);
    // Local preview while we upload
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);

    try {
      const fd = new FormData();
      fd.append("avatar", file);
      const res = await fetch(`${apiBase}/profile/avatar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}` },
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Upload failed");
      }
      setPreview(data.avatar || "");
      onUpdated?.(data.profile || { avatar: data.avatar });
    } catch (err) {
      setError(err.message || "Upload failed");
      setPreview(currentAvatar || "");
    } finally {
      setBusy(false);
      URL.revokeObjectURL(localUrl);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    if (!preview) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/profile/avatar`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Could not remove image");
      }
      setPreview("");
      onUpdated?.(data.profile || { avatar: "" });
    } catch (err) {
      setError(err.message || "Could not remove image");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Avatar name={name} src={preview} size={size} />
      <div className="flex flex-col gap-1">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleChange}
        />
        <button
          type="button"
          onClick={handlePick}
          disabled={busy}
          className="px-3 py-1.5 text-xs rounded bg-orange-500 text-white disabled:opacity-60"
        >
          {busy ? "Uploading..." : preview ? "Change picture" : "Upload picture"}
        </button>
        {showRemove && preview && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={busy}
            className="px-3 py-1.5 text-xs rounded border border-gray-300 text-gray-700 disabled:opacity-60"
          >
            Remove
          </button>
        )}
        {error && <p className="text-[11px] text-red-500">{error}</p>}
      </div>
    </div>
  );
}
