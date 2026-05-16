import { Link, useNavigate, useLocation } from "react-router-dom";
import home from "../../../assets/desktop/home.svg";
import attendence from "../../../assets/desktop/attendence.svg";
import bidirection from "../../../assets/desktop/bidirection.svg";
import calls from "../../../assets/desktop/calls.svg";
import notes from "../../../assets/desktop/notes.svg";
import sales from "../../../assets/desktop/sales.svg";
import arrow from "../../../assets/desktop/arrow.svg";
import edit from "../../../assets/desktop/edit.svg";
import logo from "../../../assets/desktop/logo.svg";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { MdOutlineTaskAlt, MdOutlineTableChart } from "react-icons/md";
import { useAuth } from "../../../context/authContext";
import { useEffect, useState } from "react";
import socket from "../../../utils/socket";
import axios from "axios";
import Avatar from "../Common/Avatar";
import ProfilePictureUploader from "../Common/ProfilePictureUploader";

const getStableColor = (text = "DM") => {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 40%)`;
};

function Sidebarpart() {
  const SIDEBAR_PREF_KEY = "dm_employee_desktop_sidebar_collapsed";
  const { getChannels } = useAuth();
  const location = useLocation();
  const [employees, setEmployees] = useState([]);
  const [channels, setChannels] = useState([]);
  const [unreadMessages, setUnreadMessages] = useState({});
  const { getAllUsers, userData } = useAuth();
  const [openChatId, setOpenChatId] = useState(null);
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [pendingTasks, setPendingTasks] = useState(0);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_PREF_KEY) === "1";
    } catch (error) {
      return false;
    }
  });
  const navigate = useNavigate();
  const totalChannelUnread = channels.reduce(
    (sum, channel) => sum + (channel?.unreadMessages || 0),
    0
  );

  const [profile, setProfile] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);

  // Pull the signed-in employee's profile so the sidebar can show their avatar.
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_BACKEND_API}/profile/me`,
          { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
        );
        const data = await res.json().catch(() => ({}));
        if (data?.success) setProfile(data.profile);
      } catch (e) {
        // ignore
      }
    };
    fetchProfile();
  }, []);

  const channel = async () => {
    const data = await getChannels();
    setChannels(data);
  };
  const fetchUsers = async () => {
    const users = await getAllUsers();
    const unreadCounts = {};
    users.forEach(user => {
      unreadCounts[user.id] = user.unreadMessages || 0;
    });
    setEmployees(users);
    setUnreadMessages(unreadCounts);
  };

  useEffect(() => {
    channel();
    fetchUsers();
    socket.on("updateUnread", async () => {
      fetchUsers();
      channel();
    });

    // Bubble a channel to the top of the list when a new message arrives —
    // same WhatsApp behaviour. updateUnread only fires when the user has
    // unread messages; this covers the case where the user is actively
    // looking at the channel (so unread stays 0 but the channel should
    // still move to top).
    const onNewMessage = (msg) => {
      if (!msg?.channelId) return;
      setChannels((prev) => {
        const idx = prev.findIndex(
          (c) => c._id?.toString() === msg.channelId?.toString()
        );
        if (idx <= 0) return prev; // already at top or not found
        const updated = [...prev];
        const [moved] = updated.splice(idx, 1);
        updated.unshift({ ...moved, lastMessageTime: new Date().toISOString() });
        return updated;
      });
    };
    socket.on("new-channel-message", onNewMessage);

    const fetchPendingTasks = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;
      try {
        const response = await fetch(
          `${import.meta.env.VITE_BACKEND_API}/channels/tasks/count`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (response.ok) {
          const data = await response.json();
          setPendingTasks(data?.pendingCount || 0);
        }
      } catch (error) {
        // silent
      }
    };
    fetchPendingTasks();
    const taskInterval = setInterval(fetchPendingTasks, 60_000);
    const onFocus = () => fetchPendingTasks();
    window.addEventListener("focus", onFocus);
    socket.on("soft-refresh", fetchPendingTasks);
   
    return () => {
      socket.off("updateUnread");
      socket.off("new-channel-message", onNewMessage);
      socket.off("soft-refresh", fetchPendingTasks);
      clearInterval(taskInterval);
      window.removeEventListener("focus", onFocus);
      socket.disconnect();
    };
   
  }, []);

  useEffect(() => {
    const chatState = location.state;
    if (chatState && chatState.id) {
      setOpenChatId(chatState.id);   
    } else {
      setOpenChatId(null);
    }
  }, [location]);

  const handleCowrokers = () => {
    navigate("/addCoworker");
  };

  const handleChat = async (name, id) => {
    setOpenChatId(id);
    setUnreadMessages(prev => ({
      ...prev,
      [id]: 0
    }));
    navigate("/chat", { state: { name, id } });  
    await axios.post(
      `${import.meta.env.VITE_BACKEND_API}/message/messages/mark-as-read`,
      { senderId: id },
      { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
    );
    
  };

  const handleChannelChat = (name, id) => {
    setChannels((prev) =>
      prev.map((channel) =>
        channel?._id?.toString() === id?.toString()
          ? { ...channel, unreadMessages: 0 }
          : channel
      )
    );
    navigate(`/channelchat/${id}`, {
      state: {
        name,
        id,
      },
    });
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_PREF_KEY, next ? "1" : "0");
      return next;
    });
  };

  return (
    <div className="sticky top-0 flex h-[100dvh] shrink-0 overflow-hidden">
      <div className="relative h-screen bg-sidebar text-sidebar-text border-r border-sidebar-divider px-2 pt-2 flex flex-col items-stretch">
        {/* Navigation Links */}
        <nav className="flex flex-col gap-0.5 items-stretch">
          <Link to="/" className="flex flex-col items-center py-2 rounded-md">
            <img src={logo} alt="" className="h-[44px] w-[44px]" />
          </Link>
          <Link to="/" className="flex flex-col items-center py-2 rounded-md hover:bg-sidebar-hover text-sidebar-muted hover:text-white">
            <img src={home} alt="" className="h-[20px] w-[20px] invert opacity-80" />
            <p className="text-[11px] font-semibold mt-0.5">Home</p>
          </Link>
          <Link to="/attendance" className="flex flex-col items-center py-2 rounded-md hover:bg-sidebar-hover text-sidebar-muted hover:text-white">
            <img src={attendence} alt="" className="h-[20px] w-[20px] invert opacity-80" />
            <p className="text-[11px] font-semibold mt-0.5">Attendance</p>
          </Link>
          <Link to="/callbacklist" className="flex flex-col items-center py-2 rounded-md hover:bg-sidebar-hover text-sidebar-muted hover:text-white">
            <img src={calls} alt="" className="h-[20px] w-[20px] invert opacity-80" />
            <p className="text-[11px] font-semibold mt-0.5">Callback</p>
          </Link>
          <Link to="/transferlist" className="flex flex-col items-center py-2 rounded-md hover:bg-sidebar-hover text-sidebar-muted hover:text-white">
            <img src={bidirection} alt="" className="h-[20px] w-[20px] invert opacity-80" />
            <p className="text-[11px] font-semibold mt-0.5">Transfer</p>
          </Link>
          <Link to="/saleslist" className="flex flex-col items-center py-2 rounded-md hover:bg-sidebar-hover text-sidebar-muted hover:text-white">
            <img src={sales} alt="" className="h-[20px] w-[20px] invert opacity-80" />
            <p className="text-[11px] font-semibold mt-0.5">Sales</p>
          </Link>
          <Link to="/notes" className="flex flex-col items-center py-2 rounded-md hover:bg-sidebar-hover text-sidebar-muted hover:text-white">
            <img src={notes} alt="" className="h-[20px] w-[20px] invert opacity-80" />
            <p className="text-[11px] font-semibold mt-0.5">Notes</p>
          </Link>
          <Link to="/payslips" className="flex flex-col items-center py-2 rounded-md hover:bg-sidebar-hover text-sidebar-muted hover:text-white">
            <span
              className="flex h-[20px] w-[20px] items-center justify-center rounded text-[11px] font-bold bg-sidebar-hover text-sidebar-text"
              aria-hidden="true"
            >
              ₹
            </span>
            <p className="text-[11px] font-semibold mt-0.5">Payslips</p>
          </Link>
          <Link to="/my-tasks" className="flex flex-col items-center py-2 rounded-md hover:bg-sidebar-hover text-sidebar-muted hover:text-white relative">
            <MdOutlineTaskAlt size={22} />
            <p className="text-[11px] font-semibold mt-0.5">My Tasks</p>
            {pendingTasks > 0 && (
              <span className="absolute top-1 right-1 slack-unread">
                {pendingTasks > 99 ? "99+" : pendingTasks}
              </span>
            )}
          </Link>
          <Link to="/salary-sheet" className="flex flex-col items-center py-2 rounded-md hover:bg-sidebar-hover text-sidebar-muted hover:text-white">
            <MdOutlineTableChart size={22} />
            <p className="text-[11px] font-semibold mt-0.5">Salary</p>
          </Link>
          <div className="mt-2 flex flex-col items-center">
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              title="My profile"
              className="rounded-full"
            >
              <Avatar
                name={userData?.name}
                src={profile?.avatar || ""}
                size={36}
              />
            </button>
          </div>
        </nav>

        <button
          type="button"
          onClick={toggleSidebar}
          className="absolute -right-3 top-24 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-sidebar-divider bg-sidebar-alt text-sidebar-text shadow hover:bg-sidebar-hover"
          title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isSidebarCollapsed ? <FiChevronRight size={14} /> : <FiChevronLeft size={14} />}
        </button>
      </div>

      <div
        className={`bg-sidebar text-sidebar-text border-r border-sidebar-divider h-screen flex flex-col overflow-hidden transition-all duration-300 ${
          isSidebarCollapsed ? "w-0 p-0 opacity-0 border-l-0 border-r-0 pointer-events-none" : "w-[260px] py-3 opacity-100"
        }`}
      >
        {!isSidebarCollapsed && (
          <>
        {/* Workspace header */}
        <div className="flex justify-between items-center px-3 pb-3 mb-1 border-b border-sidebar-divider">
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className="flex items-center gap-2 text-left min-w-0"
            title="My profile"
          >
            <Avatar
              name={userData?.name}
              src={profile?.avatar || ""}
              size={32}
              rounded="rounded-md"
            />
            <span className="min-w-0">
              <span className="block text-[15px] font-bold text-white truncate">
                {userData?.name}
              </span>
              <span className="block text-[11px] text-sidebar-muted truncate">
                Employee · workspace
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className="text-sidebar-muted hover:text-white"
            aria-label="My profile"
            title="My profile"
          >
            <img src={edit} alt="" className="w-[12px] h-[12px] invert opacity-70" />
          </button>
        </div>
        {/* Search input */}
        <div className="px-3 mb-1">
          <input
            type="text"
            placeholder="Search channels or people..."
            value={sidebarSearch}
            onChange={(e) => setSidebarSearch(e.target.value)}
            className="w-full text-[13px] px-2.5 py-1.5 rounded-md bg-sidebar-hover text-white placeholder-sidebar-muted border border-sidebar-divider focus:outline-none focus:border-sidebar-active"
          />
        </div>

        <div className="flex flex-col flex-1 min-h-0 px-1">
          {/* Channels Section */}
          <div className="pt-1 flex flex-col min-h-0 flex-[0.95]">
            <div className="slack-section-header">
              <span>Channels</span>
              {totalChannelUnread > 0 && (
                <span className="slack-unread">{totalChannelUnread}</span>
              )}
            </div>
            <ul className="flex-1 min-h-0 overflow-y-auto slack-scroll slack-scroll-dark">
              {channels?.filter(ch => !sidebarSearch || ch.name?.toLowerCase().includes(sidebarSearch.toLowerCase())).map((channel) => {
                const isActive = location.pathname === `/channelchat/${channel._id}`;
                return (
                <li key={channel._id}>
                  <button
                    type="button"
                    className={`slack-row w-full justify-start text-left ${isActive ? "is-active" : ""}`}
                    onClick={() => handleChannelChat(channel.name, channel._id)}
                  >
                    <Avatar
                      name={channel?.name}
                      src={channel?.image || ""}
                      size={18}
                      rounded="rounded-sm"
                      fontSize="10px"
                    />
                    <span className="truncate flex-1 min-w-0 font-medium text-white">
                      <span className="text-sidebar-muted mr-0.5">#</span>
                      {channel.name}
                    </span>
                    {channel?.unreadMessages > 0 && (
                      <span className="slack-unread">{channel.unreadMessages}</span>
                    )}
                  </button>
                </li>
                );
              })}
            </ul>
          </div>

          {/* Direct Messages Section */}
          <div className="flex flex-col min-h-0 flex-[1.15] mt-1">
            <div className="slack-section-header">
              <span>Direct messages</span>
            </div>
            <ul className="flex-1 min-h-0 overflow-y-auto slack-scroll slack-scroll-dark">
              {employees?.filter(user => user.lastMessageTime && (!sidebarSearch || user.name?.toLowerCase().includes(sidebarSearch.toLowerCase()))).map((user, i) => {
                const isActive = location.pathname === `/chat/${user.id}`;
                return (
                <li key={user.id || i}>
                  <button
                    type="button"
                    className={`slack-row w-full justify-start text-left ${isActive ? "is-active" : ""}`}
                    onClick={() => handleChat(user.name, user.id)}
                  >
                    <Avatar
                      name={user?.name}
                      src={user?.avatar || ""}
                      size={18}
                      fontSize="10px"
                    />
                    <span className="flex-1 truncate slack-row-meta">{user?.name}</span>
                    {unreadMessages[user.id] > 0 && openChatId !== user.id && (
                      <span className="slack-unread">{unreadMessages[user.id]}</span>
                    )}
                  </button>
                </li>
                );
              })}
            </ul>
            <button
              type="button"
              className="slack-row text-sidebar-muted w-full mt-1"
              onClick={handleCowrokers}
            >
              <span className="w-[18px] h-[18px] rounded-sm bg-sidebar-hover flex items-center justify-center text-sidebar-muted">+</span>
              <span>Add coworker</span>
            </button>
          </div>
        </div>
          </>
        )}
      </div>

      {profileOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white w-full max-w-md rounded-lg shadow-modal p-4">
            <div className="flex items-center justify-between border-b border-surface-divider pb-2">
              <h3 className="text-sm font-semibold text-ink">My Profile</h3>
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                className="text-ink-muted text-xl leading-none"
              >
                &times;
              </button>
            </div>
            <div className="mt-3">
              <ProfilePictureUploader
                name={profile?.name || userData?.name || ""}
                currentAvatar={profile?.avatar || ""}
                onUpdated={(updated) => {
                  if (updated) setProfile((p) => ({ ...(p || {}), ...updated }));
                }}
              />
            </div>
            <div className="mt-4 text-xs text-ink-muted space-y-1">
              <p><span className="font-semibold text-ink">Name:</span> {profile?.name || userData?.name}</p>
              <p><span className="font-semibold text-ink">Email:</span> {profile?.email || "—"}</p>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                className="slack-btn-ghost"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Sidebarpart;
