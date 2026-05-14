import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { IoPeopleSharp } from "react-icons/io5";
import { Send, Paperclip, CornerUpLeft, X, Pencil, Trash2 } from "lucide-react";
import { BsPin, BsPinFill } from "react-icons/bs";
import moment from "moment";
import { useLocation, useNavigate, useParams } from "react-router";
import { BsEmojiSmile } from "react-icons/bs";
import EmojiPicker from "emoji-picker-react";
import { IoMdShareAlt } from "react-icons/io";
import { MdInsertDriveFile } from "react-icons/md";
import { useAuth } from "../../context/authContext";
import { onChannelMessageReceived, joinChannel } from "../../utils/socket";
import socket from "../../utils/socket";
import axios from "axios";
import ChannelTaskManager from "../Components/Channel/ChannelTaskManager";
import { downloadFile, getFileNameFromUrl } from "../../utils/helper";
import {
  EDIT_WINDOW_MS,
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
import ImageGrid from "../Components/Common/ImageGrid";
import Lightbox from "../Components/Common/Lightbox";
import Avatar from "../Components/Common/Avatar";
import FilePreview from "../Components/Common/FilePreview";

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
  const groupUsers = location.state;
  const { id: channelIdParam } = useParams();
  const channelId = groupUsers?.id || channelIdParam;
  const senderId = userData?.userId;

  const [messages, setMessages] = useState([]);
  const [channelInfo, setChannelsInfo] = useState();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  // Pending attachments (issue #4 — multiple images at once). Stored as an
  // array of { file, previewUrl } so we can show inline thumbnails before
  // sending and revoke object URLs cleanly.
  const [pendingFiles, setPendingFiles] = useState([]);
  // Lightbox state for clicking a sent image. Holds an array of image URLs
  // and the index currently being viewed; null when closed.
  const [lightbox, setLightbox] = useState(null);
  const [modal, setModal] = useState(false);
    const [input, setInput] = useState("");
  const [inputSend, setInputSend] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loading, setloading] = useState(false);
  const [replyTarget, setReplyTarget] = useState(null);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [showPinned, setShowPinned] = useState(false);
  const [highlightedId, setHighlightedId] = useState(null);
  const [activeTab, setActiveTab] = useState(
    location?.state?.openTasks ? "tasks" : "chat"
  );
  const [createTaskModalSignal, setCreateTaskModalSignal] = useState(0);
  const [taskByNumber, setTaskByNumber] = useState({});
  const [taskActionLoading, setTaskActionLoading] = useState({});
  const [taskFocusNumber, setTaskFocusNumber] = useState("");
  const [taskFocusSignal, setTaskFocusSignal] = useState(0);

  // ----- New state for mentions, edit/delete, reports (features 3/4/5/6) -----
  const [mentionCandidates, setMentionCandidates] = useState([]);
  const [mentionTrigger, setMentionTrigger] = useState(null); // {from, to, query}
  const [highlightedMention, setHighlightedMention] = useState(0);
  const [pendingMentions, setPendingMentions] = useState([]); // ids to send with msg
  const [editingMessage, setEditingMessage] = useState(null); // msg being edited
  const [openMessageMenu, setOpenMessageMenu] = useState(null); // msg id
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
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
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
    } catch (error) {
      console.error("Error fetching tasks:", error);
    }
  }, [channelId, token]);

  // ----- Channel info load -----
  const fetchChannel = async () => {
    if (!channelId) return;
    try {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_API}/api/${channelId}`
      );
      const data = await response.json();
      setChannelsInfo(data);
    } catch (error) {
      console.error("Error fetching channel:", error);
    }
  };

  const fetchPinned = async () => {
    if (!channelId) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_API}/channels/${channelId}/pinned`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (data?.success) setPinnedMessages(data.pinned || []);
    } catch (_) {}
  };

  const handleTogglePin = async (msg) => {
    try {
      const token = localStorage.getItem("token");
      await axios.patch(
        `${import.meta.env.VITE_BACKEND_API}/channels/messages/${msg._id}/pin`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Optimistically refresh pinned list
      await fetchPinned();
      // Reflect on the message in the local list
      setMessages((prev) =>
        prev.map((m) =>
          m._id === msg._id ? { ...m, isPinned: !m.isPinned } : m
        )
      );
    } catch (err) {
      console.error("Pin failed:", err);
    }
  };

  useEffect(() => {
    fetchChannel();
  }, [channelId]);

  // ----- Messages load -----
  useEffect(() => {
    const fetchMessages = async () => {
      if (!channelId) return;
      try {
        const response = await fetch(
          `${import.meta.env.VITE_BACKEND_API}/channels/${channelId}`
        );
        const data = await response.json();
        setMessages(data?.messages || []);
      } catch (error) {
        console.error("Error fetching channel messages:", error);
      }
    };
    fetchMessages();
    fetchTaskIndex();
  }, [channelId, fetchTaskIndex]);

  // ----- Mark as read on open -----
  useEffect(() => {
    if (!channelId || !token) return;
    fetch(
      `${import.meta.env.VITE_BACKEND_API}/channels/${channelId}/read`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }
    ).catch(() => {});
  }, [channelId, token]);

  // ----- Mention candidate list (feature #4) -----
  useEffect(() => {
    if (!channelId || !token) return;
    const load = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_BACKEND_API}/channels/${channelId}/mention-candidates`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json().catch(() => ({}));
        if (data?.success) {
          setMentionCandidates(data.candidates || []);
        }
      } catch (e) {
        // ignore
      }
    };
    load();
  }, [channelId, token]);

  // Quick lookups
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

  // ----- Socket listeners -----
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

    // New: edit/delete updates from any client (feature #3 + #5).
    const onMsgUpdate = (updated) => {
      if (!updated?._id) return;
      if (updated?.channelId?.toString() !== channelId.toString()) return;
      setMessages((prev) =>
        prev.map((m) => (m._id === updated._id ? { ...m, ...updated } : m))
      );
    };
    socket.on("channel-message-updated", onMsgUpdate);

    // Monthly-report uploads (feature #6).
    const onReportUpdate = ({ channelId: incomingId }) => {
      if (incomingId?.toString() !== channelId.toString()) return;
      fetchReports();
    };
    socket.on("channel-report-updated", onReportUpdate);

    // Pin/unpin broadcasts so all clients update in real-time (fix #5).
    const onPinUpdate = ({ messageId, isPinned }) => {
      setMessages((prev) =>
        prev.map((m) => (m._id?.toString() === messageId?.toString() ? { ...m, isPinned } : m))
      );
      // Refresh the pinned banner.
      fetchPinned();
    };
    socket.on("channel-message-pinned", onPinUpdate);

    // Delete system message when report is deleted (fix #6b).
    const onMsgDeleted = ({ messageId }) => {
      if (!messageId) return;
      setMessages((prev) => prev.filter((m) => m._id?.toString() !== messageId?.toString()));
    };
    socket.on("channel-message-deleted", onMsgDeleted);

    // Fetch pinned messages for this channel.
    fetchPinned();

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
      socket.off("channel-message-updated", onMsgUpdate);
      socket.off("channel-report-updated", onReportUpdate);
      socket.off("channel-message-pinned", onPinUpdate);
      socket.off("channel-message-deleted", onMsgDeleted);
    };
  }, [channelId]);

  // ----- Scroll behaviour (kept from previous build) -----
  const scrollToLatestMessage = useCallback((behavior = "smooth") => {
    const list = messageListRef.current;
    if (list) {
      list.scrollTop = list.scrollHeight;
    }
    messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  const queueBottomScroll = useCallback(() => {
    forceBottomUntilRef.current = Date.now() + 1500;
    scrollToLatestMessage("auto");
    let nestedRaf = 0;
    const raf = requestAnimationFrame(() => {
      scrollToLatestMessage("auto");
      nestedRaf = requestAnimationFrame(() => scrollToLatestMessage("auto"));
    });
    const timerA = setTimeout(() => scrollToLatestMessage("auto"), 100);
    const timerB = setTimeout(() => scrollToLatestMessage("auto"), 260);
    const timerC = setTimeout(() => scrollToLatestMessage("auto"), 520);
    return () => {
      cancelAnimationFrame(raf);
      if (nestedRaf) cancelAnimationFrame(nestedRaf);
      clearTimeout(timerA);
      clearTimeout(timerB);
      clearTimeout(timerC);
    };
  }, [scrollToLatestMessage]);

  useEffect(() => {
    if (activeTab !== "chat") return;
    return queueBottomScroll();
  }, [activeTab, channelId, messages.length, queueBottomScroll]);

  // pendingFiles already carries previewUrl per attachment so we don't need
  // a separate effect to derive it. Cleanup of the object URLs happens when
  // the file is removed or the message is sent.
  useEffect(() => {
    return () => {
      pendingFiles.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- File upload to /files/upload -----
  const uploadFile = async (selectedFile) => {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", selectedFile);
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_BACKEND_API}/files/upload`,
        formData,
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
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

  // Send one message via the channels API. Returns the saved message or null.
  const postChannelMessage = async (
    messageContent,
    opts = {}
  ) => {
    const newMessage = {
      sender: senderId,
      channelId,
      message: messageContent,
      attachments: opts.attachments || [],
      replyTo: opts.replyTo || null,
      mentions: opts.mentions || [],
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
        return savedMessage;
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
    return null;
  };

  // ----- Send message (single message with text + multi-attachments) -----
  const handleSendMessage = async () => {
    if (loading || uploading) return;
    if (editingMessage) {
      // The same Send button confirms edits when in edit mode.
      return handleSubmitEdit();
    }
    const draftInput = input.trim();
    const filesToSend = [...pendingFiles];
    if (!draftInput && filesToSend.length === 0) return;

    const replyId = replyTarget?.id || null;
    const mentions = [...pendingMentions];
    setInput("");
    setMentionTrigger(null);
    setReplyTarget(null);
    setPendingMentions([]);
    setPendingFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (inputElRef.current) inputElRef.current.style.height = "auto";

    // Upload all attachments in parallel.
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
      if (attachmentUrls.length === 0 && !draftInput) {
        // All uploads failed; nothing to send.
        return;
      }
    }

    // Send a single combined message.
    await postChannelMessage(draftInput, {
      replyTo: replyId,
      mentions,
      attachments: attachmentUrls,
    });
  };

  // ----- Edit message (feature #5) -----
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

  // ----- Delete message (feature #3) -----
  const handleDeleteMessage = async (msg) => {
    if (!msg) return;
    if (String(msg.sender) !== String(senderId)) return;
    if (!isWithinEditWindow(msg.createdAt)) return;
    if (!window.confirm("Delete this message for everyone?")) return;
    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_API}/channels/messages/${msg._id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
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

  // ----- Mention picker (feature #4) -----
  const handleInputChange = (event) => {
    const value = event.target.value;
    setInput(value);
    const cursor = event.target.selectionStart ?? value.length;
    const trigger = detectMentionTrigger(value, cursor);
    setMentionTrigger(trigger);
    setHighlightedMention(0);

    // If the user fully removed an old mention, drop it from pendingMentions.
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

  // ----- Reports (feature #6) -----
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



  // ----- Channel delete (kept) -----
  const handleChannelDelete = async () => {
    if (!channelId) return;
    const ok = window.confirm("Delete this channel? This action cannot be undone.");
    if (!ok) return;
    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_API}/api/${channelId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error || "Could not delete channel");
        return;
      }
      navigate("/channels");
    } catch (err) {
      alert("Could not delete channel");
    }
  };

  // ----- Send invite (kept) -----
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

  // ----- Tasks integration (kept) -----
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
        setTaskByNumber((curr) => ({
          ...curr,
          [taskNumber]: data.task,
        }));
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
  
  // Renders the message body — tokenizing mentions for highlight + handling
  // attachments (FilePreview), tombstones, and edited markers.
  const renderMessageBody = (msg, isSelf) => {
    if (msg.isDeleted) {
      return (
        <span className="italic text-slate-500 text-[13px]">
          This message was deleted
        </span>
      );
    }
    const value = msg.message;
    if (isImage(value)) {
      return <FilePreview url={value} />;
    }
    if (isLikelyAttachment(value)) {
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
        {tokens.map((t, idx) => {
          if (t.type === "mention") {
            return (
              <span
                key={idx}
                className="bg-orange-100 text-orange-700 rounded px-1 font-medium"
              >
                @{t.value}
              </span>
            );
          }
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

  if (!channelId) {
    return (
      <div className="p-4 text-sm text-gray-500">
        Channel not found. Please open it from the channel list.
      </div>
    );
  }

  return (
    <>
    <div className="w-full flex flex-col h-[100dvh] md:h-[calc(100vh-110px)] lg:h-[calc(100vh-80px)] bg-white">
      {/* Slack-style channel header */}
      <div className="slack-topbar px-3 lg:px-6 py-2.5">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar
            src={channelImage}
            name={channelDisplayName}
            size={36}
            rounded="rounded-md"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[15px] font-bold text-ink truncate">
                <span className="text-ink-muted mr-0.5">#</span>
                {channelDisplayName.charAt(0).toUpperCase() + channelDisplayName.slice(1)}
              </h2>
              <span
                className={`slack-badge ${
                  channelStatus === "Active"
                    ? "slack-badge-confirm"
                    : channelStatus === "Paused"
                    ? "slack-badge-warn"
                    : channelStatus === "Closed"
                    ? "slack-badge-danger"
                    : "slack-badge-neutral"
                }`}
              >
                {channelStatus}
              </span>
              {channelTags.map((t) => (
                <span key={t} className="slack-badge slack-badge-info">
                  {t}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-3 text-[12px] text-ink-muted truncate">
              {channelDescription && (
                <span className="truncate" title={channelDescription}>
                  {channelDescription}
                </span>
              )}
              <span className="flex items-center gap-1 shrink-0">
                <IoPeopleSharp className="text-[14px]" />
                {channelInfo?.members?.length ?? 0}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md bg-surface-muted p-0.5">
            {["chat", "tasks", "reports", "about"].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 text-[13px] font-medium rounded ${
                  activeTab === tab
                    ? "bg-white text-ink shadow-card"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setCreateTaskModalSignal((p) => p + 1)}
            className="slack-btn-brand !py-1.5 !text-[13px]"
          >
            + Task
          </button>

          <div className="relative flex items-center gap-1 shrink-0">            <button
              type="button"
              onClick={handleShare}
              className="p-1.5 rounded text-ink-muted hover:text-ink hover:bg-surface-muted"
              title="Share / invite"
            >
              <IoMdShareAlt />
            </button>
            </div>
          </div>

        </div>

      {/* Share / invite popover — rendered outside the topbar flow so it's never hidden */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-start justify-end pt-16 pr-4 pointer-events-none">
          <div className="pointer-events-auto relative space-y-3 bg-white px-3 pb-4 pt-3 rounded-lg shadow-lg w-72 max-w-[90vw] border border-surface-divider">
            <button
              className="absolute top-1 right-1 text-xl px-2 text-ink-muted hover:text-ink"
              onClick={(e) => { e.stopPropagation(); setModal(false); }}
            >
              &times;
            </button>
                  <p className="text-[11px] font-semibold text-gray-600">Invite by email</p>
                  <input
                    name="email"
                    type="email"
                    placeholder="single email…"
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
                    Send single invite
                  </button>                </div>
          </div>
      )}

      
      {/* ===== Reports tab - download only ===== */}
      {activeTab === "reports" && (
        <div className="flex-1 overflow-y-auto px-3 lg:px-6 pb-4">
          <h3 className="text-sm font-semibold text-ink mb-3">Monthly Task Reports</h3>
          {reportsLoading ? (
            <p className="text-xs text-ink-muted">Loading…</p>
          ) : reports.length === 0 ? (
            <p className="text-xs text-ink-muted">No reports yet.</p>
          ) : (
            <ul className="divide-y border rounded overflow-hidden">
              {reports.map((r) => {
                const monthLabel = monthLabels[r.month - 1] || r.month;
                return (
                  <li key={r._id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs bg-white">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{r.title || `${monthLabel} ${r.year} report`}</p>
                      <p className="text-[11px] text-ink-muted truncate">{r.fileName}{r.note ? ` • ${r.note}` : ""}</p>
                      <p className="text-[10px] text-ink-faint">{moment(r.createdAt).format("DD MMM YYYY, HH:mm")}</p>
                    </div>
                    <button type="button" onClick={() => downloadFile(r.fileUrl, r.fileName)} className="slack-btn-confirm !py-1 !text-xs">Download</button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* ===== About tab (feature #7) ===== */}
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
            <div className="mt-4">            </div>
          </div>
        </div>
      )}

      {/* ===== Chat tab ===== */}
      {activeTab === "chat" && (
        <>
          {/* Pinned messages banner — WhatsApp style (fix #5) */}
          {pinnedMessages.length > 0 && (
            <div className="px-3 lg:px-6 border-b border-surface-divider bg-surface-subtle">
              <button
                type="button"
                onClick={() => setShowPinned((v) => !v)}
                className="flex items-center justify-between w-full py-1.5 text-[12px] text-ink-muted hover:text-ink"
              >
                <span className="flex items-center gap-1.5 font-semibold">
                  <BsPinFill size={11} className="text-brand-yellow" />
                  {pinnedMessages.length} pinned message{pinnedMessages.length !== 1 ? "s" : ""}
                </span>
                <span>{showPinned ? "▲ Hide" : "▼ Show"}</span>
              </button>
              {showPinned && (
                <ul className="pb-2 space-y-1">
                  {pinnedMessages.map((pm) => (
                    <li
                      key={pm._id}
                      className="flex items-start gap-2 rounded-md bg-white border border-surface-divider px-2.5 py-1.5 text-[12px]"
                    >
                      <BsPinFill size={11} className="text-brand-yellow mt-0.5 shrink-0" />
                      <span className="flex-1 min-w-0 text-ink line-clamp-2">
                        {pm.message || "[attachment]"}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleTogglePin(pm)}
                        className="shrink-0 text-ink-faint hover:text-red-500 text-xs"
                        title="Unpin"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

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
                  <div className="flex items-start gap-2 mb-0.5 px-2">
                    <Avatar
                      name={senderLabel}
                      src={
                        isSelf
                          ? memberById[String(senderId)]?.avatar || ""
                          : senderEntity?.avatar || ""
                      }
                      size={36}
                      rounded="rounded-md"
                    />
                    <div
                      ref={(el) => {
                        if (msg?._id && el) messageRefs.current[msg._id] = el;
                      }}
                      className={`group relative flex flex-col gap-1 px-2 py-1 rounded-md w-full max-w-full
                        ${
                          msg.isDeleted
                            ? "text-ink-faint italic"
                            : "text-ink"
                        }
                        ${highlightedId === msg._id ? "bg-yellow-50" : "hover:bg-surface-muted"}
                      `}
                    >
                      <div className="flex items-baseline gap-2">
                        <span
                          className="text-[14px] font-bold text-ink truncate max-w-[200px]"
                          title={senderLabel}
                        >
                          {senderLabel}
                        </span>
                        <span className="text-chat-meta text-ink-faint">
                          {moment(msg.createdAt).calendar(null, {
                            sameDay: "[Today at] h:mm A",
                            lastDay: "[Yesterday at] h:mm A",
                            lastWeek: "ddd [at] h:mm A",
                            sameElse: "MMM D [at] h:mm A",
                          })}
                        </span>
                        <div className="ml-auto flex items-center gap-1">
                          {!msg.isDeleted && (
                            <button
                              type="button"
                              onClick={() => handleReplySelect(msg)}
                              className="text-ink-faint hover:text-ink opacity-0 group-hover:opacity-100"
                              title="Reply"
                            >
                              <CornerUpLeft className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {!msg.isDeleted && (
                            <button
                              type="button"
                              onClick={() => handleTogglePin(msg)}
                              className={`opacity-0 group-hover:opacity-100 ${msg.isPinned ? "text-brand-yellow opacity-100" : "text-ink-faint hover:text-ink"}`}
                              title={msg.isPinned ? "Unpin" : "Pin message"}
                            >
                              {msg.isPinned ? <BsPinFill size={13} /> : <BsPin size={13} />}
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
                              className="text-ink-faint hover:text-ink opacity-0 group-hover:opacity-100"
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

                      {/* Attachments grid (issue #4 — Slack/WhatsApp style).
                          When present, the grid renders above any caption text
                          carried in `msg.message`. Pure-image attachments use
                          ImageGrid + Lightbox; non-image attachments fall
                          through to FilePreview chips. */}
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

                      {/* Caption text (or legacy single-URL messages). When a
                          message has only attachments and no text, this
                          renders nothing. */}
                      {!(
                        Array.isArray(msg.attachments) &&
                        msg.attachments.length > 0 &&
                        !msg.message
                      ) && renderMessageBody(msg, isSelf)}

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

                      {msg.editedAt && !msg.isDeleted && (
                        <span className="text-chat-meta text-ink-faint italic ml-0.5">(edited)</span>
                      )}
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

          {/* Composer */}
          <div className="px-3 lg:px-6 py-3 bg-white border-t border-surface-divider w-full sticky bottom-0 left-0 right-0 z-10">
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
                          <MdInsertDriveFile className="mx-auto text-gray-500 text-lg" />
                          <p className="text-[8px] text-gray-600 truncate w-full">
                            {p.file.name.split(".").pop()?.toUpperCase()}
                          </p>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setPendingFiles((curr) => {
                            const next = curr.filter((_, i) => i !== idx);
                            // Free the removed preview URL
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
                multiple
                onChange={(e) => {
                  const picked = Array.from(e.target.files || []);
                  if (picked.length === 0) return;
                  setPendingFiles((curr) => [
                    ...curr,
                    ...picked.map((f) => ({
                      file: f,
                      // Generate a local preview URL only for images so the
                      // composer thumbnail row matches what'll be sent.
                      previewUrl: f.type?.startsWith("image/")
                        ? URL.createObjectURL(f)
                        : "",
                    })),
                  ]);
                  // Allow re-selecting the same file later by clearing the input.
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

              <div className="flex-1 relative">
                <textarea
                  ref={inputElRef}
                  rows={1}
                  className="w-full p-2 border rounded-lg outline-none text-[15px] resize-none max-h-40 overflow-y-auto"
                  placeholder={
                    editingMessage
                      ? "Edit message…"
                      : "Type a message… use @ to mention (Shift/Alt+Enter for new line)"
                  }
                  value={input}
                  onChange={(e) => {
                    handleInputChange(e);
                    // Auto-grow up to ~6 lines, then scroll
                    const ta = e.target;
                    ta.style.height = "auto";
                    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
                  }}
                  onPaste={(e) => {
                    // Preserve original line breaks from pasted content. The
                    // browser does this for us in textarea; we just have to
                    // re-grow after the paste lands.
                    requestAnimationFrame(() => {
                      const ta = inputElRef.current;
                      if (ta) {
                        ta.style.height = "auto";
                        ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
                      }
                    });
                  }}
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
                        // Tab always picks; Enter picks unless modifier held.
                        if (e.key === "Tab" || (!e.shiftKey && !e.altKey)) {
                          e.preventDefault();
                          handlePickMention(
                            filteredMentionList[highlightedMention] ||
                              filteredMentionList[0]
                          );
                          return;
                        }
                      }
                      if (e.key === "Escape") {
                        setMentionTrigger(null);
                        return;
                      }
                    }
                    // Enter alone → send. Shift+Enter or Alt+Enter → newline.
                    if (e.key === "Enter" && !e.shiftKey && !e.altKey) {
                      e.preventDefault();
                      handleSendMessage();
                      // Reset height after send
                      requestAnimationFrame(() => {
                        if (inputElRef.current) {
                          inputElRef.current.style.height = "auto";
                        }
                      });
                    }
                  }}
                  disabled={isSending}
                />
                {/* Mention picker popover */}
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

      {lightbox && (
        <Lightbox
          urls={lightbox.urls}
          startIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
    </>
  );
};

export default ChannelChat;
