import { useEffect, useState } from "react";
import { useAuth } from "../../context/authContext";
import { useNavigate } from "react-router-dom";
import socket, { onSoftRefresh } from "../../utils/socket";

const AVATAR_TONES = [
  "bg-orange-500 text-white",
  "bg-blue-500 text-white",
  "bg-emerald-500 text-white",
  "bg-rose-500 text-white",
  "bg-violet-500 text-white",
  "bg-cyan-500 text-white",
];

const getAvatarTone = (value = "") => {
  const total = value.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return AVATAR_TONES[total % AVATAR_TONES.length];
};

const MobileConversations = () => {
  const { getAllUsers, getChannels } = useAuth();
  const [users, setUsers] = useState([]);
  const [channels, setChannels] = useState([]);
  const [activeTab, setActiveTab] = useState("messages");
  const navigate = useNavigate();
  const totalUnread = users.reduce((sum, user) => sum + (user?.unreadMessages || 0), 0);
  const totalChannelUnread = channels.reduce(
    (sum, channel) => sum + (channel?.unreadMessages || 0),
    0
  );

  useEffect(() => {
    const load = async () => {
      const u = await getAllUsers();
      const c = await getChannels();
      setUsers(u || []);
      setChannels(c?.channels || c || []);
    };

    load();

    const refresh = () => {
      load();
    };

    socket.on("updateUnread", refresh);
    const unsubscribeSoftRefresh = onSoftRefresh(refresh);

    return () => {
      socket.off("updateUnread", refresh);
      unsubscribeSoftRefresh();
    };
  }, []);

  const renderEmptyState = (title, description) => (
    <div className="rounded-2xl border border-dashed border-[#d9dde7] bg-white px-4 py-10 text-center shadow-sm">
      <p className="text-sm font-semibold text-[#1f2937]">{title}</p>
      <p className="mt-1 text-xs text-[#6b7280]">{description}</p>
    </div>
  );

  return (
    <div className="flex min-h-full flex-col bg-[#f7f8fb]">
      <div className="sticky top-0 z-10 border-b border-[#eceff5] bg-white/95 px-3 pb-3 pt-3 backdrop-blur">
        <div className="rounded-2xl border border-[#e7e9f0] bg-[#f8f9fc] p-1 shadow-sm">
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("messages")}
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                activeTab === "messages"
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-[#4b5563]"
              }`}
            >
              <span>Messages</span>
              {totalUnread > 0 && (
                <span
                  className={`min-w-[1.35rem] rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                    activeTab === "messages"
                      ? "bg-white/20 text-white"
                      : "bg-[#16a34a] text-white"
                  }`}
                >
                  {totalUnread}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("channels")}
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                activeTab === "channels"
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-[#4b5563]"
              }`}
            >
              <span>Channels</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                  activeTab === "channels"
                    ? "bg-white/20 text-white"
                    : totalChannelUnread > 0
                    ? "bg-[#16a34a] text-white"
                    : "bg-[#eef2ff] text-[#475569]"
                }`}
              >
                {totalChannelUnread > 0 ? totalChannelUnread : channels.length}
              </span>
            </button>
          </div>
        </div>
        <p className="px-1 pt-2 text-xs text-[#6b7280]">
          {activeTab === "messages"
            ? "Open direct conversations and keep track of unread replies."
            : "Switch between channels without losing your place."}
        </p>
      </div>

      <div className="space-y-3 px-3 py-3">
        {activeTab === "messages" ? (
          users.length > 0 ? (
            users.map((u) => (
              <button
                key={u?.id}
                type="button"
                className="flex w-full items-center gap-3 rounded-2xl border border-[#e8ebf2] bg-white px-3 py-3 text-left shadow-sm transition active:scale-[0.99]"
                onClick={() =>
                  navigate("/chat", {
                    state: { name: u?.name, id: u?.id },
                  })
                }
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${getAvatarTone(
                    u?.name || ""
                  )}`}
                >
                  {u?.name?.[0]?.toUpperCase() || "U"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-[#1f2937]">
                        {u?.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-[#6b7280]">
                        {u?.unreadMessages > 0
                          ? `${u.unreadMessages} unread message${
                              u.unreadMessages > 1 ? "s" : ""
                            }`
                          : "No unread messages"}
                      </span>
                    </span>
                    {u?.unreadMessages > 0 && (
                      <span className="shrink-0 rounded-full bg-[#16a34a] px-2 py-1 text-[11px] font-bold text-white">
                        {u.unreadMessages}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            ))
          ) : (
            renderEmptyState(
              "No recent messages yet",
              "Your direct conversations will appear here."
            )
          )
        ) : channels.length > 0 ? (
          channels.map((channel) => {
            const memberCount = Array.isArray(channel?.members)
              ? channel.members.length
              : 0;
            const channelMeta =
              channel?.unreadMessages > 0
                ? `${memberCount} members • ${channel.unreadMessages} unread`
                : `${memberCount} members`;

            return (
              <button
                key={channel?._id}
                type="button"
                className="flex w-full items-center gap-3 rounded-2xl border border-[#e8ebf2] bg-white px-3 py-3 text-left shadow-sm transition active:scale-[0.99]"
                onClick={() => {
                  setChannels((prev) =>
                    prev.map((item) =>
                      item?._id?.toString() === channel?._id?.toString()
                        ? { ...item, unreadMessages: 0 }
                        : item
                    )
                  );
                  navigate(`/channelchat/${channel?._id}`, {
                    state: {
                      name: channel?.name,
                      description: channel?.description,
                      id: channel?._id,
                    },
                  });
                }}
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${getAvatarTone(
                    channel?.name || ""
                  )}`}
                >
                  {channel?.name?.[0]?.toUpperCase() || "C"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[#1f2937]">
                    {channel?.name}
                  </span>
                  <span className="mt-0.5 block text-xs text-[#6b7280]">
                    {channelMeta}
                  </span>
                </span>
                {channel?.unreadMessages > 0 && (
                  <span className="shrink-0 rounded-full bg-[#16a34a] px-2 py-1 text-[11px] font-bold text-white">
                    {channel.unreadMessages}
                  </span>
                )}
              </button>
            );
          })
        ) : (
          renderEmptyState(
            "No channels available",
            "Channels you belong to will show up here."
          )
        )}
      </div>
    </div>
  );
};

export default MobileConversations;
