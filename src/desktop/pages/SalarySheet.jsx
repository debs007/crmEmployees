import { useEffect, useState } from "react";
import moment from "moment";
import { MdTableChart, MdAccountBalanceWallet } from "react-icons/md";
import { FiCalendar } from "react-icons/fi";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const FIELDS = [
  { key: "position",     label: "Position",      icon: "💼" },
  { key: "grossSalary",  label: "Gross Salary",   icon: "💰", highlight: true },
  { key: "attendance",   label: "Attendance",     icon: "📅" },
  { key: "totalAbsent",  label: "Total Absent",   icon: "🚫" },
  { key: "inHandSalary", label: "In Hand Salary", icon: "🏦", highlight: true, big: true },
  { key: "ptax",         label: "P.Tax",          icon: "🧾" },
  { key: "remarks",      label: "Remarks",        icon: "📝", wide: true },
];

const GRADIENTS = [
  "from-violet-500 to-purple-700",
  "from-blue-500 to-indigo-700",
  "from-emerald-500 to-teal-700",
  "from-orange-500 to-red-600",
  "from-pink-500 to-rose-700",
  "from-sky-500 to-blue-700",
];

export default function EmployeeSalarySheet() {
  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [empIdMissing, setEmpIdMissing] = useState(false);
  const apiBase = import.meta.env.VITE_BACKEND_API;
  const authHeader = { Authorization: `Bearer ${localStorage.getItem("token")}` };

  useEffect(() => {
    setLoading(true);
    fetch(`${apiBase}/salary-sheet`, { headers: authHeader })
      .then((r) => r.json())
      .then((data) => {
        if (data?.message?.includes("No employee ID")) {
          setEmpIdMissing(true);
          return;
        }
        const s = data?.sheets || [];
        setSheets(s);
        if (s.length > 0) setSelected(s[0]);
      })
      .catch(() => setError("Could not load salary data."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-2xl bg-slate-200 animate-pulse h-40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 lg:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Salary Sheet</h1>
          <p className="text-sm text-slate-500 mt-0.5">Your monthly salary breakdown uploaded by HR</p>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">{error}</div>
        )}

        {empIdMissing && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 px-5 py-6 text-center">
            <MdAccountBalanceWallet size={36} className="mx-auto text-amber-400 mb-2" />
            <p className="text-base font-semibold text-amber-800">Employee ID not set</p>
            <p className="text-sm text-amber-600 mt-1">
              Ask your admin to set your Employee ID on your profile so your salary data can be matched.
            </p>
          </div>
        )}

        {!empIdMissing && !loading && sheets.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <MdTableChart size={48} className="text-slate-300 mb-3" />
            <p className="text-base font-semibold text-slate-700">No salary data yet</p>
            <p className="text-sm text-slate-400 mt-1">HR hasn&apos;t uploaded your salary sheet yet.</p>
          </div>
        )}

        {sheets.length > 0 && (
          <>
            {/* Month selector cards */}
            <div className="flex gap-3 overflow-x-auto pb-2 mb-6 hide-scrollbar">
              {sheets.map((s, i) => {
                const isActive = selected?._id === s._id;
                const grad = GRADIENTS[i % GRADIENTS.length];
                return (
                  <button
                    key={s._id}
                    type="button"
                    onClick={() => setSelected(s)}
                    className={`shrink-0 rounded-2xl px-5 py-3.5 text-left transition-all ${
                      isActive
                        ? `bg-gradient-to-br ${grad} text-white shadow-lg scale-[1.03]`
                        : "bg-white border border-slate-200 text-slate-700 hover:border-slate-300 hover:shadow"
                    }`}
                  >
                    <p className={`text-[11px] font-bold uppercase tracking-wide ${isActive ? "text-white/70" : "text-slate-400"}`}>
                      <FiCalendar className="inline mr-1" />{s.year}
                    </p>
                    <p className={`text-lg font-bold mt-0.5 ${isActive ? "text-white" : "text-slate-800"}`}>
                      {MONTHS[s.month - 1]}
                    </p>
                    {s.title && (
                      <p className={`text-[11px] mt-0.5 truncate max-w-[120px] ${isActive ? "text-white/70" : "text-slate-400"}`}>
                        {s.title}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected month data */}
            {selected && selected.rows?.[0] && (() => {
              const row = selected.rows[0];
              const grad = GRADIENTS[sheets.findIndex((s) => s._id === selected._id) % GRADIENTS.length];
              return (
                <div>
                  {/* Hero card */}
                  <div className={`bg-gradient-to-br ${grad} rounded-3xl p-6 mb-4 text-white`}>
                    <div className="flex items-start justify-between flex-wrap gap-3">
                      <div>
                        <p className="text-white/70 text-xs font-bold uppercase tracking-wide">Employee</p>
                        <p className="text-2xl font-bold mt-1">{row.name || "—"}</p>
                        <span className="inline-flex items-center mt-2 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-semibold">
                          {row.empId}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-white/70 text-xs font-bold uppercase tracking-wide">In-Hand Salary</p>
                        <p className="text-3xl font-black mt-1">
                          ₹{row.inHandSalary ? Number(row.inHandSalary).toLocaleString("en-IN") : row.inHandSalary || "—"}
                        </p>
                        <p className="text-white/60 text-xs mt-1">
                          {MONTHS[selected.month - 1]} {selected.year}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {FIELDS.filter((f) => f.key !== "inHandSalary").map((f) => (
                      <div
                        key={f.key}
                        className={`bg-white rounded-2xl border border-slate-200 p-4 shadow-sm ${f.wide ? "col-span-2 sm:col-span-3 lg:col-span-4" : ""}`}
                      >
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                          <span>{f.icon}</span> {f.label}
                        </p>
                        <p className={`font-bold text-slate-900 ${f.big ? "text-2xl" : f.highlight ? "text-xl" : "text-lg"}`}>
                          {(f.highlight && row[f.key])
                            ? `₹${Number(row[f.key]).toLocaleString("en-IN")}`
                            : row[f.key] || <span className="text-slate-300 font-normal text-sm">Not provided</span>
                          }
                        </p>
                      </div>
                    ))}
                  </div>

                  <p className="text-[11px] text-slate-400 text-right mt-3">
                    Uploaded {moment(selected.createdAt).format("DD MMM YYYY, HH:mm")}
                  </p>
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}
