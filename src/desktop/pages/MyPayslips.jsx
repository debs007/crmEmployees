import { useEffect, useState } from "react";
import moment from "moment";

const monthLabels = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Employee-facing "My Payslips" page (feature #2). Lists every payslip the
 * admin has uploaded for this user, with a download button.
 */
export default function MyPayslips() {
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const apiBase = import.meta.env.VITE_BACKEND_API;
  const token = () => localStorage.getItem("token");

  const downloadPayslip = async (id, fileName) => {
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
    } catch {
      alert("Download failed.");
    }
  };

  const fetchPayslips = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/payslips/me`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Could not load payslips");
      }
      setPayslips(data?.payslips || []);
    } catch (err) {
      setError(err.message || "Could not load payslips");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayslips();
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-base font-semibold text-gray-800 mb-3">My Payslips</h2>
      {error && (
        <p className="text-xs text-red-500 mb-2">{error}</p>
      )}
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : payslips.length === 0 ? (
        <p className="text-sm text-gray-500">
          No payslips have been uploaded for you yet.
        </p>
      ) : (
        <ul className="divide-y border rounded overflow-hidden">
          {payslips.map((p) => {
            const monthLabel = monthLabels[p.month - 1] || p.month;
            return (
              <li
                key={p._id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs bg-white"
              >
                <div className="min-w-0">
                  <p className="font-medium text-gray-800">
                    {monthLabel} {p.year}
                  </p>
                  <p className="text-[11px] text-gray-500 truncate">
                    {p.fileName || "payslip"}
                    {p.note ? ` • ${p.note}` : ""}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    Uploaded {moment(p.createdAt).format("DD MMM YYYY, HH:mm")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => downloadPayslip(p._id, p.fileName)}
                  className="px-3 py-1.5 rounded bg-orange-500 text-white"
                >
                  Download
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
