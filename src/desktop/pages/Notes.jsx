import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const normalizeNoteText = (value) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join("\n\n").trim();
  }
  if (typeof value === "string") {
    return value.trim();
  }
  return "";
};

export default function NotesPage() {
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState("muted");
  const token = localStorage.getItem("token");

  const fetchNotes = async () => {
    if (!token) return;

    try {
      setLoading(true);
      setStatusMessage("");
      const response = await axios.get(`${import.meta.env.VITE_BACKEND_API}/notepad/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setNotes(normalizeNoteText(response.data?.notes));
    } catch (error) {
      console.error("Error fetching notes:", error);
      setStatusTone("error");
      setStatusMessage("Unable to load notes right now.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!token) {
      setStatusTone("error");
      setStatusMessage("User not authenticated.");
      return;
    }

    try {
      setLoading(true);
      setStatusMessage("");
      await axios.post(
        `${import.meta.env.VITE_BACKEND_API}/notepad/`,
        { notes },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setStatusTone("success");
      setStatusMessage("Notes saved successfully.");
    } catch (error) {
      console.error("Error saving notes:", error);
      setStatusTone("error");
      setStatusMessage("Unable to save notes. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  const wordCount = useMemo(
    () => normalizeNoteText(notes).split(/\s+/).filter(Boolean).length,
    [notes]
  );

  return (
    <div className="min-h-full bg-[#f7f7f5] px-0 py-3 md:px-6 md:py-5">
      <div className="app-soft-panel mx-auto max-w-6xl overflow-hidden rounded-[28px]">
        <div className="border-b border-slate-200 px-5 py-5 md:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-500">
                Personal Workspace
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-900">My Notes</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Keep internal notes, reminders, and context in one clean space without leaving
                the workflow.
              </p>
            </div>
            <span className="app-stat-chip self-start rounded-full px-3 py-1 text-xs font-semibold">
              {wordCount} words
            </span>
          </div>
        </div>

        <div className="px-5 py-5 md:px-6 md:py-6">
          <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">Editable notebook</p>
                <p className="text-xs text-slate-500">
                  {loading ? "Syncing your latest notes..." : "Your notes are stored privately."}
                </p>
              </div>
              {statusMessage && (
                <span
                  className={`self-start rounded-full px-3 py-1 text-xs font-medium ${
                    statusTone === "success"
                      ? "bg-emerald-50 text-emerald-700"
                      : statusTone === "error"
                        ? "bg-red-50 text-red-600"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {statusMessage}
                </span>
              )}
            </div>

            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="min-h-[340px] w-full resize-none rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 text-[15px] leading-7 text-slate-700 outline-none md:min-h-[420px]"
              placeholder="Write your notes here..."
            />

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                Use this space for quick summaries, reminders, and follow-up context.
              </p>
              <button
                type="button"
                onClick={handleSave}
                className="rounded-full bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loading}
              >
                {loading ? "Saving..." : "Save Notes"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
