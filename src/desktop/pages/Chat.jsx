import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { Send, Paperclip, CornerUpLeft, X, Pencil, Trash2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  onMessageReceived,
  connectSocket,
  onUserStatusUpdate,
  fetchOnlineUsers,
} from "../../utils/socket";
import socket from "../../utils/socket";
import { useAuth } from "../../context/authContext";
import moment from "moment";
import { BsEmojiSmile } from "react-icons/bs";
import EmojiPicker from "emoji-picker-react";
import { downloadFile, getFileNameFromUrl } from "../../utils/helper";
import {
  isImage,
  isLikelyAttachment,
  getMessagePreview,
  isWithinEditWindow,
  formatRemainingEditWindow,
  tokenizeMessage,
} from "../../utils/chatHelpers";
import Avatar from "../Components/Common/Avatar";
import FilePreview from "../Components/Common/FilePreview";
import ImageGrid from "../Components/Common/ImageGrid";
import Lightbox from "../Components/Common/Lightbox";

const Chat = () => {
  const location = useLocation();
  const user = location.state;
  const receiverId = user?.id;
  const selectedUser = location?.state?.selectedUsers;
  const navigate = useNavigate();
  const { userData } = useAuth();
  const senderId = userData?.userId;
  const [isOnline, setIsOnline] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef(null);
  const messageRefs = useRef({});
  const highlightTimerRef = useRef(null);
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setloading] = useState(false);
  // Pending attachments — array of { file, previewUrl } so multiple files can
  // be queued before sending. The send flow groups them all into a single
  // message with `attachments: []` (issue #4).
  const [pendingFiles, setPendingFiles] = useState([]);
  const [lightbox, setLightbox] = useState(null);
  const [replyTarget, setReplyTarget] = useState(null);
  const [highlightedId, setHighlightedId] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [openMessageMenu, setOpenMessageMenu] = useState(null);
  const authHeader = { Authorization: `Bearer ${localStorage.getItem("token")}` };

  const markMessagesAsRead = async (senderId) => {
    try {
      await axios.post(
        `${import.meta.env.VITE_BACKEND_API}/message/messages/mark-as-read`,
        { senderId },
        { headers: authHeader }
      );
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  };

  useEffect(() => {
    if (receiverId) markMessagesAsRead(receiverId);
  }, [receiverId]);

  useEffect(() => {
    setReplyTarget(null);
    setHighlightedId(null);
    setEditingMessage(null);
    setInput("");
  }, [receiverId]);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

  useEffect(() => {
    connectSocket();
    const fetchMessages = async () => {
      try {
        const res = await axios.get(
          `${import.meta.env.VITE_BACKEND_API}/message/messages/${senderId}/${receiverId}`
        );
        setMessages(res.data?.messages || []);
      } catch (error) {
        console.error("Error fetching messages:", error);
      }
    };

    fetchMessages();

    fetchOnlineUsers((onlineUsers) => {
      setIsOnline(onlineUsers.includes(receiverId));
    });

    const messageListener = (newMessage) => {
      if (
        (newMessage.sender === senderId && newMessage.receiver === receiverId) ||
        (newMessage.sender === receiverId && newMessage.receiver === senderId)
      ) {
        setMessages((prev) => {
          if (newMessage?._id && prev.some((m) => m._id === newMessage._id)) {
            return prev;
          }
          return [...prev, newMessage];
        });
      }
    };
    const unsubscribeMessage = onMessageReceived(messageListener);

    // Edit/delete updates fan in for both sides (feature #3 + #5).
    const onMsgUpdate = (updated) => {
      if (!updated?._id) return;
      const isThisChat =
        (String(updated.sender) === String(senderId) &&
          String(updated.receiver) === String(receiverId)) ||
        (String(updated.sender) === String(receiverId) &&
          String(updated.receiver) === String(senderId));
      if (!isThisChat) return;
      setMessages((prev) =>
        prev.map((m) => (m._id === updated._id ? { ...m, ...updated } : m))
      );
    };
    socket.on("direct-message-updated", onMsgUpdate);

    const statusListener = ({ userId, status }) => {
      if (userId === receiverId) setIsOnline(status === "online");
    };
    onUserStatusUpdate(statusListener);

    return () => {
      unsubscribeMessage?.();
      socket.off("direct-message-updated", onMsgUpdate);
      onUserStatusUpdate(() => {});
    };
  }, [senderId, receiverId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => {
      pendingFiles.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uploadFile = async (selected) => {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", selected);
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_BACKEND_API}/files/upload`,
        formData,
        { headers: authHeader }
      );
      setUploading(false);
      return response.data;
    } catch (error) {
      console.error("Error uploading file:", error);
      setUploading(false);
      return null;
    }
  };

  const buildFileMessageUrl = (url, fileName) => {
    if (!url || !fileName) return url;
    if (url.includes("filename=")) return url;
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}filename=${encodeURIComponent(fileName)}`;
  };

  const handleClearChat = async () => {
    if (!receiverId) return;
    const confirmed = window.confirm(
      "Clear all messages in this chat? This can't be undone."
    );
    if (!confirmed) return;
    try {
      await axios.post(
        `${import.meta.env.VITE_BACKEND_API}/message/clear`,
        { otherUserId: receiverId },
        { headers: authHeader }
      );
      setMessages([]);
      alert("Chat cleared");
    } catch (error) {
      alert("Unable to clear chat. Please try again.");
    }
  };

  const handleStartEdit = (msg) => {
    if (!msg) return;
    if (msg.isDeleted) return;
    if (String(msg.sender) !== String(senderId)) return;
    if (!isWithinEditWindow(msg.createdAt)) return;
    if (msg.message?.startsWith("http")) return; // attachments aren't editable
    setEditingMessage(msg);
    setInput(msg.message || "");
    setReplyTarget(null);
    setOpenMessageMenu(null);
    setTimeout(() => document.getElementById("chatInput")?.focus(), 0);
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setInput("");
  };

  const handleSubmitEdit = async () => {
    if (!editingMessage) return;
    const trimmed = input.trim();
    if (!trimmed) return;
    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_API}/message/messages/${editingMessage._id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeader },
          body: JSON.stringify({ message: trimmed }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        alert(data?.message || "Could not edit message");
        return;
      }
      setMessages((prev) =>
        prev.map((m) => (m._id === data.data._id ? { ...m, ...data.data } : m))
      );
      setEditingMessage(null);
      setInput("");
    } catch (e) {
      alert("Edit failed");
    }
  };

  const handleDeleteMessage = async (msg) => {
    if (!msg) return;
    if (String(msg.sender) !== String(senderId)) return;
    if (!isWithinEditWindow(msg.createdAt)) return;
    if (!window.confirm("Delete this message for everyone?")) return;
    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_API}/message/messages/${msg._id}`,
        { method: "DELETE", headers: authHeader }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        alert(data?.message || "Could not delete message");
        return;
      }
      setMessages((prev) =>
        prev.map((m) => (m._id === data.data._id ? { ...m, ...data.data } : m))
      );
      setOpenMessageMenu(null);
    } catch (e) {
      alert("Delete failed");
    }
  };

  const handleSendMessage = async () => {
    if (loading || uploading) return;
    if (editingMessage) return handleSubmitEdit();
    const draftInput = input.trim();
    const filesToSend = [...pendingFiles];
    if (!draftInput && filesToSend.length === 0) return;

    const replyId = replyTarget?.id || null;
    setInput("");
    setReplyTarget(null);
    setPendingFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    const ta = document.getElementById("chatInput");
    if (ta) ta.style.height = "auto";

    let attachmentUrls = [];
    if (filesToSend.length > 0) {
      setloading(true);
      try {
        const results = await Promise.all(
          filesToSend.map(async ({ file }) => {
            const r = await uploadFile(file);
            if (!r?.fileUrl) return null;
            return buildFileMessageUrl(r.fileUrl, file.name);
          })
        );
        attachmentUrls = results.filter(Boolean);
      } finally {
        setloading(false);
        filesToSend.forEach(
          (p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl)
        );
      }
      if (attachmentUrls.length === 0 && !draftInput) return;
    }

    const newMessage = {
      sender: senderId,
      receiver: receiverId,
      message: draftInput,
      attachments: attachmentUrls,
      replyTo: replyId,
      createdAt: new Date(),
    };

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_BACKEND_API}/message/send-message`,
        newMessage
      );
      const savedMessage = response?.data?.data;
      if (savedMessage?._id) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === savedMessage._id)) return prev;
          return [...prev, savedMessage];
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleEmojiClick = (emojiData) => {
    setInput((prev) => prev + emojiData.emoji);
    setTimeout(() => document.getElementById("chatInput")?.focus(), 0);
  };

  const getReplyContext = (msg) => {
    if (!msg?.replyTo && !msg?.replyPreview?.message) return null;
    if (msg?.replyPreview?.message) {
      const senderName =
        msg.replyPreview.senderName ||
        (String(msg.replyPreview.sender) === String(senderId)
          ? "You"
          : user?.name || "User");
      return {
        senderName,
        message: msg.replyPreview.message,
        id: msg.replyTo,
      };
    }
    if (!msg?.replyTo) return null;
    const original = messages.find((item) => item._id === msg.replyTo);
    if (!original) {
      return {
        senderName: "Unknown",
        message: "Original message not available",
        id: msg.replyTo,
      };
    }
    const senderName =
      String(original.sender) === String(senderId)
        ? "You"
        : user?.name || "User";
    return {
      senderName,
      message: getMessagePreview(original.message),
      id: msg.replyTo,
    };
  };

  const formatFileSize = (size) => {
    if (!size) return "";
    const kb = size / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const isSending = loading || uploading;

  const formatDateLabel = (value) => {
    const day = moment(value);
    if (day.isSame(moment(), "day")) return "Today";
    if (day.isSame(moment().subtract(1, "day"), "day")) return "Yesterday";
    return day.format("DD MMM YYYY");
  };

  const handleReplySelect = (msg) => {
    if (!msg?._id) return;
    const senderName =
      String(msg.sender) === String(senderId) ? "You" : user?.name || "User";
    setReplyTarget({
      id: msg._id,
      senderName,
      message: getMessagePreview(msg.message),
    });
  };

  const scrollToMessage = (id) => {
    if (!id) return;
    const target = messageRefs.current[id];
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedId(id);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => {
      setHighlightedId((c) => (c === id ? null : c));
    }, 1200);
  };

  const renderMessageBody = (msg, isSelf) => {
    if (msg.isDeleted) {
      return (
        <span className="italic text-slate-500 text-[13px]">
          This message was deleted
        </span>
      );
    }
    const value = msg.message;
    if (isImage(value) || isLikelyAttachment(value)) {
      return <FilePreview url={value} />;
    }
    if (typeof value === "string" && value.startsWith("http")) {
      // Whole-message URL (typical for legacy "just the link" messages).
      return (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className={`underline break-words break-all ${
            isSelf ? "text-blue-700" : "text-blue-600"
          }`}
        >
          {value}
        </a>
      );
    }
    // For mixed text + url messages, tokenise so URLs become real links.
    const tokens = tokenizeMessage(value || "", {});
    return (
      <span className="whitespace-pre-wrap break-words overflow-auto">
        {tokens.map((t, idx) => {
          if (t.type === "url") {
            return (
              <a
                key={idx}
                href={t.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`underline break-all ${
                  isSelf ? "text-blue-700" : "text-blue-600"
                }`}
              >
                {t.value}
              </a>
            );
          }
          return <span key={idx}>{t.value}</span>;
        })}
      </span>
    );
  };

  if (!receiverId) {
    return (
      <div className="p-4 text-sm text-gray-700">
        <p>Please pick a conversation from the list.</p>
        <button
          className="mt-3 px-3 py-2 bg-orange-500 text-white rounded text-xs"
          onClick={() => navigate("/conversations")}
        >
          Go to conversations
        </button>
      </div>
    );
  }

  return (
    <div className="p-0 lg:p-4 w-full flex flex-col h-[100dvh] md:h-[calc(100vh-110px)] lg:h-[calc(100vh-80px)]">
      <div className="flex gap-2 lg:gap-4 mb-2 lg:mb-6 border-b pt-1.5 px-2 lg:px-8 pb-1.5 items-center">
        <Avatar
          name={user?.name || ""}
          src={user?.avatar || ""}
          size={40}
        />
        <div className="min-w-0">
          <h2 className="text-[13px] lg:text-sm font-semibold truncate">
            {user?.name}
          </h2>
          <p className="text-[9px] lg:text-[10px] text-green-500 font-semibold">
            {isOnline ? "Online" : "Offline"}
          </p>
        </div>
      </div>

      <div className="flex-1 px-2 lg:px-4 overflow-y-auto scrollable pb-2">
        {messages.map((msg, index) => {
          const isSelf = String(msg.sender) === String(senderId);
          const senderLabel = isSelf ? "You" : user?.name || "Unknown";
          const replyContext = getReplyContext(msg);
          const currentDay = moment(msg.createdAt).format("YYYY-MM-DD");
          const previousDay =
            index > 0
              ? moment(messages[index - 1]?.createdAt).format("YYYY-MM-DD")
              : null;
          const showDateDivider = index === 0 || currentDay !== previousDay;
          const canMutate =
            !msg.isDeleted && isSelf && isWithinEditWindow(msg.createdAt);
          const canEdit =
            canMutate && !(msg.message || "").startsWith("http");
          return (
            <div key={msg._id || index}>
              {showDateDivider && (
                <div className="flex justify-center my-2">
                  <span className="px-3 py-1 rounded-full bg-gray-200 text-gray-600 text-[11px]">
                    {formatDateLabel(msg.createdAt)}
                  </span>
                </div>
              )}
              <div
                className={`flex items-start gap-2 mb-2 ${
                  isSelf ? "justify-end" : "justify-start"
                }`}
              >
                {!isSelf && (
                  <Avatar
                    name={user?.name || ""}
                    src={user?.avatar || ""}
                    size={28}
                  />
                )}
                <div
                  ref={(el) => {
                    if (msg?._id && el) messageRefs.current[msg._id] = el;
                  }}
                  className={`group p-2 rounded-lg flex flex-col gap-1 max-w-[75%] min-w-[140px] shadow-sm relative
                    ${
                      msg.isDeleted
                        ? "bg-gray-100 text-gray-500 border border-gray-200"
                        : isSelf
                        ? "bg-[#FFFBDC] text-slate-900 border border-[#f2dba0] ml-auto"
                        : "bg-slate-100 text-slate-900 border border-slate-200"
                    }
                    ${highlightedId === msg._id ? "ring-2 ring-orange-200" : ""}
                  `}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="text-[10px] font-semibold opacity-80 truncate max-w-[180px]"
                      title={senderLabel}
                    >
                      {senderLabel}
                    </span>
                    <div className="flex items-center gap-1">
                      {!msg.isDeleted && (
                        <button
                          type="button"
                          onClick={() => handleReplySelect(msg)}
                          className="text-slate-400 hover:text-slate-700 opacity-0 group-hover:opacity-100"
                          title="Reply"
                        >
                          <CornerUpLeft className="w-3 h-3" />
                        </button>
                      )}
                      {canMutate && (
                        <button
                          type="button"
                          onClick={() =>
                            setOpenMessageMenu(
                              openMessageMenu === msg._id ? null : msg._id
                            )
                          }
                          className="text-slate-400 hover:text-slate-700 opacity-0 group-hover:opacity-100"
                          title="More"
                        >
                          ⋯
                        </button>
                      )}
                    </div>
                  </div>

                  {openMessageMenu === msg._id && (
                    <div className="absolute right-1 top-6 z-20 bg-white border rounded shadow-lg text-xs">
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => handleStartEdit(msg)}
                          className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 w-full text-left"
                        >
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteMessage(msg)}
                        className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-red-600 w-full text-left"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                      <p className="px-3 py-1 text-[10px] text-gray-400 border-t">
                        Window left:{" "}
                        {formatRemainingEditWindow(msg.createdAt)}
                      </p>
                    </div>
                  )}

                  {replyContext && (
                    <button
                      type="button"
                      onClick={() => scrollToMessage(replyContext.id)}
                      className={`mb-1 px-2 py-1 rounded border-l-4 text-left ${
                        isSelf
                          ? "bg-[#F7EFC7] border-[#e5cf8b]"
                          : "bg-slate-200/70 border-slate-300 text-slate-700"
                      } ${replyContext.id ? "cursor-pointer" : "cursor-default"}`}
                      disabled={!replyContext.id}
                    >
                      <p
                        className="text-[10px] font-semibold truncate max-w-[220px]"
                        title={replyContext.senderName}
                      >
                        {replyContext.senderName}
                      </p>
                      <p
                        className="text-[10px] truncate"
                        title={replyContext.message}
                      >
                        {replyContext.message}
                      </p>
                    </button>
                  )}

                  {/* Attachments grid + lightbox (issue #4 — Slack/WhatsApp
                      style). Image attachments share a single grid + carousel;
                      non-image attachments fall through to FilePreview chips. */}
                  {(() => {
                    if (msg.isDeleted) return null;
                    const atts = Array.isArray(msg.attachments)
                      ? msg.attachments.filter(Boolean)
                      : [];
                    if (atts.length === 0) return null;
                    const imageAtts = atts.filter((u) => isImage(u));
                    const otherAtts = atts.filter((u) => !isImage(u));
                    return (
                      <div className="flex flex-col gap-1.5">
                        {imageAtts.length > 0 && (
                          <ImageGrid
                            urls={imageAtts}
                            onOpen={(idx) =>
                              setLightbox({ urls: imageAtts, index: idx })
                            }
                          />
                        )}
                        {otherAtts.map((u, i) => (
                          <FilePreview key={i} url={u} />
                        ))}
                      </div>
                    );
                  })()}

                  {!(
                    Array.isArray(msg.attachments) &&
                    msg.attachments.length > 0 &&
                    !msg.message
                  ) && renderMessageBody(msg, isSelf)}

                  <div className="flex items-center gap-1 self-end mt-0.5">
                    {msg.editedAt && !msg.isDeleted && (
                      <span className="text-[9px] text-gray-500 italic">
                        edited
                      </span>
                    )}
                    <span
                      className="text-[9px] text-gray-500"
                      title={moment(msg.createdAt).format("DD MMM YYYY, HH:mm")}
                    >
                      {moment(msg.createdAt).format("HH:mm")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {loading && (
        <div className="flex items-center justify-center">
          <div className="w-5 h-5 border-2 mb-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      <div className="p-3 lg:p-4 bg-white border-t w-full sticky bottom-0 left-0 right-0 z-10">
        {editingMessage && (
          <div className="mb-2 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
            <Pencil className="w-4 h-4 text-blue-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-blue-700">
                Editing message
              </p>
              <p className="text-[11px] text-gray-600 truncate">
                {editingMessage.message}
              </p>
            </div>
            <button
              type="button"
              onClick={handleCancelEdit}
              className="text-gray-500 hover:text-gray-700"
              aria-label="Cancel edit"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {replyTarget && !editingMessage && (
          <div className="mb-2 flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-orange-700">
                Replying to {replyTarget.senderName}
              </p>
              <p className="text-[11px] text-gray-600 truncate">
                {replyTarget.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReplyTarget(null)}
              className="text-gray-500 hover:text-gray-700"
              aria-label="Cancel reply"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {pendingFiles.length > 0 && !editingMessage && (
          <div className="mb-2 rounded-lg border border-gray-200 bg-gray-50 p-2">
            <p className="text-[10px] font-semibold text-gray-600 mb-1">
              {pendingFiles.length} attachment{pendingFiles.length === 1 ? "" : "s"}
            </p>
            <div className="flex flex-wrap gap-2">
              {pendingFiles.map((p, idx) => (
                <div
                  key={`${p.file.name}-${idx}`}
                  className="relative w-16 h-16 rounded border border-gray-200 bg-white flex items-center justify-center overflow-hidden group"
                  title={`${p.file.name} • ${formatFileSize(p.file.size)}`}
                >
                  {p.previewUrl ? (
                    <img
                      src={p.previewUrl}
                      alt={p.file.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center px-1">
                      <span className="text-[10px] font-semibold text-gray-600">
                        {p.file.name.split(".").pop()?.toUpperCase()}
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setPendingFiles((curr) => {
                        const next = curr.filter((_, i) => i !== idx);
                        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
                        return next;
                      });
                    }}
                    className="absolute top-0 right-0 w-4 h-4 rounded-bl bg-black/60 text-white text-[10px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100"
                    aria-label={`Remove ${p.file.name}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex items-center w-full gap-2">
          <div className="relative">
            <button onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
              <BsEmojiSmile size={22} className="cursor-pointer text-gray-500" />
            </button>
            {showEmojiPicker && (
              <div className="absolute bottom-10 left-0 z-50">
                <EmojiPicker onEmojiClick={handleEmojiClick} />
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={(e) => {
              const picked = Array.from(e.target.files || []);
              if (picked.length === 0) return;
              setPendingFiles((curr) => [
                ...curr,
                ...picked.map((f) => ({
                  file: f,
                  previewUrl: f.type?.startsWith("image/")
                    ? URL.createObjectURL(f)
                    : "",
                })),
              ]);
              e.target.value = "";
            }}
            className="hidden"
            id="fileInput"
          />
          <label
            htmlFor="fileInput"
            className={`cursor-pointer ${
              editingMessage ? "opacity-40 pointer-events-none" : ""
            }`}
            title="Attach files (multiple allowed)"
          >
            <Paperclip size={22} className="text-gray-500" />
          </label>

          <textarea
            id="chatInput"
            rows={1}
            className="flex-1 p-2 border rounded-lg outline-none text-[15px] resize-none max-h-40 overflow-y-auto"
            placeholder={
              editingMessage
                ? "Edit message…"
                : "Type a message... (Shift/Alt+Enter for new line)"
            }
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              const ta = e.target;
              ta.style.height = "auto";
              ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
            }}
            onPaste={() => {
              requestAnimationFrame(() => {
                const ta = document.getElementById("chatInput");
                if (ta) {
                  ta.style.height = "auto";
                  ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
                }
              });
            }}
            onKeyDown={(e) => {
              // Enter alone → send. Shift+Enter or Alt+Enter → newline.
              if (e.key === "Enter" && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                handleSendMessage();
                requestAnimationFrame(() => {
                  const ta = document.getElementById("chatInput");
                  if (ta) ta.style.height = "auto";
                });
              }
            }}
            disabled={isSending}
          />

          <button
            onClick={handleSendMessage}
            className={`p-2 bg-orange-400 text-white rounded-lg shrink-0 ${
              isSending ? "opacity-60 cursor-not-allowed" : ""
            }`}
            disabled={isSending}
            title={editingMessage ? "Save edit" : "Send"}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>

      {lightbox && (
        <Lightbox
          urls={lightbox.urls}
          startIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
};

export default Chat;
