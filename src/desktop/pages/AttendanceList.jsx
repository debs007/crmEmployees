import { useEffect, useMemo, useState } from "react";
import moment from "moment";
import { useAuth } from "../../context/authContext";

const rangeOptions = [
  { label: "Whole Year", value: "year" },
  { label: "Last Month", value: "last_month" },
  { label: "This Month", value: "this_month" },
  { label: "Today", value: "today" },
];

const statusTone = (value) => {
  const normalized = String(value || "").toLowerCase();
  if (normalized.includes("late")) return "text-rose-600";
  if (normalized.includes("on time")) return "text-emerald-600";
  if (normalized.includes("absent")) return "text-amber-700";
  return "text-slate-600";
};

function AttendanceList() {
  const [attendance, setAttendance] = useState([]);
  const [range, setRange] = useState("this_month");
  const { fetchAttendance } = useAuth();

  const getAddentanceData = async () => {
    const data = await fetchAttendance(range);
    setAttendance(Array.isArray(data?.data) ? data.data : []);
  };

  useEffect(() => {
    getAddentanceData();
  }, [range]);

  const summary = useMemo(
    () => ({
      late: attendance.filter((item) => item.status === "Late").length,
      absent: attendance.filter((item) => item.workStatus === "Absent").length,
      halfDay: attendance.filter((item) => item.workStatus === "Half Day").length,
      weekOff: attendance.filter(
        (item) => item.workStatus === "Week-Off" || item.workStatus === "Weekend"
      ).length,
    }),
    [attendance]
  );

  return (
    <div className="min-h-[calc(100dvh-92px)] bg-[#f7f7f5] px-4 py-4 md:px-6 md:py-5">
      <div className="app-soft-panel overflow-hidden rounded-[28px]">
        <div className="border-b border-slate-200 px-5 py-5 md:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-500">
                Attendance Workspace
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-900">My attendance</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Review your recent clock-in history, work status, and production without leaving
                the main workspace.
              </p>
            </div>
            <span className="app-stat-chip self-start rounded-full px-3 py-1 text-xs font-semibold">
              {attendance.length} entries
            </span>
          </div>
        </div>

        <div className="px-5 py-5 md:px-6 md:py-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              {rangeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRange(option.value)}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                    range === option.value
                      ? "border-orange-500 bg-orange-500 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:border-orange-300 hover:text-orange-500"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Late</p>
                <p className="mt-2 text-xl font-semibold text-rose-600">{summary.late}</p>
              </div>
              <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Absent</p>
                <p className="mt-2 text-xl font-semibold text-amber-700">{summary.absent}</p>
              </div>
              <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Half Day</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">{summary.halfDay}</p>
              </div>
              <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Week-Off</p>
                <p className="mt-2 text-xl font-semibold text-slate-900">{summary.weekOff}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-800">Attendance log</h2>
              <p className="mt-1 text-xs text-slate-500">
                Entries are filtered by the currently selected time range.
              </p>
            </div>

            <div className="max-h-[520px] overflow-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur">
                  <tr className="text-left text-xs uppercase tracking-[0.16em] text-slate-500">
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">Date</th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">Clock In</th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">Clock Out</th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">Status</th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">
                      Production
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">
                      Work Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.length > 0 ? (
                    attendance.map((item, index) => (
                      <tr key={item?._id || index} className="odd:bg-white even:bg-slate-50/60">
                        <td className="border-b border-slate-100 px-4 py-3 text-slate-600">
                          {item?.currentDate ? moment(item.currentDate).format("MMM D, YYYY") : "--"}
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3 text-slate-600">
                          {item?.firstPunchIn ? moment(item.firstPunchIn).format("HH:mm") : "Not done"}
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3 text-slate-600">
                          {item?.punchOut ? moment(item.punchOut).format("HH:mm") : "Not done"}
                        </td>
                        <td
                          className={`border-b border-slate-100 px-4 py-3 font-medium ${statusTone(item?.status)}`}
                        >
                          {item?.status || "--"}
                        </td>
                        <td className="border-b border-slate-100 px-4 py-3 text-slate-600">
                          {item?.workingTime
                            ? moment.utc(item.workingTime * 60 * 1000).format("H [hr] m [mins]")
                            : "0 hr 0 mins"}
                        </td>
                        <td
                          className={`border-b border-slate-100 px-4 py-3 font-medium ${statusTone(item?.workStatus)}`}
                        >
                          {item?.workStatus || "--"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">
                        No attendance records found for the selected range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AttendanceList;
