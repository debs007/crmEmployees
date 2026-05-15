import { useEffect, useState } from "react";
import moment from "moment";
import { MdDownload, MdPictureAsPdf, MdInsertDriveFile } from "react-icons/md";
import { FiCalendar } from "react-icons/fi";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const MONTH_COLORS = [
  "from-violet-500 to-purple-600",
  "from-blue-500 to-cyan-600",
  "from-emerald-500 to-teal-600",
  "from-orange-500 to-amber-600",
  "from-pink-500 to-rose-600",
  "from-indigo-500 to-blue-600",
  "from-green-500 to-emerald-600",
  "from-red-500 to-orange-600",
  "from-sky-500 to-blue-600",
  "from-fuchsia-500 to-pink-600",
  "from-teal-500 to-cyan-600",
  "from-amber-500 to-yellow-600",
];

function FileTypeIcon({ fileName, size = 32 }) {
  const ext = (fileName || "").split(".").pop()?.toLowerCase();
  if (ext === "pdf") return <MdPictureAsPdf size={size} className="text-red-400" />;
  return <MdInsertDriveFile size={size} className="text-blue-400" />;
}

export default function MyPayslips() {
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(null);
  const [filter, setFilter] = useState("all");
  const apiBase = import.meta.env.VITE_BACKEND_API;
  const token = () => localStorage.getItem("token");

  const years = [...new Set(payslips.map((p) => p.year))].sort((a, b) => b - a);

  const filtered = filter === "all"
    ? payslips
    : payslips.filter((p) => String(p.year) === filter);

  const downloadPayslip = async (id, fileName) => {
    setDownloading(id);
    try {
      const res = await fetch(`${apiBase}/payslips/download/${id}`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) { alert("Download failed."); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName || "payslip.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert("Download failed."); }
    finally { setDownloading(null); }
  };

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`${apiBase}/payslips/me`, {
      headers: { Authorization: `Bearer ${token()}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data?.success) throw new Error(data?.message || "Failed");
        setPayslips(data?.payslips || []);
      })
      .catch((err) => setError(err.message || "Could not load payslips"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 lg:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">My Payslips</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Download your salary slips uploaded by HR
            </p>
          </div>

          {/* Year filter */}
          {years.length > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  filter === "all"
                    ? "bg-slate-900 text-white"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                All years
              </button>
              {years.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => setFilter(String(y))}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    filter === String(y)
                      ? "bg-slate-900 text-white"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Summary strip */}
        {payslips.length > 0 && (
          <div className="mt-4 flex gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-2.5 border border-slate-200 shadow-sm">
              <FiCalendar className="text-slate-400" size={15} />
              <span className="text-sm font-semibold text-slate-700">
                {payslips.length} payslip{payslips.length !== 1 ? "s" : ""}
              </span>
            </div>
            {years.map((y) => (
              <div key={y} className="flex items-center gap-2 bg-white rounded-xl px-4 py-2.5 border border-slate-200 shadow-sm">
                <span className="text-sm text-slate-500">{y}</span>
                <span className="text-sm font-bold text-slate-900">
                  {payslips.filter((p) => p.year === y).length}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* States */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-2xl bg-slate-200 animate-pulse h-44" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <MdPictureAsPdf size={32} className="text-slate-300" />
          </div>
          <p className="text-base font-semibold text-slate-700">No payslips yet</p>
          <p className="text-sm text-slate-400 mt-1">
            {filter !== "all"
              ? `No payslips for ${filter}. Try a different year.`
              : "Your HR team hasn't uploaded any payslips for you yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((p) => {
            const monthLabel = MONTHS[p.month - 1] || String(p.month);
            const gradientClass = MONTH_COLORS[(p.month - 1) % MONTH_COLORS.length];
            const isDownloading = downloading === p._id;
            return (
              <div
                key={p._id}
                className="group relative flex flex-col rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Coloured top band */}
                <div className={`bg-gradient-to-br ${gradientClass} px-4 pt-4 pb-6`}>
                  <FileTypeIcon fileName={p.fileName} size={28} />
                  <p className="mt-2 text-lg font-bold text-white leading-tight">
                    {monthLabel}
                  </p>
                  <p className="text-sm font-semibold text-white/70">{p.year}</p>
                </div>

                {/* Card body */}
                <div className="flex flex-col flex-1 px-3 pb-3 pt-2 -mt-2 bg-white rounded-t-2xl">
                  {p.note && (
                    <p className="text-[11px] text-slate-500 italic mb-1.5 line-clamp-2">
                      {p.note}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-400 truncate mb-3">
                    {moment(p.createdAt).format("DD MMM YYYY")}
                  </p>

                  <button
                    type="button"
                    disabled={isDownloading}
                    onClick={() => downloadPayslip(p._id, p.fileName)}
                    className={`mt-auto flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-xs font-bold transition-all ${
                      isDownloading
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                        : `bg-gradient-to-r ${gradientClass} text-white hover:opacity-90 active:scale-95`
                    }`}
                  >
                    <MdDownload size={15} />
                    {isDownloading ? "Downloading…" : "Download"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
