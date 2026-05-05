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
   
    return () => {
      socket.off("updateUnread"); 
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
    <div className="flex h-screen overflow-hidden">
      <div className="relative h-screen border border-orange-400 bg-white/95 px-3 pt-2">
        {/* Navigation Links */}
        <nav className="flex flex-col gap-1 items-center">
          <Link to="/" className="flex items-center">
            <div className="flex flex-col items-center">
              <img src={logo} alt="" className="h-[70px] w-[70px]" />
            </div>
          </Link>
          <Link to="/" className="flex items-center gap-2 p-2">
            <div className="flex flex-col items-center">
              <img src={home} alt="" className="h-[28px] w-[28px]" />
              <p className="text-[12px] font-semibold">Home</p>
            </div>
          </Link>
          <Link to="/attendance" className="flex items-center gap-2 p-2">
            <div className="flex flex-col items-center">
              <img src={attendence} alt="" className="h-[24px] w-[24px]" />
              <p className="text-[12px] font-semibold">Attendance</p>
            </div>
          </Link>
          <Link to="/callbacklist" className="flex items-center gap-2 p-2">
            <div className="flex flex-col items-center">
              <img src={calls} alt="" className="h-[24px] w-[24px]" />
              <p className="text-[12px] font-semibold">Callback</p>
            </div>
          </Link>
          <Link to="/transferlist" className="flex items-center gap-2 p-2">
            <div className="flex flex-col items-center">
              <img src={bidirection} alt="" className="h-[24px] w-[24px]" />
              <p className="text-[12px] font-semibold">Transfer</p>
            </div>
          </Link>
          <Link to="/saleslist" className="flex items-center gap-2 p-2">
            <div className="flex flex-col items-center">
              <img src={sales} alt="" className="h-[24px] w-[24px]" />
              <p className="text-[12px] font-semibold">Sales</p>
            </div>
          </Link>
          <Link to="/notes" className="flex items-center gap-2 p-2">
            <div className="flex flex-col items-center">
              <img src={notes} alt="" className="h-[24px] w-[24px]" />
              <p className="text-[12px] font-semibold">Notes</p>
            </div>
          </Link>
          <Link to="/payslips" className="flex items-center gap-2 p-2">
            <div className="flex flex-col items-center">
              <span
                className="flex h-[24px] w-[24px] items-center justify-center rounded bg-orange-100 text-[10px] font-bold text-orange-700"
                aria-hidden="true"
              >
                ₹
              </span>
              <p className="text-[12px] font-semibold">Payslips</p>
            </div>
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
                size={40}
              />
            </button>
          </div>
        </nav>

        <button
          type="button"
          onClick={toggleSidebar}
          className="absolute -right-3 top-24 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-orange-300 bg-white text-gray-700 shadow-sm hover:bg-orange-50"
          title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isSidebarCollapsed ? <FiChevronRight size={14} /> : <FiChevronLeft size={14} />}
        </button>
      </div>

      <div
        className={`bg-gray-200 border border-orange-400 h-screen flex flex-col overflow-hidden transition-all duration-300 ${
          isSidebarCollapsed ? "w-0 p-0 opacity-0 border-l-0 border-r-0 pointer-events-none" : "w-[260px] px-3 py-4 opacity-100"
        }`}
      >
        {!isSidebarCollapsed && (
          <>
        <div className="flex justify-between items-center pt-3 mb-3">
          <h2 className="text-[18px] font-medium flex items-center gap-2">
            <Avatar
              name={userData?.name}
              src={profile?.avatar || ""}
              size={28}
            />
            {userData?.name}
            <img src={arrow} alt="" className="w-[8px] pt-1" />
          </h2>
          <button type="button" onClick={() => setProfileOpen(true)}>
            <img src={edit} alt="Edit profile" className="w-[10px] h-[10px]" />
          </button>
        </div>

        <div className="flex flex-col gap-3 flex-1 min-h-0">
          <div className="pt-2 flex flex-col min-h-0 flex-[0.95]">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[15px] font-bold text-gray-600 flex gap-2">
                Channels <img src={arrow} alt="" className="w-[8px] pt-1" />
              </h3>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                totalChannelUnread > 0
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-white text-gray-500"
              }`}>
                {totalChannelUnread > 0 ? totalChannelUnread : channels?.length || 0}
              </span>
            </div>
            <ul className="mt-2 flex-1 min-h-0 overflow-y-auto hide-scrollbar">
              {channels?.map((channel) => (
                <li key={channel._id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-[13px] font-medium text-gray-700 hover:bg-white/70"
                    onClick={() => handleChannelChat(channel.name, channel._id)}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Avatar
                        name={channel?.name}
                        src={channel?.image || ""}
                        size={20}
                        rounded="rounded"
                        fontSize="11px"
                      />
                      <span className="truncate flex-1 min-w-0">{channel.name}</span>
                      {channel?.unreadMessages > 0 && (
                        <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[11px] font-bold text-green-600">
                          {channel.unreadMessages}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col min-h-0 flex-[1.15]">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[15px] font-bold text-gray-600 flex gap-2">
                Messages <img src={arrow} alt="" className="w-[8px] pt-1" />
              </h3>
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-gray-500">
                {employees?.filter((user) => user.lastMessageTime)?.length || 0}
              </span>
            </div>
            <ul className="hide-scrollbar mt-2 flex-1 min-h-0 overflow-y-auto pr-1">
              {employees?.filter(user => user.lastMessageTime).map((user, i) => (
                <li key={user.id || i}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-[13px] font-medium text-gray-700 hover:bg-white/70"
                    onClick={() => handleChat(user.name, user.id)}
                  >
                    <Avatar
                      name={user?.name}
                      src={user?.avatar || ""}
                      size={20}
                      fontSize="11px"
                    />
                    <span className="flex-1 truncate">{user?.name}</span>
                    {unreadMessages[user.id] > 0 && openChatId !== user.id && (
                      <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[11px] font-bold text-green-600">
                        {unreadMessages[user.id]}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="mt-2 rounded-xl px-2 py-1.5 text-left text-[13px] text-gray-700 hover:bg-white/70"
              onClick={handleCowrokers}
            >
              + Add Coworker
            </button>
          </div>
        </div>
          </>
        )}
      </div>

      {profileOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white w-full max-w-md rounded-lg shadow-lg p-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-semibold">My Profile</h3>
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                className="text-gray-500"
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
            <div className="mt-4 text-xs text-gray-600 space-y-1">
              <p><span className="font-semibold">Name:</span> {profile?.name || userData?.name}</p>
              <p><span className="font-semibold">Email:</span> {profile?.email || "—"}</p>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded"
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
