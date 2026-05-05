import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { IoPeopleSharp } from "react-icons/io5";
import { Send, Paperclip, CornerUpLeft, X, Pencil, Trash2 } from "lucide-react";
import moment from "moment";
import { useLocation, useParams } from "react-router-dom";
import { BsEmojiSmile } from "react-icons/bs";
import EmojiPicker from "emoji-picker-react";
import { IoMdShareAlt } from "react-icons/io";
import { MdInsertDriveFile } from "react-icons/md";
import { useAuth } from "../../context/authContext";
import { onChannelMessageReceived, joinChannel } from "../../utils/socket";
import socket from "../../utils/socket";
import axios from "axios";
import { downloadFile, getFileNameFromUrl } from "../../utils/helper";
import {
  isWithinEditWindow,
  formatRemainingEditWindow,
  isImage,
  isLikelyAttachment,
  getMessagePreview,
  detectMentionTrigger,
  filterMentionCandidates,
  insertMention,
  tokenizeMessage,
} from "../../utils/chatHelpers";
import Avatar from "../Components/Common/Avatar";
import FilePreview from "../Components/Common/FilePreview";
import ChannelTaskManager from "../Components/Channel/ChannelTaskManager";

const TASK_NUMBER_REGEX = /\bTASK-\d{4}\b/i;
const TASK_STATUS_OPTIONS = ["Assigned", "Acknowledged", "Completed"];
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

const ChannelChat = () => {
  const { userData } = useAuth();
  const location = useLocation();
  const { id: channelIdParam } = useParams();
  const groupUsers = location.state;
  const channelId = groupUsers?.id || channelIdParam;
  const senderId = userData?.userId;

  const [messages, setMessages] = useState([]);
  const [channelInfo, setChannelsInfo] = useState();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [file, setFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState(null);
  const [modal, setModal] = useState(false);
  const [input, setInput] = useState("");
  const [inputSend, setInputSend] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loading, setloading] = useState(false);
  const [replyTarget, setReplyTarget] = useState(null);
  const [highlightedId, setHighlightedId] = useState(null);
  const [activeTab, setActiveTab] = useState(
    location?.state?.openTasks ? "tasks" : "chat"
  );
  const [createTaskModalSignal, setCreateTaskModalSignal] = useState(0);
  const [taskByNumber, setTaskByNumber] = useState({});
  const [taskActionLoading, setTaskActionLoading] = useState({});
  const [taskFocusNumber, setTaskFocusNumber] = useState("");
  const [taskFocusSignal, setTaskFocusSignal] = useState(0);

  // Mentions / edit / delete / reports
  const [mentionCandidates, setMentionCandidates] = useState([]);
  const [mentionTrigger, setMentionTrigger] = useState(null);
  const [highlightedMention, setHighlightedMention] = useState(0);
  const [pendingMentions, setPendingMentions] = useState([]);
  const [editingMessage, setEditingMessage] = useState(null);
  const [openMessageMenu, setOpenMessageMenu] = useState(null);
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  const token = localStorage.getItem("token");
  const messageListRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messageRefs = useRef({});
  const highlightTimerRef = useRef(null);
  const forceBottomUntilRef = useRef(0);
  const fileInputRef = useRef(null);
  const inputElRef = useRef(null);

  const handleShare = () => setModal(true);

  const extractTaskNumber = useCallback((text = "") => {
    if (!text) return "";
    const match = text.match(TASK_NUMBER_REGEX);
    return match ? match[0].toUpperCase() : "";
  }, []);

  const fetchTaskIndex = useCallback(async () => {
    if (!channelId || !token) return;
    try {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_API}/channels/${channelId}/tasks`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) return;
      const data = await response.json();
      if (data?.success && Array.isArray(data.tasks)) {
        const index = {};
        data.tasks.forEach((task) => {
          if (task?.taskNumber) index[task.taskNumber.toUpperCase()] = task;
        });
        setTaskByNumber(index);
      }
    } catch (e) {
      // ignore
    }
  }, [channelId, token]);

  const fetchChannel = async () => {
    if (!channelId) return;
    try {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_API}/api/${channelId}`
      );
      const data = await response.json();
      setChannelsInfo(data);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    fetchChannel();
  }, [channelId]);

  useEffect(() => {
    const fetchMessages = async () => {
      if (!channelId) return;
      try {
        const response = await fetch(
          `${import.meta.env.VITE_BACKEND_API}/channels/${channelId}`
        );
        const data = await response.json();
        setMessages(data?.messages || []);
      } catch (e) {
        // ignore
      }
    };
    fetchMessages();
    fetchTaskIndex();
  }, [channelId, fetchTaskIndex]);

  useEffect(() => {
    if (!channelId || !token) return;
    fetch(`${import.meta.env.VITE_BACKEND_API}/channels/${channelId}/read`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }, [channelId, token]);

  useEffect(() => {
    if (!channelId || !token) return;
    const load = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_BACKEND_API}/channels/${channelId}/mention-candidates`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json().catch(() => ({}));
        if (data?.success) setMentionCandidates(data.candidates || []);
      } catch (e) {
        // ignore
      }
    };
    load();
  }, [channelId, token]);

  const memberById = useMemo(() => {
    const map = {};
    (channelInfo?.members || []).forEach((m) => {
      if (m?._id) map[m._id.toString()] = m;
    });
    (mentionCandidates || []).forEach((m) => {
      if (m?._id && !map[m._id.toString()]) map[m._id.toString()] = m;
    });
    return map;
  }, [channelInfo, mentionCandidates]);

  const mentionIdToName = useMemo(() => {
    const map = {};
    Object.values(memberById).forEach((m) => {
      if (m?._id) map[m._id.toString()] = m.name;
    });
    return map;
  }, [memberById]);

  useEffect(() => {
    if (!channelId) return;
    joinChannel(channelId);
    const unsubscribe = onChannelMessageReceived((msg) => {
      if (msg?.channelId?.toString() !== channelId.toString()) return;
      setMessages((prev) => {
        if (prev.some((m) => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
    });

    const onMsgUpdate = (updated) => {
      if (!updated?._id) return;
      if (updated?.channelId?.toString() !== channelId.toString()) return;
      setMessages((prev) =>
        prev.map((m) => (m._id === updated._id ? { ...m, ...updated } : m))
      );
    };
    socket.on("channel-message-updated", onMsgUpdate);

    const onReportUpdate = ({ channelId: incomingId }) => {
      if (incomingId?.toString() !== channelId.toString()) return;
      fetchReports();
    };
    socket.on("channel-report-updated", onReportUpdate);

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
      socket.off("channel-message-updated", onMsgUpdate);
      socket.off("channel-report-updated", onReportUpdate);
    };
  }, [channelId]);

  const scrollToLatestMessage = useCallback((behavior = "smooth") => {
    const list = messageListRef.current;
    if (list) list.scrollTop = list.scrollHeight;
    messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  useEffect(() => {
    if (activeTab !== "chat") return;
    forceBottomUntilRef.current = Date.now() + 1500;
    scrollToLatestMessage("auto");
    const t1 = setTimeout(() => scrollToLatestMessage("auto"), 100);
    const t2 = setTimeout(() => scrollToLatestMessage("auto"), 280);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [activeTab, channelId, messages.length, scrollToLatestMessage]);

  useEffect(() => {
    if (!file) {
      setFilePreviewUrl(null);
      return;
    }
    if (!file.type?.startsWith("image/")) {
      setFilePreviewUrl(null);
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setFilePreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [file]);

  const uploadFile = async (selected) => {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", selected);
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_BACKEND_API}/files/upload`,
        formData,
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );
      setUploading(false);
      return response.data;
    } catch (e) {
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

  const handleSendMessage = async () => {
    if (loading || uploading) return;
    if (editingMessage) return handleSubmitEdit();
    if (!input.trim() && !file) return;
    const draftInput = input.trim();
    setInput("");
    setMentionTrigger(null);
    let messageContent = draftInput;
    if (file) {
      setloading(true);
      const fileUrl = await uploadFile(file);
      if (!fileUrl) {
        setloading(false);
        return;
      }
      messageContent = buildFileMessageUrl(fileUrl.fileUrl, file.name);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setloading(false);
    }
    const newMessage = {
      sender: senderId,
      channelId,
      message: messageContent,
      replyTo: replyTarget?.id || null,
      mentions: pendingMentions,
      createdAt: new Date(),
    };
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_BACKEND_API}/channels/send`,
        newMessage
      );
      const savedMessage = response?.data?.data;
      if (savedMessage?._id) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === savedMessage._id)) return prev;
          return [...prev, savedMessage];
        });
      }
      setReplyTarget(null);
      setPendingMentions([]);
    } catch (e) {
      // ignore
    }
  };

  const handleStartEdit = (msg) => {
    if (!msg) return;
    if (msg.isDeleted) return;
    if (String(msg.sender) !== String(senderId)) return;
    if (!isWithinEditWindow(msg.createdAt)) return;
    if (msg.message?.startsWith("http")) return;
    setEditingMessage(msg);
    setInput(msg.message || "");
    setReplyTarget(null);
    setOpenMessageMenu(null);
    setTimeout(() => inputElRef.current?.focus(), 0);
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
        `${import.meta.env.VITE_BACKEND_API}/channels/messages/${editingMessage._id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ message: trimmed, mentions: pendingMentions }),
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
      setPendingMentions([]);
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
        `${import.meta.env.VITE_BACKEND_API}/channels/messages/${msg._id}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        alert(data?.message || "Could not delete");
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

  const handleInputChange = (event) => {
    const value = event.target.value;
    setInput(value);
    const cursor = event.target.selectionStart ?? value.length;
    const trigger = detectMentionTrigger(value, cursor);
    setMentionTrigger(trigger);
    setHighlightedMention(0);
    setPendingMentions((current) =>
      current.filter((id) => {
        const name = mentionIdToName[id];
        if (!name) return false;
        return value.includes(`@${name}`);
      })
    );
  };

  const filteredMentionList = useMemo(() => {
    if (!mentionTrigger) return [];
    return filterMentionCandidates(mentionCandidates, mentionTrigger.query);
  }, [mentionCandidates, mentionTrigger]);

  const handlePickMention = (candidate) => {
    if (!mentionTrigger || !candidate) return;
    const { text, cursor } = insertMention(input, mentionTrigger, candidate.name);
    setInput(text);
    setMentionTrigger(null);
    setPendingMentions((curr) => {
      if (curr.includes(candidate._id.toString())) return curr;
      return [...curr, candidate._id.toString()];
    });
    setTimeout(() => {
      inputElRef.current?.focus();
      if (inputElRef.current) {
        inputElRef.current.selectionStart = cursor;
        inputElRef.current.selectionEnd = cursor;
      }
    }, 0);
  };

  const fetchReports = useCallback(async () => {
    if (!channelId || !token) return;
    setReportsLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_API}/channels/${channelId}/reports`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json().catch(() => ({}));
      if (data?.success) setReports(data.reports || []);
    } catch (e) {
      // ignore
    } finally {
      setReportsLoading(false);
    }
  }, [channelId, token]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleSend = async () => {
    const response = await fetch(
      `${import.meta.env.VITE_BACKEND_API}/api/invite`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: channelInfo?._id,
          email: inputSend,
          invitedBy: userData?.userId,
        }),
      }
    );
    if (response.ok) alert("Invite sent successfully");
  };

  const handleText = (value) => setInputSend(value);

  const getSenderName = (id) =>
    channelInfo?.members?.find((m) => m?._id === id)?.name ||
    memberById[id]?.name ||
    "Unknown";

  const handleEmojiClick = (emojiData) => {
    setInput((prev) => prev + emojiData.emoji);
    setTimeout(() => inputElRef.current?.focus(), 0);
  };

  const getReplyContext = (msg) => {
    if (!msg?.replyTo && !msg?.replyPreview?.message) return null;
    if (msg?.replyPreview?.message) {
      const senderName =
        msg.replyPreview.senderName ||
        (String(msg.replyPreview.sender) === String(senderId)
          ? "You"
          : getSenderName(String(msg.replyPreview.sender)));
      return { senderName, message: msg.replyPreview.message, id: msg.replyTo };
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
    const senderName = original?.isSystem
      ? original.systemLabel || "System"
      : String(original.sender) === String(senderId)
      ? "You"
      : getSenderName(String(original.sender));
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
    const senderName = msg?.isSystem
      ? msg.systemLabel || "System"
      : String(msg.sender) === String(senderId)
      ? "You"
      : getSenderName(String(msg.sender));
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

  const openTaskDetails = (taskNumber) => {
    setActiveTab("tasks");
    setTaskFocusNumber(taskNumber);
    setTaskFocusSignal((p) => p + 1);
  };

  const handleTaskQuickStatusChange = async (taskNumber, nextStatus) => {
    if (!taskNumber || !channelId) return;
    const targetTask = taskByNumber[taskNumber];
    if (!targetTask) return;
    setTaskActionLoading((curr) => ({ ...curr, [taskNumber]: true }));
    try {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_API}/channels/${channelId}/tasks/${targetTask._id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: nextStatus }),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (data?.success && data.task) {
        setTaskByNumber((curr) => ({ ...curr, [taskNumber]: data.task }));
      }
    } catch (e) {
      // ignore
    } finally {
      setTaskActionLoading((curr) => {
        const next = { ...curr };
        delete next[taskNumber];
        return next;
      });
    }
  };

  const handleMessageMediaLoaded = () => {
    if (Date.now() < forceBottomUntilRef.current) {
      scrollToLatestMessage("auto");
    }
  };

  const channelDisplayName = groupUsers?.name || channelInfo?.name || "Channel";
  const channelImage = channelInfo?.image || "";
  const channelTags = channelInfo?.tags || [];
  const channelStatus = channelInfo?.statusTag || "Active";
  const channelDescription = channelInfo?.description || "";
  const channelDetails = channelInfo?.channelDetails || {};

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
    const tokens = tokenizeMessage(value || "", mentionIdToName);
    return (
      <span className="whitespace-pre-wrap break-words overflow-auto">
        {tokens.map((t, idx) =>
          t.type === "mention" ? (
            <span
              key={idx}
              className="bg-orange-100 text-orange-700 rounded px-1 font-medium"
            >
              @{t.value}
            </span>
          ) : (
            <span key={idx}>{t.value}</span>
          )
        )}
      </span>
    );
  };

  if (!channelId) {
    return (
      <div className="p-4 text-sm text-gray-500">
        Channel not found. Please open it from the channel list.
      </div>
    );
  }

  return (
    <div className="p-0 lg:p-4 w-full flex flex-col h-[100dvh] md:h-[calc(100vh-110px)] lg:h-[calc(100vh-60px)]">
      {/* Header */}
      <div className="mb-2 lg:mb-4 border-b bg-white pt-1.5 px-2 sm:px-3 lg:px-6 pb-2 w-full">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex items-start gap-3">
            <Avatar
              src={channelImage}
              name={channelDisplayName}
              size={44}
              rounded="rounded-lg"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-semibold truncate">
                  # {channelDisplayName.charAt(0).toUpperCase() + channelDisplayName.slice(1)}
                </h2>
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                    channelStatus === "Active"
                      ? "bg-green-100 text-green-700"
                      : channelStatus === "Paused"
                      ? "bg-yellow-100 text-yellow-700"
                      : channelStatus === "Closed"
                      ? "bg-red-100 text-red-700"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {channelStatus}
                </span>
                {channelTags.map((t) => (
                  <span
                    key={t}
                    className="text-[10px] font-semibold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded"
                  >
                    {t}
                  </span>
                ))}
              </div>
              {channelDescription && (
                <p
                  className="text-[11px] text-gray-600 truncate max-w-[420px]"
                  title={channelDescription}
                >
                  {channelDescription}
                </p>
              )}
              <div className="mt-0.5 flex items-center gap-3 text-[11px] text-gray-700">
                <div className="flex items-center gap-1">
                  <IoPeopleSharp className="shrink-0" />
                  <span>{channelInfo?.members?.length ?? 0} members</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 lg:flex-nowrap lg:justify-end">
            <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 min-w-0">
              {["chat", "tasks", "reports", "about"].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-2 sm:px-3 py-1 text-[11px] sm:text-sm whitespace-nowrap rounded-md ${
                    activeTab === tab
                      ? "bg-orange-500 text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setCreateTaskModalSignal((p) => p + 1)}
              className="rounded-md bg-orange-500 px-2.5 py-1 text-[11px] sm:px-3 sm:py-1.5 sm:text-sm font-medium text-white hover:bg-orange-600"
            >
              + Task
            </button>

            <div className="relative flex items-center gap-1 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={handleShare}
                className="p-1 text-[15px] sm:text-base text-gray-700 hover:text-gray-900"
                title="Share / invite"
              >
                <IoMdShareAlt className="cursor-pointer" />
              </button>
              {modal && (
                <div className="absolute top-10 right-0 mt-2 space-y-3 bg-white px-3 pb-4 pt-3 rounded shadow-lg w-72 max-w-[85vw] z-30">
                  <button
                    className="absolute top-1 right-1 text-xl px-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      setModal(false);
                    }}
                  >
                    &times;
                  </button>
                  <p className="text-[11px] font-semibold text-gray-600">Invite by email</p>
                  <input
                    name="email"
                    type="email"
                    placeholder="email…"
                    value={inputSend}
                    onChange={(e) => handleText(e.target.value)}
                    className="w-full p-1.5 border border-gray-400 rounded outline-none text-[12px]"
                  />
                  <div className="flex gap-2">
                    <p className="p-1 bg-gray-100 rounded text-[10px] truncate flex-1">
                      {channelInfo?.inviteLink}
                    </p>
                    <button
                      className="px-2 text-[11px] bg-orange-400 text-white rounded"
                      onClick={() => {
                        navigator.clipboard.writeText(channelInfo?.inviteLink || "");
                        alert("Copied to clipboard!");
                      }}
                    >
                      copy
                    </button>
                  </div>
                  <button
                    className="w-full px-2 py-1 text-[11px] bg-orange-500 text-white rounded"
                    onClick={handleSend}
                  >
                    Send invite
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Reports tab — employees can only download */}
      {activeTab === "reports" && (
        <div className="flex-1 overflow-y-auto px-3 lg:px-6 pb-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">
            Monthly Task Reports
          </h3>
          {reportsLoading ? (
            <p className="text-xs text-gray-500">Loading…</p>
          ) : reports.length === 0 ? (
            <p className="text-xs text-gray-500">No reports yet.</p>
          ) : (
            <ul className="divide-y border rounded overflow-hidden">
              {reports.map((r) => {
                const monthLabel = monthLabels[r.month - 1] || r.month;
                return (
                  <li
                    key={r._id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs bg-white"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800">
                        {r.title || `${monthLabel} ${r.year} report`}
                      </p>
                      <p className="text-[11px] text-gray-500 truncate">
                        {r.fileName}
                        {r.note ? ` • ${r.note}` : ""}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        Uploaded {moment(r.createdAt).format("DD MMM YYYY, HH:mm")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => downloadFile(r.fileUrl, r.fileName)}
                      className="px-2 py-1 rounded bg-slate-900 text-white"
                    >
                      Download
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* About tab */}
      {activeTab === "about" && (
        <div className="flex-1 overflow-y-auto px-3 lg:px-6 pb-4 text-sm">
          <div className="bg-white border rounded p-4 max-w-2xl">
            <h3 className="text-base font-semibold text-gray-900 mb-3">
              Channel Details
            </h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-gray-500">Description</dt>
                <dd className="text-gray-800">{channelDescription || "—"}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Status</dt>
                <dd className="text-gray-800">{channelStatus}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Tags</dt>
                <dd className="text-gray-800">
                  {channelTags.length ? channelTags.join(", ") : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Purpose</dt>
                <dd className="text-gray-800">
                  {channelDetails?.purpose || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Industry</dt>
                <dd className="text-gray-800">
                  {channelDetails?.industry || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Website</dt>
                <dd className="text-gray-800 break-all">
                  {channelDetails?.website || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Location</dt>
                <dd className="text-gray-800">
                  {channelDetails?.location || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Members</dt>
                <dd className="text-gray-800">
                  {channelInfo?.members?.length || 0}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {/* Chat tab */}
      {activeTab === "chat" && (
        <>
          <div
            ref={messageListRef}
            className="flex-1 px-2 lg:px-4 overflow-y-auto scrollable pb-2"
            onLoadCapture={handleMessageMediaLoaded}
            onLoadedMetadataCapture={handleMessageMediaLoaded}
          >
            {messages.map((msg, index) => {
              const isSelf = String(msg.sender) === String(senderId);
              const taskNumber = msg?.isSystem ? extractTaskNumber(msg?.message) : "";
              const linkedTask = taskNumber ? taskByNumber[taskNumber] : null;
              const isTaskActionLoading = taskNumber
                ? !!taskActionLoading[taskNumber]
                : false;
              const senderLabel = msg?.isSystem
                ? msg.systemLabel || "System"
                : isSelf
                ? "You"
                : getSenderName(String(msg.sender));
              const replyContext = getReplyContext(msg);
              const currentDay = moment(msg.createdAt).format("YYYY-MM-DD");
              const previousDay =
                index > 0
                  ? moment(messages[index - 1]?.createdAt).format("YYYY-MM-DD")
                  : null;
              const showDateDivider = index === 0 || currentDay !== previousDay;
              const canMutate =
                !msg.isDeleted &&
                isSelf &&
                isWithinEditWindow(msg.createdAt) &&
                !msg?.isSystem;
              const canEdit =
                canMutate && !(msg.message || "").startsWith("http");
              const senderEntity = memberById[String(msg.sender)];
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
                        name={senderLabel}
                        src={senderEntity?.avatar || ""}
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

                      {renderMessageBody(msg, isSelf)}

                      {taskNumber && !msg.isDeleted && (
                        <div className="mt-1.5 rounded-md border border-slate-200/80 bg-white/70 p-1.5">
                          <p className="mb-1.5 text-[12px] font-semibold text-slate-900 break-words leading-4">
                            {linkedTask?.title || "Task details syncing..."}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openTaskDetails(taskNumber)}
                              className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-50"
                            >
                              View Task
                            </button>
                            <select
                              value={linkedTask?.status || "Syncing..."}
                              onChange={(event) => {
                                const next = event.target.value;
                                if (!linkedTask || next === linkedTask.status)
                                  return;
                                handleTaskQuickStatusChange(taskNumber, next);
                              }}
                              disabled={!linkedTask || isTaskActionLoading}
                              className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px] font-medium text-slate-700 disabled:opacity-60"
                            >
                              {linkedTask ? (
                                TASK_STATUS_OPTIONS.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))
                              ) : (
                                <option value="Syncing...">Syncing...</option>
                              )}
                            </select>
                          </div>
                          {linkedTask && (
                            <p className="mt-1 text-[10px] text-slate-500">
                              Due {moment(linkedTask.deadline).format("DD MMM, HH:mm")}
                              {linkedTask?.assignedToUser?.name
                                ? ` • ${linkedTask.assignedToUser.name}`
                                : ""}
                            </p>
                          )}
                        </div>
                      )}

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
            {file && !editingMessage && (
              <div className="mb-2 flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                {filePreviewUrl ? (
                  <img
                    src={filePreviewUrl}
                    alt="Selected file"
                    className="w-10 h-10 rounded object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded bg-gray-200 text-[10px] font-semibold text-gray-600 flex items-center justify-center">
                    <MdInsertDriveFile />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{file.name}</p>
                  <p className="text-[10px] text-gray-500">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="text-xs text-red-500"
                >
                  Remove
                </button>
              </div>
            )}

            <div className="flex items-center w-full gap-2 relative">
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
                onChange={(e) => setFile(e.target.files[0] || null)}
                className="hidden"
                id="fileInput"
              />
              <label
                htmlFor="fileInput"
                className={`cursor-pointer ${
                  editingMessage ? "opacity-40 pointer-events-none" : ""
                }`}
              >
                <Paperclip size={22} className="text-gray-500" />
              </label>

              <div className="flex-1 relative">
                <input
                  ref={inputElRef}
                  type="text"
                  className="w-full p-2 border rounded-lg outline-none text-[15px]"
                  placeholder={
                    editingMessage
                      ? "Edit message…"
                      : "Type a message… use @ to mention"
                  }
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={(e) => {
                    if (mentionTrigger && filteredMentionList.length > 0) {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setHighlightedMention(
                          (i) => (i + 1) % filteredMentionList.length
                        );
                        return;
                      }
                      if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setHighlightedMention(
                          (i) =>
                            (i - 1 + filteredMentionList.length) %
                            filteredMentionList.length
                        );
                        return;
                      }
                      if (e.key === "Enter" || e.key === "Tab") {
                        e.preventDefault();
                        handlePickMention(
                          filteredMentionList[highlightedMention] ||
                            filteredMentionList[0]
                        );
                        return;
                      }
                      if (e.key === "Escape") {
                        setMentionTrigger(null);
                        return;
                      }
                    }
                    if (e.key === "Enter") handleSendMessage();
                  }}
                  disabled={isSending}
                />
                {mentionTrigger && filteredMentionList.length > 0 && (
                  <div className="absolute bottom-12 left-0 right-0 max-h-60 overflow-y-auto bg-white border rounded-lg shadow-lg z-40">
                    {filteredMentionList.map((c, idx) => (
                      <button
                        key={c._id}
                        type="button"
                        onClick={() => handlePickMention(c)}
                        onMouseEnter={() => setHighlightedMention(idx)}
                        className={`flex items-center gap-2 w-full px-3 py-2 text-left text-xs ${
                          idx === highlightedMention
                            ? "bg-orange-50"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <Avatar name={c.name} src={c.avatar} size={22} />
                        <span className="font-medium text-gray-800">{c.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

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
        </>
      )}

      <ChannelTaskManager
        channelId={channelId}
        channelName={channelDisplayName}
        channelMembers={channelInfo?.members || []}
        currentUserId={senderId}
        showList={activeTab === "tasks"}
        openCreateTaskSignal={createTaskModalSignal}
        focusTaskNumber={taskFocusNumber}
        focusTaskSignal={taskFocusSignal}
      />
    </div>
  );
};

export default ChannelChat;
