import { useEffect, useState, useMemo } from "react";
import moment from "moment";
import { useNavigate } from "react-router-dom";

const PRIORITY_OPTIONS = ["Low", "Medium", "High", "Urgent"];
const STATUS_OPTIONS = ["Assigned", "Acknowledged", "Completed"];

const getPriorityBadgeClass = (priority = "Medium") => {
  if (priority === "Urgent") return "bg-red-100 text-red-700";
  if (priority === "High") return "bg-orange-100 text-orange-700";
  if (priority === "Low") return "bg-emerald-100 text-emerald-700";
  return "bg-slate-100 text-slate-700";
};

const getStatusBadgeClass = (status) => {
  if (status === "Completed") return "bg-green-100 text-green-700";
  if (status === "Acknowledged") return "bg-blue-100 text-blue-700";
  return "bg-yellow-100 text-yellow-700";
};

export default function MyTasks() {
  const token = localStorage.getItem("token");
  const navigate = useNavigate();

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("pending");
  const [collapsedChannels, setCollapsedChannels] = useState({});
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterTag, setFilterTag] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchAllTasks = async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (filterPriority) params.append("priority", filterPriority);
      if (filterTag) params.append("tag", filterTag);
      const query = params.toString();
      const url = `${import.meta.env.VITE_BACKEND_API}/channels/tasks/all${query ? `?${query}` : ""}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || "Unable to load tasks.");
        return;
      }
      setGroups(data?.groups || []);
    } catch {
      setError("Unable to load tasks.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllTasks();
  }, [search, filterPriority, filterTag]);

  const toggleChannel = (channelId) =>
    setCollapsedChannels((prev) => ({ ...prev, [channelId]: !prev[channelId] }));

  const resetFilters = () => {
    setSearchInput("");
    setSearch("");
    setFilterPriority("");
    setFilterTag("");
  };

  // Filter groups by active tab
  const filteredGroups = useMemo(() => {
    return groups
      .map((group) => ({
        ...group,
        tasks: group.tasks.filter((t) =>
          activeTab === "pending" ? t.status !== "Completed" : t.status === "Completed"
        ),
      }))
      .filter((group) => group.tasks.length > 0);
  }, [groups, activeTab]);

  const pendingCount = useMemo(
    () => groups.reduce((sum, g) => sum + g.tasks.filter((t) => t.status !== "Completed").length, 0),
    [groups]
  );
  const completedCount = useMemo(
    () => groups.reduce((sum, g) => sum + g.tasks.filter((t) => t.status === "Completed").length, 0),
    [groups]
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-lg font-bold text-slate-800">My Tasks</h1>
        <p className="text-xs text-slate-500 mt-0.5">Tasks assigned to you across all channels</p>
      </div>

      <div className="px-4 lg:px-6 py-4 space-y-4">
        {/* Tabs */}
        <div className="flex rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          <button
            type="button"
            onClick={() => { setActiveTab("pending"); setCollapsedChannels({}); }}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              activeTab === "pending"
                ? "bg-orange-500 text-white"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            Pending
            <span className={`ml-2 rounded-full px-2.5 py-0.5 text-xs font-bold ${
              activeTab === "pending" ? "bg-white/25 text-white" : "bg-orange-100 text-orange-700"
            }`}>
              {pendingCount}
            </span>
          </button>
          <div className="w-px bg-gray-200" />
          <button
            type="button"
            onClick={() => { setActiveTab("completed"); setCollapsedChannels({}); }}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              activeTab === "completed"
                ? "bg-emerald-600 text-white"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            Completed
            <span className={`ml-2 rounded-full px-2.5 py-0.5 text-xs font-bold ${
              activeTab === "completed" ? "bg-white/25 text-white" : "bg-emerald-100 text-emerald-700"
            }`}>
              {completedCount}
            </span>
          </button>
        </div>

        {/* Filters */}
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search task title or number..."
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none flex-1 min-w-[180px]"
            />
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none"
            >
              <option value="">All Priorities</option>
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <input
              type="text"
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
              placeholder="Filter by tag"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none w-36"
            />
            <button
              type="button"
              onClick={resetFilters}
              className="border border-gray-300 rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Reset
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {loading && (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500 shadow-sm">
            Loading tasks...
          </div>
        )}

        {!loading && filteredGroups.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-500 shadow-sm">
            No {activeTab} tasks found.
          </div>
        )}

        {/* Channel Groups */}
        {!loading &&
          filteredGroups.map((group) => {
            const isCollapsed = !!collapsedChannels[group.channelId];
            return (
              <div
                key={group.channelId}
                className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
              >
                {/* Channel header */}
                <button
                  type="button"
                  onClick={() => toggleChannel(group.channelId)}
                  className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-800">
                      # {group.channelName}
                    </span>
                    <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${
                      activeTab === "pending"
                        ? "bg-orange-100 text-orange-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}>
                      {group.tasks.length} {activeTab}
                    </span>
                  </div>
                  <span className="text-slate-400 text-sm">
                    {isCollapsed ? "▸" : "▾"}
                  </span>
                </button>

                {/* Tasks */}
                {!isCollapsed && (
                  <div className="divide-y divide-gray-50 px-4 py-2 space-y-2 pb-3">
                    {group.tasks.map((task) => {
                      const overdue =
                        task.status !== "Completed" &&
                        moment(task.deadline).isBefore(moment());
                      return (
                        <div
                          key={task._id}
                          className={`rounded-lg border px-3 py-2.5 mt-2 ${
                            overdue
                              ? "border-red-200 bg-red-50"
                              : "border-gray-100 bg-white"
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-600 shrink-0">
                                {task.taskNumber}
                              </span>
                              <span className="text-sm font-semibold text-slate-800 truncate">
                                {task.title}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                              <span className={`text-xs px-2 py-0.5 rounded font-medium ${getStatusBadgeClass(task.status)}`}>
                                {task.status}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded font-medium ${getPriorityBadgeClass(task.priority)}`}>
                                {task.priority}
                              </span>
                              {overdue && (
                                <span className="text-xs px-2 py-0.5 rounded font-medium bg-red-100 text-red-700">
                                  Overdue
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                            <span>
                              Assigned to:{" "}
                              <span className="font-medium text-slate-700">
                                {task.assignedToUser?.name || "Unassigned"}
                              </span>
                            </span>
                            <span>
                              Deadline:{" "}
                              <span className={`font-medium ${overdue ? "text-red-600" : "text-slate-700"}`}>
                                {moment(task.deadline).format("DD MMM YYYY, HH:mm")}
                              </span>
                            </span>
                            {task.completedAt && (
                              <span>
                                Completed:{" "}
                                <span className="font-medium text-emerald-700">
                                  {moment(task.completedAt).format("DD MMM YYYY, HH:mm")}
                                </span>
                              </span>
                            )}
                          </div>
                          {Array.isArray(task.tags) && task.tags.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {task.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={() => navigate(`/channelchat/${group.channelId}`)}
                              className="text-[11px] text-orange-600 hover:underline font-medium"
                            >
                              Open in channel →
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
