import { useEffect, useMemo, useState } from "react";

const formatNotificationTime = (value) => {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const resolveNotificationCopy = (notification) => {
  const title = notification?.title || "Notification";
  const description = notification?.description || "No description available.";
  return { title, description };
};

export default function NotificationPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");

  const fetchNotifications = async () => {
    if (!token) {
      setLoading(false);
      setError("User not authenticated.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_API}/notification/get-notifications`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Failed to fetch notifications");
      }

      setNotifications(Array.isArray(data?.notifications) ? data.notifications : []);
    } catch (fetchError) {
      setError(fetchError.message || "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item?.isRead).length,
    [notifications]
  );

  return (
    <div className="min-h-[calc(100dvh-92px)] bg-[#f7f7f5] px-4 py-4 md:px-6 md:py-5">
      <div className="app-soft-panel overflow-hidden rounded-[28px]">
        <div className="border-b border-slate-200 px-5 py-5 md:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-500">
                Alerts Center
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-900">
                Notification history
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Review missed alerts, task updates, and message notifications in one place.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="app-stat-chip rounded-full px-3 py-1 text-xs font-semibold">
                {notifications.length} total
              </span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                {unreadCount} unread
              </span>
            </div>
          </div>
        </div>

        <div className="px-5 py-5 md:px-6 md:py-6">
          {loading ? (
            <div className="rounded-[26px] border border-slate-200 bg-white px-5 py-8 text-sm text-slate-500 shadow-sm">
              Loading notifications...
            </div>
          ) : error ? (
            <div className="rounded-[26px] border border-red-100 bg-red-50 px-5 py-8 text-sm text-red-600 shadow-sm">
              {error}
            </div>
          ) : notifications.length === 0 ? (
            <div className="rounded-[26px] border border-slate-200 bg-white px-5 py-12 text-center shadow-sm">
              <p className="text-lg font-semibold text-slate-800">All caught up</p>
              <p className="mt-2 text-sm text-slate-500">
                No new notifications are waiting for your attention.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {notifications.map((notification) => {
                const copy = resolveNotificationCopy(notification);
                return (
                  <article
                    key={notification?._id || `${copy.title}-${copy.description}`}
                    className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition hover:border-orange-200 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{copy.title}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {copy.description}
                        </p>
                      </div>
                      {!notification?.isRead && (
                        <span className="rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-white">
                          New
                        </span>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                        {notification?.type || "general"}
                      </span>
                      {notification?.sender && (
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
                          From {notification.sender}
                        </span>
                      )}
                      <span>{formatNotificationTime(notification?.createdAt)}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
