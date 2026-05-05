import { useEffect, useState } from "react";
import search from "../../../assets/desktop/search.svg";
import notificationIcon from "../../../assets/desktop/bell.png";
import { IoIosClose } from "react-icons/io";
import logo from "../../../assets/desktop/logo.svg";
import { onNotificationReceived } from "../../../utils/socket";
import { MdLogout } from "react-icons/md";
import { useNavigate } from "react-router-dom";

function Searchbar() {
  const TASK_NOTIFICATION_TYPES = ["TASK_ASSIGNED", "TASK_COMPLETED", "TASK_OVERDUE"];
  const [unreadCount, setUnreadCount] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [notification, setNotification] = useState([]);
  const token = localStorage.getItem("token");
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onNotificationReceived((nextNotification) => {
      setNotification((prev) => [nextNotification, ...prev]);
      setUnreadCount((prev) => prev + 1);
    });
    return () => unsubscribe();
  }, []);

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
    setUnreadCount(0);
  };

  function handleNotification(notify) {
    if (!notify) return;

    if (notify.type === "CONCERN" || notify.type === "CONCERN_STATUS") {
      navigate("/concern");
      return;
    }

    if (notify.type === "DM") {
      if (!notify.sender) return;
      navigate("/chat", {
        state: {
          name: notify?.name,
          id: notify?.sender,
        },
      });
      return;
    }

    if (!notify.sender) return;

    if (TASK_NOTIFICATION_TYPES.includes(notify.type)) {
      navigate(`/channelchat/${notify.sender}`, {
        state: {
          name: notify?.title,
          description: notify?.description,
          id: notify?.sender,
          openTasks: true,
        },
      });
      return;
    }

    navigate(`/channelchat/${notify.sender}`, {
      state: {
        name: notify?.title,
        description: notify?.description,
        id: notify?.sender,
      },
    });
  }

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  const removeNotification = (index) => {
    setNotification(notification.filter((_, i) => i !== index));
  };

  const clearAllNotifications = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_API}/notification/clear-notifications`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.ok) {
        setNotification([]);
        setUnreadCount(0);
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_BACKEND_API}/notification/get-notifications`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        if (response.ok) {
          const data = await response.json();
          setNotification(data?.notifications);
        }
      } catch (error) {
        console.error(error);
      }
    };
    loadNotifications();
  }, []);

  return (
    <div className="app-toolbar relative flex w-full items-center justify-between gap-4 px-5 pb-5 pt-5 lg:gap-6 lg:px-6">
      <div className="app-search-shell flex max-w-3xl flex-1 items-center gap-3 rounded-2xl px-4 py-3">
        <img src={search} alt="Search Icon" className="h-4 w-4 opacity-60" />
        <input
          type="text"
          placeholder="Search"
          className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="app-icon-button relative h-10 w-10 rounded-full"
          onClick={toggleSidebar}
          aria-label="Open notifications"
        >
          <img src={notificationIcon} alt="Notifications" className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 min-w-[1.2rem] rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {unreadCount}
            </span>
          )}
        </button>
        <button
          type="button"
          className="app-icon-button h-10 w-10 rounded-full"
          onClick={handleLogout}
          aria-label="Logout"
        >
          <MdLogout size={20} />
        </button>
      </div>

      <div
        className={`notification-drawer fixed right-0 top-0 z-50 flex h-screen w-[380px] max-w-[calc(100vw-20px)] flex-col p-4 shadow-2xl transition-transform ${
          isSidebarOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Notifications</h2>
            <p className="mt-1 text-xs text-slate-500">
              Review alerts and jump directly to the relevant screen.
            </p>
          </div>
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-orange-300 hover:text-orange-600"
            onClick={clearAllNotifications}
          >
            Clear all notifications
          </button>
        </div>

        <div className="hide-scrollbar mt-4 flex-1 min-h-0 space-y-3 overflow-y-auto pr-1">
          {notification.length > 0 ? (
            notification.map((notify, i) => (
              <div
                key={i}
                className="notification-card flex cursor-pointer items-start gap-3 rounded-2xl p-3"
                onClick={() => handleNotification(notify)}
              >
                <img src={logo} alt="" className="h-10 w-10 shrink-0" />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold text-slate-800">
                    {notify.title}
                  </h3>
                  <p className="mt-1 break-words text-xs leading-5 text-slate-500">
                    {notify.description}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-red-500 transition hover:text-red-700"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeNotification(i);
                  }}
                  aria-label="Dismiss notification"
                >
                  <IoIosClose size={24} />
                </button>
              </div>
            ))
          ) : (
            <div className="notification-card rounded-2xl p-6 text-center">
              <p className="text-sm font-semibold text-slate-700">All caught up</p>
              <p className="mt-1 text-xs text-slate-500">No new notifications right now.</p>
            </div>
          )}
        </div>
      </div>

      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/25"
          onClick={toggleSidebar}
        ></div>
      )}
    </div>
  );
}

export default Searchbar;
