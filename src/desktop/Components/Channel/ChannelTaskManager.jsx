import { useEffect, useMemo, useRef, useState } from "react";
import moment from "moment";
import { onSoftRefresh } from "../../../utils/socket";
import { downloadFile, getFileNameFromUrl } from "../../../utils/helper";

const STATUS_OPTIONS = ["Assigned", "Acknowledged", "Completed"];
const PRIORITY_OPTIONS = ["Low", "Medium", "High", "Urgent"];
const MAX_TASK_ATTACHMENTS = 15;
const MAX_TASK_COMMENT_LENGTH = 2000;
const MAX_TASK_TAGS = 20;
const MAX_TASK_TAG_LENGTH = 40;
const MAX_REMINDER_RULE_ENTRIES = 10;
const DEFAULT_REMINDER_MINUTES = [1440, 60];
const DEFAULT_REMINDER_MINUTES_INPUT = "1440, 60";
const REMINDER_PRESET_OPTIONS = [10080, 4320, 2880, 1440, 720, 240, 120, 60, 30];
const DEFAULT_ESCALATION_MINUTES_AFTER_DUE = 120;
const MAX_ESCALATION_MINUTES_AFTER_DUE = 60 * 24 * 30;
const ESCALATION_PRESET_OPTIONS = [30, 60, 120, 240, 720, 1440, 2880];

const toInputDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
};

const normalizeMonthLabel = (value) => {
  if (!value) return "No Deadline";
  const date = moment(value);
  if (!date.isValid()) return "No Deadline";
  return date.format("MMMM YYYY");
};

const getAttachmentType = (attachment = {}) => {
  const mime = (attachment.mimeType || "").toLowerCase();
  const name = (attachment.name || getFileNameFromUrl(attachment.url || "")).toLowerCase();
  const extension = name.split(".").pop() || "";

  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(extension)) {
    return "image";
  }
  if (mime.startsWith("video/") || ["mp4", "webm", "mov", "mkv", "avi"].includes(extension)) {
    return "video";
  }
  if (mime.startsWith("audio/") || ["mp3", "wav", "ogg", "m4a", "aac"].includes(extension)) {
    return "audio";
  }
  if (mime.includes("pdf") || extension === "pdf") {
    return "pdf";
  }
  return "file";
};

const formatAttachmentSize = (size = 0) => {
  const bytes = Number(size);
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const normalizeTaskTags = (rawInput = "") => {
  const rawTags = (rawInput || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  return {
    rawCount: rawTags.length,
    tags: [...new Set(rawTags.map((tag) => tag.slice(0, MAX_TASK_TAG_LENGTH)))],
  };
};

const getPriorityBadgeClass = (priority = "Medium") => {
  if (priority === "Urgent") return "bg-red-100 text-red-700";
  if (priority === "High") return "bg-orange-100 text-orange-700";
  if (priority === "Low") return "bg-emerald-100 text-emerald-700";
  return "bg-slate-100 text-slate-700";
};

const normalizeReminderMinutesInput = (rawValue = "") => {
  const parsed = (rawValue || "")
    .split(",")
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isFinite(value) && value > 0)
    .map((value) => Math.min(value, MAX_ESCALATION_MINUTES_AFTER_DUE));
  const unique = [...new Set(parsed)].slice(0, MAX_REMINDER_RULE_ENTRIES);
  return unique.sort((a, b) => b - a);
};

const formatRuleMinutesLabel = (minutes = 0) => {
  if (!Number.isFinite(minutes) || minutes <= 0) return "";
  if (minutes % (24 * 60) === 0) {
    const days = minutes / (24 * 60);
    return days === 1 ? "1d" : `${days}d`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? "1h" : `${hours}h`;
  }
  return `${minutes}m`;
};

const formatRuleMinutesReadable = (minutes = 0) => {
  if (!Number.isFinite(minutes) || minutes <= 0) return "";
  if (minutes % (24 * 60) === 0) {
    const days = minutes / (24 * 60);
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  return `${minutes} min${minutes === 1 ? "" : "s"}`;
};

const toReminderInputValue = (minutes = []) => {
  const normalized = normalizeReminderMinutesInput((minutes || []).join(", "));
  return normalized.join(", ");
};

const toggleReminderMinuteValue = (rawInput = "", minute = 0, shouldSelect = false) => {
  const current = normalizeReminderMinutesInput(rawInput);
  const next = shouldSelect
    ? [...current, minute]
    : current.filter((value) => value !== minute);
  return toReminderInputValue(next);
};

const buildEscalationOptions = (rawValue = DEFAULT_ESCALATION_MINUTES_AFTER_DUE) => {
  const baseOptions = [...ESCALATION_PRESET_OPTIONS];
  const parsedValue = Number.parseInt(rawValue, 10);
  if (Number.isFinite(parsedValue) && parsedValue > 0 && !baseOptions.includes(parsedValue)) {
    baseOptions.push(parsedValue);
  }
  return [...new Set(baseOptions)].sort((a, b) => a - b);
};

const getActivityActionClass = (action = "") => {
  const normalized = action.toUpperCase();
  if (normalized.includes("OVERDUE")) return "bg-red-100 text-red-700";
  if (normalized.includes("ESCALAT")) return "bg-red-100 text-red-700";
  if (normalized.includes("REMINDER")) return "bg-amber-100 text-amber-700";
  if (normalized.includes("COMPLETED")) return "bg-green-100 text-green-700";
  if (normalized.includes("COMMENT")) return "bg-purple-100 text-purple-700";
  if (normalized.includes("ASSIGNED")) return "bg-blue-100 text-blue-700";
  return "bg-slate-100 text-slate-700";
};

const formatActivityActionLabel = (action = "") => {
  if (!action) return "Task Updated";
  return action
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const ChannelTaskManager = ({
  channelId,
  channelName,
  channelMembers = [],
  currentUserId,
  showList = true,
  openCreateTaskSignal = 0,
  focusTaskNumber = "",
  focusTaskSignal = 0,
}) => {
  const token = localStorage.getItem("token");
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState(null);
  const [deletingTaskId, setDeletingTaskId] = useState(null);
  const [error, setError] = useState("");
  const [collapsedMonths, setCollapsedMonths] = useState({});
  const [highlightTaskNumber, setHighlightTaskNumber] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    status: "",
    month: "",
    assignedTo: "",
    priority: "",
    tag: "",
  });
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    deadline: "",
    assignedTo: "",
    priority: "Medium",
    tagsInput: "",
    remindersEnabled: true,
    reminderMinutesInput: DEFAULT_REMINDER_MINUTES_INPUT,
    escalationEnabled: true,
    escalationMinutesAfterDue: DEFAULT_ESCALATION_MINUTES_AFTER_DUE,
    attachments: [],
  });
  const [editTask, setEditTask] = useState({
    id: "",
    taskNumber: "",
    title: "",
    description: "",
    priority: "Medium",
    tagsInput: "",
    remindersEnabled: true,
    reminderMinutesInput: DEFAULT_REMINDER_MINUTES_INPUT,
    escalationEnabled: true,
    escalationMinutesAfterDue: DEFAULT_ESCALATION_MINUTES_AFTER_DUE,
    attachments: [],
  });
  const [isUploadingCreateAttachments, setIsUploadingCreateAttachments] = useState(false);
  const [isUploadingEditAttachments, setIsUploadingEditAttachments] = useState(false);
  const [commentDraftByTask, setCommentDraftByTask] = useState({});
  const [commentMentionsByTask, setCommentMentionsByTask] = useState({});
  const [submittingCommentTaskId, setSubmittingCommentTaskId] = useState(null);
  const [taskViewMode, setTaskViewMode] = useState("compact");
  const [openTaskDetailsById, setOpenTaskDetailsById] = useState({});
  const [openQuickEditById, setOpenQuickEditById] = useState({});
  const [taskDrawer, setTaskDrawer] = useState({
    open: false,
    taskId: "",
    tab: "comments",
  });
  const lastOpenTaskSignalRef = useRef(0);

  const memberOptions = useMemo(
    () =>
      (channelMembers || [])
        .filter((member) => member?._id)
        .map((member) => ({ id: member._id, name: member.name || "Unknown" })),
    [channelMembers]
  );

  const memberNameMap = useMemo(() => {
    const map = {};
    memberOptions.forEach((member) => {
      map[member.id.toString()] = member.name;
    });
    return map;
  }, [memberOptions]);

  const memberLookupByName = useMemo(() => {
    const lookup = {};
    memberOptions.forEach((member) => {
      const key = (member.name || "").trim().toLowerCase();
      if (!key || lookup[key]) return;
      lookup[key] = member.id;
    });
    return lookup;
  }, [memberOptions]);

  const newTaskReminderMinutes = useMemo(
    () => normalizeReminderMinutesInput(newTask.reminderMinutesInput),
    [newTask.reminderMinutesInput]
  );

  const editTaskReminderMinutes = useMemo(
    () => normalizeReminderMinutesInput(editTask.reminderMinutesInput),
    [editTask.reminderMinutesInput]
  );

  const newTaskEscalationOptions = useMemo(
    () => buildEscalationOptions(newTask.escalationMinutesAfterDue),
    [newTask.escalationMinutesAfterDue]
  );

  const editTaskEscalationOptions = useMemo(
    () => buildEscalationOptions(editTask.escalationMinutesAfterDue),
    [editTask.escalationMinutesAfterDue]
  );

  const selectedDrawerTask = useMemo(() => {
    if (!taskDrawer.taskId) return null;
    return tasks.find((task) => task?._id === taskDrawer.taskId) || null;
  }, [tasks, taskDrawer.taskId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setSearchInput("");
    setSearch("");
    setFilters({
      status: "",
      month: "",
      assignedTo: "",
      priority: "",
      tag: "",
    });
    setCollapsedMonths({});
    setHighlightTaskNumber("");
    setIsCreateModalOpen(false);
    setIsEditModalOpen(false);
    setIsUploadingCreateAttachments(false);
    setIsUploadingEditAttachments(false);
    setDeletingTaskId(null);
    setCommentDraftByTask({});
    setCommentMentionsByTask({});
    setSubmittingCommentTaskId(null);
    setTaskViewMode("compact");
    setOpenTaskDetailsById({});
    setOpenQuickEditById({});
    setTaskDrawer({
      open: false,
      taskId: "",
      tab: "comments",
    });
    setNewTask({
      title: "",
      description: "",
      deadline: "",
      assignedTo: "",
      priority: "Medium",
      tagsInput: "",
      remindersEnabled: true,
      reminderMinutesInput: DEFAULT_REMINDER_MINUTES_INPUT,
      escalationEnabled: true,
      escalationMinutesAfterDue: DEFAULT_ESCALATION_MINUTES_AFTER_DUE,
      attachments: [],
    });
    setEditTask({
      id: "",
      taskNumber: "",
      title: "",
      description: "",
      priority: "Medium",
      tagsInput: "",
      remindersEnabled: true,
      reminderMinutesInput: DEFAULT_REMINDER_MINUTES_INPUT,
      escalationEnabled: true,
      escalationMinutesAfterDue: DEFAULT_ESCALATION_MINUTES_AFTER_DUE,
      attachments: [],
    });
    setError("");
  }, [channelId]);

  useEffect(() => {
    if (
      channelId &&
      openCreateTaskSignal > 0 &&
      openCreateTaskSignal !== lastOpenTaskSignalRef.current
    ) {
      setError("");
      setIsCreateModalOpen(true);
    }
    lastOpenTaskSignalRef.current = openCreateTaskSignal;
  }, [openCreateTaskSignal, channelId]);

  useEffect(() => {
    const normalizedTaskNumber = (focusTaskNumber || "").trim().toUpperCase();
    if (!normalizedTaskNumber) return undefined;
    setSearchInput(normalizedTaskNumber);
    setSearch(normalizedTaskNumber);
    setCollapsedMonths({});
    setHighlightTaskNumber(normalizedTaskNumber);
    const timer = setTimeout(() => {
      setHighlightTaskNumber((current) =>
        current === normalizedTaskNumber ? "" : current
      );
    }, 1800);
    return () => clearTimeout(timer);
  }, [focusTaskNumber, focusTaskSignal]);

  useEffect(() => {
    if (taskDrawer.open && !selectedDrawerTask) {
      setTaskDrawer({ open: false, taskId: "", tab: "comments" });
    }
  }, [taskDrawer.open, selectedDrawerTask]);

  const fetchTasks = async () => {
    if (!channelId || !token) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (filters.status) params.append("status", filters.status);
      if (filters.month) params.append("month", filters.month);
      if (filters.assignedTo) params.append("assignedTo", filters.assignedTo);
      if (filters.priority) params.append("priority", filters.priority);
      if (filters.tag) params.append("tag", filters.tag);

      const query = params.toString();
      const endpoint = `${import.meta.env.VITE_BACKEND_API}/channels/${channelId}/tasks${
        query ? `?${query}` : ""
      }`;

      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setTasks([]);
        setError(data?.message || "Unable to load tasks.");
        return;
      }
      setTasks(data?.tasks || []);
    } catch (fetchError) {
      setTasks([]);
      setError("Unable to load tasks.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!showList) return;
    fetchTasks();
  }, [
    showList,
    channelId,
    search,
    filters.status,
    filters.month,
    filters.assignedTo,
    filters.priority,
    filters.tag,
  ]);

  useEffect(() => {
    if (!showList) return;
    const unsubscribe = onSoftRefresh((payload) => {
      if (payload?.type === "TASK") {
        fetchTasks();
      }
    });
    return () => unsubscribe();
  }, [
    showList,
    channelId,
    search,
    filters.status,
    filters.month,
    filters.assignedTo,
    filters.priority,
    filters.tag,
  ]);

  useEffect(() => {
    if (!memberOptions.length) return;
    setNewTask((prev) => {
      if (prev.assignedTo) return prev;
      return { ...prev, assignedTo: memberOptions[0].id };
    });
  }, [memberOptions]);

  const resetFilters = () => {
    setSearchInput("");
    setSearch("");
    setFilters({
      status: "",
      month: "",
      assignedTo: "",
      priority: "",
      tag: "",
    });
  };

  const closeCreateModal = () => {
    if (saving || isUploadingCreateAttachments) return;
    setIsCreateModalOpen(false);
    setError("");
  };

  const openCreateModal = () => {
    setError("");
    setIsCreateModalOpen(true);
  };

  const uploadSingleTaskFile = async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${import.meta.env.VITE_BACKEND_API}/files/upload`, {
      method: "POST",
      body: formData,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.fileUrl) {
      throw new Error(data?.message || "File upload failed");
    }

    return {
      url: data.fileUrl,
      name: data.originalName || file.name || getFileNameFromUrl(data.fileUrl),
      mimeType: file.type || "",
      size: Number(file.size) || 0,
    };
  };

  const handleCreateAttachmentUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;

    const remainingSlots = MAX_TASK_ATTACHMENTS - (newTask.attachments?.length || 0);
    if (remainingSlots <= 0) {
      setError(`You can attach up to ${MAX_TASK_ATTACHMENTS} files per task.`);
      return;
    }

    const selectedFiles = files.slice(0, remainingSlots);
    setIsUploadingCreateAttachments(true);
    setError("");

    try {
      const uploadedAttachments = await Promise.all(
        selectedFiles.map((file) => uploadSingleTaskFile(file))
      );
      setNewTask((prev) => ({
        ...prev,
        attachments: [...(prev.attachments || []), ...uploadedAttachments],
      }));
    } catch (uploadError) {
      setError(uploadError?.message || "Unable to upload attachment.");
    } finally {
      setIsUploadingCreateAttachments(false);
    }
  };

  const handleEditAttachmentUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;

    const remainingSlots = MAX_TASK_ATTACHMENTS - (editTask.attachments?.length || 0);
    if (remainingSlots <= 0) {
      setError(`You can attach up to ${MAX_TASK_ATTACHMENTS} files per task.`);
      return;
    }

    const selectedFiles = files.slice(0, remainingSlots);
    setIsUploadingEditAttachments(true);
    setError("");

    try {
      const uploadedAttachments = await Promise.all(
        selectedFiles.map((file) => uploadSingleTaskFile(file))
      );
      setEditTask((prev) => ({
        ...prev,
        attachments: [...(prev.attachments || []), ...uploadedAttachments],
      }));
    } catch (uploadError) {
      setError(uploadError?.message || "Unable to upload attachment.");
    } finally {
      setIsUploadingEditAttachments(false);
    }
  };

  const removeCreateAttachment = (indexToRemove) => {
    setNewTask((prev) => ({
      ...prev,
      attachments: (prev.attachments || []).filter((_, index) => index !== indexToRemove),
    }));
  };

  const removeEditAttachment = (indexToRemove) => {
    setEditTask((prev) => ({
      ...prev,
      attachments: (prev.attachments || []).filter((_, index) => index !== indexToRemove),
    }));
  };

  const openEditModal = (task) => {
    if (!task?._id) return;
    setError("");
    const reminderRules = task.reminderRules || {};
    const escalationRules = task.escalationRules || {};
    const reminderMinutes = Array.isArray(reminderRules.minutesBefore)
      ? reminderRules.minutesBefore
      : DEFAULT_REMINDER_MINUTES;
    setEditTask({
      id: task._id,
      taskNumber: task.taskNumber || "",
      title: task.title || "",
      description: task.description || "",
      priority: task.priority || "Medium",
      tagsInput: Array.isArray(task.tags) ? task.tags.join(", ") : "",
      remindersEnabled: reminderRules.enabled !== false,
      reminderMinutesInput:
        reminderMinutes.length > 0
          ? toReminderInputValue(reminderMinutes)
          : DEFAULT_REMINDER_MINUTES_INPUT,
      escalationEnabled: escalationRules.enabled !== false,
      escalationMinutesAfterDue:
        Number.parseInt(escalationRules.minutesAfterDue, 10) ||
        DEFAULT_ESCALATION_MINUTES_AFTER_DUE,
      attachments: Array.isArray(task.attachments) ? task.attachments : [],
    });
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    if (updatingTaskId === editTask.id || isUploadingEditAttachments) return;
    setIsEditModalOpen(false);
    setError("");
  };

  const handleCreateTask = async () => {
    if (!newTask.title.trim() || !newTask.deadline || !newTask.assignedTo) {
      setError("Title, deadline and assignee are required.");
      return;
    }
    const { rawCount: rawTagCount, tags: normalizedTags } = normalizeTaskTags(newTask.tagsInput);
    if (rawTagCount > MAX_TASK_TAGS) {
      setError(`You can add up to ${MAX_TASK_TAGS} tags.`);
      return;
    }
    const reminderMinutes = newTaskReminderMinutes;
    if (newTask.remindersEnabled && reminderMinutes.length === 0) {
      setError("Select at least one reminder time.");
      return;
    }
    const parsedEscalationMinutes = Number.parseInt(newTask.escalationMinutesAfterDue, 10);
    if (
      newTask.escalationEnabled &&
      (!Number.isFinite(parsedEscalationMinutes) || parsedEscalationMinutes <= 0)
    ) {
      setError("Escalation delay must be a positive number.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        title: newTask.title.trim(),
        description: newTask.description.trim(),
        deadline: new Date(newTask.deadline).toISOString(),
        assignedTo: newTask.assignedTo,
        priority: newTask.priority || "Medium",
        tags: normalizedTags,
        reminderRules: {
          enabled: !!newTask.remindersEnabled,
          minutesBefore: reminderMinutes,
        },
        escalationRules: {
          enabled: !!newTask.escalationEnabled,
          minutesAfterDue:
            Number.isFinite(parsedEscalationMinutes) && parsedEscalationMinutes > 0
              ? Math.min(parsedEscalationMinutes, MAX_ESCALATION_MINUTES_AFTER_DUE)
              : DEFAULT_ESCALATION_MINUTES_AFTER_DUE,
        },
        attachments: newTask.attachments || [],
      };
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_API}/channels/${channelId}/tasks`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.message || "Unable to create task.");
        return;
      }

      setNewTask((prev) => ({
        title: "",
        description: "",
        deadline: "",
        assignedTo: prev.assignedTo,
        priority: prev.priority || "Medium",
        tagsInput: "",
        remindersEnabled: prev.remindersEnabled,
        reminderMinutesInput: prev.reminderMinutesInput || DEFAULT_REMINDER_MINUTES_INPUT,
        escalationEnabled: prev.escalationEnabled,
        escalationMinutesAfterDue:
          prev.escalationMinutesAfterDue || DEFAULT_ESCALATION_MINUTES_AFTER_DUE,
        attachments: [],
      }));
      setIsCreateModalOpen(false);
      if (showList) {
        fetchTasks();
      }
    } catch (createError) {
      setError("Unable to create task.");
    } finally {
      setSaving(false);
    }
  };

  const patchTask = async (taskId, payload) => {
    if (!taskId) return false;
    setUpdatingTaskId(taskId);
    setError("");
    try {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_API}/channels/${channelId}/tasks/${taskId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.message || "Unable to update task.");
        return false;
      }
      fetchTasks();
      return true;
    } catch (patchError) {
      setError("Unable to update task.");
      return false;
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const handleDeleteTask = async (task) => {
    if (!task?._id) return;
    const taskLabel = task.taskNumber || task.title || "this task";
    const shouldDelete = window.confirm(
      `Delete ${taskLabel}?\n\nThis action cannot be undone.`
    );
    if (!shouldDelete) return;

    setDeletingTaskId(task._id);
    setError("");

    try {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_API}/channels/${channelId}/tasks/${task._id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.message || "Unable to delete task.");
        return;
      }

      if (taskDrawer.open && taskDrawer.taskId === task._id) {
        setTaskDrawer({ open: false, taskId: "", tab: "comments" });
      }
      if (isEditModalOpen && editTask.id === task._id) {
        setIsEditModalOpen(false);
      }
      setOpenTaskDetailsById((prev) => {
        const next = { ...prev };
        delete next[task._id];
        return next;
      });
      setOpenQuickEditById((prev) => {
        const next = { ...prev };
        delete next[task._id];
        return next;
      });
      setCommentDraftByTask((prev) => {
        const next = { ...prev };
        delete next[task._id];
        return next;
      });
      setCommentMentionsByTask((prev) => {
        const next = { ...prev };
        delete next[task._id];
        return next;
      });

      fetchTasks();
    } catch (deleteError) {
      setError("Unable to delete task.");
    } finally {
      setDeletingTaskId(null);
    }
  };

  const handleEditTaskSave = async () => {
    const trimmedTitle = editTask.title.trim();
    if (!trimmedTitle) {
      setError("Task title is required.");
      return;
    }
    const { rawCount: rawTagCount, tags: normalizedTags } = normalizeTaskTags(editTask.tagsInput);
    if (rawTagCount > MAX_TASK_TAGS) {
      setError(`You can add up to ${MAX_TASK_TAGS} tags.`);
      return;
    }
    const reminderMinutes = editTaskReminderMinutes;
    if (editTask.remindersEnabled && reminderMinutes.length === 0) {
      setError("Select at least one reminder time.");
      return;
    }
    const parsedEscalationMinutes = Number.parseInt(editTask.escalationMinutesAfterDue, 10);
    if (
      editTask.escalationEnabled &&
      (!Number.isFinite(parsedEscalationMinutes) || parsedEscalationMinutes <= 0)
    ) {
      setError("Escalation delay must be a positive number.");
      return;
    }

    const success = await patchTask(editTask.id, {
      title: trimmedTitle,
      description: editTask.description.trim(),
      priority: editTask.priority || "Medium",
      tags: normalizedTags,
      reminderRules: {
        enabled: !!editTask.remindersEnabled,
        minutesBefore: reminderMinutes,
      },
      escalationRules: {
        enabled: !!editTask.escalationEnabled,
        minutesAfterDue:
          Number.isFinite(parsedEscalationMinutes) && parsedEscalationMinutes > 0
            ? Math.min(parsedEscalationMinutes, MAX_ESCALATION_MINUTES_AFTER_DUE)
            : DEFAULT_ESCALATION_MINUTES_AFTER_DUE,
      },
      attachments: editTask.attachments || [],
    });

    if (success) {
      setIsEditModalOpen(false);
    }
  };

  const groupedTasks = useMemo(() => {
    const groups = {};
    tasks.forEach((task) => {
      const key = moment(task.deadline).isValid()
        ? moment(task.deadline).format("YYYY-MM")
        : "no-deadline";
      if (!groups[key]) groups[key] = [];
      groups[key].push(task);
    });
    return groups;
  }, [tasks]);

  const sortedGroupKeys = useMemo(() => {
    return Object.keys(groupedTasks).sort((a, b) => {
      if (a === "no-deadline") return 1;
      if (b === "no-deadline") return -1;
      return b.localeCompare(a);
    });
  }, [groupedTasks]);

  const toggleMonth = (key) => {
    setCollapsedMonths((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleTaskDetails = (taskId) => {
    if (!taskId) return;
    setOpenTaskDetailsById((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const toggleQuickEdit = (taskId) => {
    if (!taskId) return;
    setOpenQuickEditById((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const openTaskDrawer = (taskId, tab = "comments") => {
    if (!taskId) return;
    setTaskDrawer({
      open: true,
      taskId,
      tab: tab === "activity" ? "activity" : "comments",
    });
  };

  const closeTaskDrawer = () => {
    setTaskDrawer({ open: false, taskId: "", tab: "comments" });
  };

  const switchTaskDrawerTab = (tab) => {
    setTaskDrawer((prev) => ({
      ...prev,
      tab: tab === "activity" ? "activity" : "comments",
    }));
  };

  const extractMentionNames = (text = "") =>
    [...text.matchAll(/@\[(.+?)\]/g)]
      .map((match) => (match[1] || "").trim())
      .filter(Boolean);

  const normalizeCommentText = (text = "") =>
    text.replace(/@\[(.+?)\]/g, "@$1").trim();

  const getMentionQuery = (text = "") => {
    const match = text.match(/(^|\s)@([^\s@]*)$/);
    if (!match) return null;
    return (match[2] || "").trim().toLowerCase();
  };

  const updateCommentDraft = (taskId, nextText) => {
    setCommentDraftByTask((prev) => ({ ...prev, [taskId]: nextText }));
    const mentionNames = extractMentionNames(nextText);
    setCommentMentionsByTask((prev) => {
      const current = prev[taskId] || [];
      if (!current.length) return prev;
      const filtered = current.filter((mention) =>
        mentionNames.some((name) => name.toLowerCase() === mention.name.toLowerCase())
      );
      return { ...prev, [taskId]: filtered };
    });
  };

  const insertMentionIntoDraft = (taskId, member) => {
    if (!member?.id || !member?.name) return;
    setCommentDraftByTask((prev) => {
      const current = prev[taskId] || "";
      const nextText = current.replace(/(^|\s)@([^\s@]*)$/, `$1@[${member.name}] `);
      return { ...prev, [taskId]: nextText };
    });
    setCommentMentionsByTask((prev) => {
      const current = prev[taskId] || [];
      if (current.some((item) => item.id === member.id)) return prev;
      return { ...prev, [taskId]: [...current, { id: member.id, name: member.name }] };
    });
  };

  const resolveMentionIds = (taskId, text) => {
    const bySelection = (commentMentionsByTask[taskId] || [])
      .filter((mention) =>
        text.toLowerCase().includes(`@[${mention.name}]`.toLowerCase())
      )
      .map((mention) => mention.id);
    const byText = extractMentionNames(text)
      .map((name) => memberLookupByName[name.toLowerCase()])
      .filter(Boolean);
    return [...new Set([...bySelection, ...byText])];
  };

  const submitTaskComment = async (taskId) => {
    const rawText = (commentDraftByTask[taskId] || "").trim();
    if (!rawText) return;

    const commentText = normalizeCommentText(rawText);
    if (!commentText) return;
    if (commentText.length > MAX_TASK_COMMENT_LENGTH) {
      setError(`Comment cannot exceed ${MAX_TASK_COMMENT_LENGTH} characters.`);
      return;
    }

    const mentionUserIds = resolveMentionIds(taskId, rawText);
    setSubmittingCommentTaskId(taskId);
    setError("");
    try {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_API}/channels/${channelId}/tasks/${taskId}/comments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            comment: commentText,
            mentionUserIds,
          }),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.message || "Unable to add comment.");
        return;
      }

      setCommentDraftByTask((prev) => ({ ...prev, [taskId]: "" }));
      setCommentMentionsByTask((prev) => ({ ...prev, [taskId]: [] }));
      fetchTasks();
    } catch (error) {
      setError("Unable to add comment.");
    } finally {
      setSubmittingCommentTaskId(null);
    }
  };

  return (
    <>
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-4">
          <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-2.5">
              <h3 className="text-base font-semibold">Create Task</h3>
              <button
                type="button"
                onClick={closeCreateModal}
                className="text-gray-500 hover:text-gray-700"
              >
                x
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
              {error && (
                <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(event) =>
                    setNewTask((prev) => ({ ...prev, title: event.target.value }))
                  }
                  placeholder="Task title"
                  className="border border-gray-300 rounded px-3 py-2 text-sm outline-none"
                />
                <input
                  type="datetime-local"
                  value={newTask.deadline}
                  onChange={(event) =>
                    setNewTask((prev) => ({ ...prev, deadline: event.target.value }))
                  }
                  className="border border-gray-300 rounded px-3 py-2 text-sm outline-none"
                />
                <select
                  value={newTask.assignedTo}
                  onChange={(event) =>
                    setNewTask((prev) => ({ ...prev, assignedTo: event.target.value }))
                  }
                  className="border border-gray-300 rounded px-3 py-2 text-sm outline-none"
                >
                  <option value="">Assign to</option>
                  {memberOptions.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
                <select
                  value={newTask.priority}
                  onChange={(event) =>
                    setNewTask((prev) => ({ ...prev, priority: event.target.value }))
                  }
                  className="border border-gray-300 rounded px-3 py-2 text-sm outline-none"
                >
                  {PRIORITY_OPTIONS.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={newTask.tagsInput}
                  onChange={(event) =>
                    setNewTask((prev) => ({ ...prev, tagsInput: event.target.value }))
                  }
                  placeholder="Tags (comma separated)"
                  className="border border-gray-300 rounded px-3 py-2 text-sm outline-none"
                />
              </div>

              <div className="rounded border border-gray-200 bg-gray-50 p-2.5">
                <p className="mb-2 text-xs font-semibold text-slate-700">
                  Reminder & Escalation Rules
                </p>
                <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                  <label className="flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={!!newTask.remindersEnabled}
                      onChange={(event) =>
                        setNewTask((prev) => ({
                          ...prev,
                          remindersEnabled: event.target.checked,
                        }))
                      }
                    />
                    Enable reminders
                  </label>
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                      {REMINDER_PRESET_OPTIONS.map((minute) => {
                        const isSelected = newTaskReminderMinutes.includes(minute);
                        return (
                          <label
                            key={`new-reminder-${minute}`}
                            className={`flex items-center gap-2 rounded border px-2 py-1.5 text-xs ${
                              isSelected
                                ? "border-orange-300 bg-orange-50 text-orange-700"
                                : "border-gray-200 bg-white text-slate-700"
                            } ${!newTask.remindersEnabled ? "opacity-60 cursor-not-allowed" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(event) =>
                                setNewTask((prev) => ({
                                  ...prev,
                                  reminderMinutesInput: toggleReminderMinuteValue(
                                    prev.reminderMinutesInput,
                                    minute,
                                    event.target.checked
                                  ),
                                }))
                              }
                              disabled={!newTask.remindersEnabled}
                            />
                            <span>{`${formatRuleMinutesReadable(minute)} before due`}</span>
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {newTask.remindersEnabled
                        ? `Selected: ${
                            newTaskReminderMinutes.length > 0
                              ? newTaskReminderMinutes
                                  .map((minute) => formatRuleMinutesReadable(minute))
                                  .join(", ")
                              : "None"
                          }`
                        : "Reminders are disabled"}
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={!!newTask.escalationEnabled}
                      onChange={(event) =>
                        setNewTask((prev) => ({
                          ...prev,
                          escalationEnabled: event.target.checked,
                        }))
                      }
                    />
                    Enable escalation
                  </label>
                  <select
                    value={String(
                      Number.parseInt(newTask.escalationMinutesAfterDue, 10) ||
                        DEFAULT_ESCALATION_MINUTES_AFTER_DUE
                    )}
                    onChange={(event) =>
                      setNewTask((prev) => ({
                        ...prev,
                        escalationMinutesAfterDue: event.target.value,
                      }))
                    }
                    className="border border-gray-300 rounded px-3 py-2 text-sm outline-none"
                    disabled={!newTask.escalationEnabled}
                  >
                    {newTaskEscalationOptions.map((minute) => (
                      <option key={`new-escalation-${minute}`} value={minute}>
                        {`${formatRuleMinutesReadable(minute)} after due`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <textarea
                value={newTask.description}
                onChange={(event) =>
                  setNewTask((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Task description"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm outline-none min-h-[88px]"
              />

              <div className="rounded border border-gray-200 bg-gray-50 p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-700">
                    Attach Files ({newTask.attachments?.length || 0}/{MAX_TASK_ATTACHMENTS})
                  </p>
                  <label className="cursor-pointer rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                    {isUploadingCreateAttachments ? "Uploading..." : "Add Files"}
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleCreateAttachmentUpload}
                      disabled={isUploadingCreateAttachments}
                    />
                  </label>
                </div>

                {newTask.attachments?.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {newTask.attachments.map((attachment, index) => {
                      const displayName = attachment.name || getFileNameFromUrl(attachment.url);
                      const sizeLabel = formatAttachmentSize(attachment.size);
                      return (
                        <div
                          key={`${attachment.url}-${index}`}
                          className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-white px-2 py-1.5"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-slate-700" title={displayName}>
                              {displayName}
                            </p>
                            {sizeLabel && (
                              <p className="text-[10px] text-slate-500">{sizeLabel}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeCreateAttachment(index)}
                            className="rounded border border-red-200 px-2 py-1 text-[10px] font-medium text-red-600 hover:bg-red-50"
                            disabled={isUploadingCreateAttachments}
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t px-3 py-2.5 sm:px-4">
              <button
                type="button"
                onClick={closeCreateModal}
                className="rounded border border-gray-300 px-3 py-2 text-sm"
                disabled={saving || isUploadingCreateAttachments}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateTask}
                disabled={saving || isUploadingCreateAttachments}
                className={`rounded px-3 py-2 text-sm text-white ${
                  saving || isUploadingCreateAttachments
                    ? "bg-orange-300 cursor-not-allowed"
                    : "bg-orange-500"
                }`}
              >
                {saving ? "Creating..." : isUploadingCreateAttachments ? "Uploading..." : "Create Task"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-4">
          <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-2.5">
              <h3 className="text-base font-semibold">
                Edit Task {editTask.taskNumber ? `(${editTask.taskNumber})` : ""}
              </h3>
              <button
                type="button"
                onClick={closeEditModal}
                className="text-gray-500 hover:text-gray-700"
              >
                x
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
              {error && (
                <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                <input
                  type="text"
                  value={editTask.title}
                  onChange={(event) =>
                    setEditTask((prev) => ({ ...prev, title: event.target.value }))
                  }
                  maxLength={200}
                  placeholder="Task title"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm outline-none"
                />
                <select
                  value={editTask.priority}
                  onChange={(event) =>
                    setEditTask((prev) => ({ ...prev, priority: event.target.value }))
                  }
                  className="border border-gray-300 rounded px-3 py-2 text-sm outline-none"
                >
                  {PRIORITY_OPTIONS.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={editTask.tagsInput}
                  onChange={(event) =>
                    setEditTask((prev) => ({ ...prev, tagsInput: event.target.value }))
                  }
                  maxLength={MAX_TASK_TAGS * (MAX_TASK_TAG_LENGTH + 2)}
                  placeholder="Tags (comma separated)"
                  className="md:col-span-2 w-full border border-gray-300 rounded px-3 py-2 text-sm outline-none"
                />
              </div>

              <div className="rounded border border-gray-200 bg-gray-50 p-2.5">
                <p className="mb-2 text-xs font-semibold text-slate-700">
                  Reminder & Escalation Rules
                </p>
                <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                  <label className="flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={!!editTask.remindersEnabled}
                      onChange={(event) =>
                        setEditTask((prev) => ({
                          ...prev,
                          remindersEnabled: event.target.checked,
                        }))
                      }
                    />
                    Enable reminders
                  </label>
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                      {REMINDER_PRESET_OPTIONS.map((minute) => {
                        const isSelected = editTaskReminderMinutes.includes(minute);
                        return (
                          <label
                            key={`edit-reminder-${minute}`}
                            className={`flex items-center gap-2 rounded border px-2 py-1.5 text-xs ${
                              isSelected
                                ? "border-orange-300 bg-orange-50 text-orange-700"
                                : "border-gray-200 bg-white text-slate-700"
                            } ${!editTask.remindersEnabled ? "opacity-60 cursor-not-allowed" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(event) =>
                                setEditTask((prev) => ({
                                  ...prev,
                                  reminderMinutesInput: toggleReminderMinuteValue(
                                    prev.reminderMinutesInput,
                                    minute,
                                    event.target.checked
                                  ),
                                }))
                              }
                              disabled={!editTask.remindersEnabled}
                            />
                            <span>{`${formatRuleMinutesReadable(minute)} before due`}</span>
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {editTask.remindersEnabled
                        ? `Selected: ${
                            editTaskReminderMinutes.length > 0
                              ? editTaskReminderMinutes
                                  .map((minute) => formatRuleMinutesReadable(minute))
                                  .join(", ")
                              : "None"
                          }`
                        : "Reminders are disabled"}
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={!!editTask.escalationEnabled}
                      onChange={(event) =>
                        setEditTask((prev) => ({
                          ...prev,
                          escalationEnabled: event.target.checked,
                        }))
                      }
                    />
                    Enable escalation
                  </label>
                  <select
                    value={String(
                      Number.parseInt(editTask.escalationMinutesAfterDue, 10) ||
                        DEFAULT_ESCALATION_MINUTES_AFTER_DUE
                    )}
                    onChange={(event) =>
                      setEditTask((prev) => ({
                        ...prev,
                        escalationMinutesAfterDue: event.target.value,
                      }))
                    }
                    className="border border-gray-300 rounded px-3 py-2 text-sm outline-none"
                    disabled={!editTask.escalationEnabled}
                  >
                    {editTaskEscalationOptions.map((minute) => (
                      <option key={`edit-escalation-${minute}`} value={minute}>
                        {`${formatRuleMinutesReadable(minute)} after due`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <textarea
                value={editTask.description}
                onChange={(event) =>
                  setEditTask((prev) => ({ ...prev, description: event.target.value }))
                }
                maxLength={2000}
                placeholder="Task description"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm outline-none min-h-[96px]"
              />

              <div className="rounded border border-gray-200 bg-gray-50 p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-700">
                    Attach Files ({editTask.attachments?.length || 0}/{MAX_TASK_ATTACHMENTS})
                  </p>
                  <label className="cursor-pointer rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                    {isUploadingEditAttachments ? "Uploading..." : "Add Files"}
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleEditAttachmentUpload}
                      disabled={isUploadingEditAttachments}
                    />
                  </label>
                </div>

                {editTask.attachments?.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {editTask.attachments.map((attachment, index) => {
                      const displayName = attachment.name || getFileNameFromUrl(attachment.url);
                      const sizeLabel = formatAttachmentSize(attachment.size);
                      return (
                        <div
                          key={`${attachment.url}-${index}`}
                          className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-white px-2 py-1.5"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-slate-700" title={displayName}>
                              {displayName}
                            </p>
                            {sizeLabel && (
                              <p className="text-[10px] text-slate-500">{sizeLabel}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeEditAttachment(index)}
                            className="rounded border border-red-200 px-2 py-1 text-[10px] font-medium text-red-600 hover:bg-red-50"
                            disabled={isUploadingEditAttachments || updatingTaskId === editTask.id}
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t px-3 py-2.5 sm:px-4">
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded border border-gray-300 px-3 py-2 text-sm"
                disabled={updatingTaskId === editTask.id || isUploadingEditAttachments}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEditTaskSave}
                disabled={updatingTaskId === editTask.id || isUploadingEditAttachments}
                className={`rounded px-3 py-2 text-sm text-white ${
                  updatingTaskId === editTask.id || isUploadingEditAttachments
                    ? "bg-orange-300 cursor-not-allowed"
                    : "bg-orange-500"
                }`}
              >
                {updatingTaskId === editTask.id
                  ? "Saving..."
                  : isUploadingEditAttachments
                  ? "Uploading..."
                  : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showList && (
        <div className="flex-1 overflow-y-auto px-3 lg:px-4 pb-4">
          <div className="rounded-lg border border-gray-200 bg-white p-3 mb-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-12">
              <input
                type="text"
                placeholder="Search by task title or task number"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                className="border border-gray-300 rounded px-3 py-2 text-sm outline-none xl:col-span-2"
              />
              <select
                value={filters.status}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, status: event.target.value }))
                }
                className="border border-gray-300 rounded px-3 py-2 text-sm outline-none xl:col-span-2"
              >
                <option value="">All Status</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <input
                type="month"
                value={filters.month}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, month: event.target.value }))
                }
                className="border border-gray-300 rounded px-3 py-2 text-sm outline-none xl:col-span-2"
              />
              <select
                value={filters.assignedTo}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, assignedTo: event.target.value }))
                }
                className="border border-gray-300 rounded px-3 py-2 text-sm outline-none xl:col-span-2"
              >
                <option value="">All Assignees</option>
                {memberOptions.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
              <select
                value={filters.priority}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, priority: event.target.value }))
                }
                className="border border-gray-300 rounded px-3 py-2 text-sm outline-none xl:col-span-1"
              >
                <option value="">All Priorities</option>
                {PRIORITY_OPTIONS.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={filters.tag}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, tag: event.target.value }))
                }
                placeholder="Filter by tag"
                className="border border-gray-300 rounded px-3 py-2 text-sm outline-none xl:col-span-2"
              />
              <button
                type="button"
                onClick={resetFilters}
                className="border border-gray-300 rounded px-3 py-2 text-sm xl:col-span-1"
              >
                Reset
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-gray-100 pt-2">
              <p className="text-xs text-slate-500">
                {tasks.length} task{tasks.length === 1 ? "" : "s"} in this channel
              </p>
              <div className="inline-flex rounded border border-gray-300 bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => setTaskViewMode("compact")}
                  className={`rounded px-2.5 py-1 text-xs font-medium ${
                    taskViewMode === "compact"
                      ? "bg-slate-700 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Compact View
                </button>
                <button
                  type="button"
                  onClick={() => setTaskViewMode("detailed")}
                  className={`rounded px-2.5 py-1 text-xs font-medium ${
                    taskViewMode === "detailed"
                      ? "bg-slate-700 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Detailed View
                </button>
              </div>
            </div>
          </div>

          {error && !isCreateModalOpen && (
            <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          {loading && (
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-6 text-sm text-gray-500">
              Loading tasks...
            </div>
          )}

          {!loading && tasks.length === 0 && (
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-6 text-sm text-gray-500">
              No tasks found for this channel.
            </div>
          )}

          {!loading &&
            sortedGroupKeys.map((groupKey) => {
              const items = groupedTasks[groupKey] || [];
              const isCollapsed = !!collapsedMonths[groupKey];
              return (
                <div key={groupKey} className="rounded-lg border border-gray-200 bg-white mb-3">
                  <button
                    type="button"
                    onClick={() => toggleMonth(groupKey)}
                    className="w-full px-3 py-2 border-b border-gray-100 flex items-center justify-between text-sm font-semibold"
                  >
                    <span>
                      {groupKey === "no-deadline"
                        ? "No Deadline"
                        : normalizeMonthLabel(`${groupKey}-01`)}
                    </span>
                    <span>{isCollapsed ? "+" : "-"}</span>
                  </button>

                  {!isCollapsed && (
                    <div className="p-3 space-y-3">
                      {items.map((task) => {
                        const normalizedTaskNumber = (task.taskNumber || "").toUpperCase();
                        const assigneeId =
                          task.assignedToUser?._id ||
                          task.assignedTo?._id ||
                          task.assignedTo;
                        const reminderRules = task.reminderRules || {};
                        const escalationRules = task.escalationRules || {};
                        const reminderMinuteLabels = (
                          Array.isArray(reminderRules.minutesBefore)
                            ? reminderRules.minutesBefore
                            : DEFAULT_REMINDER_MINUTES
                        ).map((minutes) => formatRuleMinutesLabel(minutes));
                        const escalationMinutesAfterDue =
                          Number.parseInt(escalationRules.minutesAfterDue, 10) ||
                          DEFAULT_ESCALATION_MINUTES_AFTER_DUE;
                        const creatorName =
                          task.createdByUser?.name ||
                          memberNameMap[task.createdBy?.toString?.()] ||
                          "Unknown";
                        const overdue =
                          task.status !== "Completed" &&
                          moment(task.deadline).isBefore(moment());
                        const isHighlighted = highlightTaskNumber === normalizedTaskNumber;
                        const showTaskDetails =
                          taskViewMode === "detailed" || !!openTaskDetailsById[task._id];
                        const showQuickEdit =
                          taskViewMode === "detailed" || !!openQuickEditById[task._id];
                        const taskAttachmentCount = Array.isArray(task.attachments)
                          ? task.attachments.length
                          : 0;
                        const taskCommentCount = Array.isArray(task.comments)
                          ? task.comments.length
                          : 0;
                        const taskActivityCount = Array.isArray(task.activityLog)
                          ? task.activityLog.length
                          : 0;
                        const statusBorderClass = overdue
                          ? "border-l-red-400"
                          : task.status === "Completed"
                          ? "border-l-emerald-400"
                          : task.status === "Acknowledged"
                          ? "border-l-blue-400"
                          : "border-l-amber-400";

                        return (
                          <div
                            key={task._id}
                            className={`rounded-xl border border-l-4 p-3 shadow-sm ${
                              overdue ? "border-red-300 bg-red-50" : "border-gray-200 bg-white"
                            } ${statusBorderClass} ${isHighlighted ? "ring-2 ring-orange-300" : ""}`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold px-2 py-1 rounded bg-gray-100 text-gray-700">
                                  {task.taskNumber}
                                </span>
                                <span className="text-sm font-semibold">{task.title}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`text-xs px-2 py-1 rounded ${
                                    task.status === "Completed"
                                      ? "bg-green-100 text-green-700"
                                      : task.status === "Acknowledged"
                                      ? "bg-blue-100 text-blue-700"
                                      : "bg-yellow-100 text-yellow-700"
                                  }`}
                                >
                                  {task.status}
                                </span>
                                <span
                                  className={`text-xs px-2 py-1 rounded ${getPriorityBadgeClass(
                                    task.priority
                                  )}`}
                                >
                                  {task.priority || "Medium"}
                                </span>
                                {overdue && (
                                  <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700">
                                    Overdue
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => openEditModal(task)}
                                  className="text-xs px-2 py-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
                                  disabled={updatingTaskId === task._id || deletingTaskId === task._id}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTask(task)}
                                  className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50"
                                  disabled={updatingTaskId === task._id || deletingTaskId === task._id}
                                >
                                  {deletingTaskId === task._id ? "Deleting..." : "Delete"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleTaskDetails(task._id)}
                                  className="text-xs px-2 py-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
                                >
                                  {showTaskDetails ? "Hide Details" : "Details"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleQuickEdit(task._id)}
                                  className="text-xs px-2 py-1 rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
                                >
                                  {showQuickEdit ? "Hide Quick Edit" : "Quick Edit"}
                                </button>
                              </div>
                            </div>

                            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                              <span>Assigned: {task.assignedToUser?.name || "Unassigned"}</span>
                              <span>Deadline: {moment(task.deadline).format("DD MMM YYYY, HH:mm")}</span>
                              <span>Files: {taskAttachmentCount}</span>
                              <span>Comments: {taskCommentCount}</span>
                              <span>Activity: {taskActivityCount}</span>
                            </div>

                            {showTaskDetails && (
                              <>
                                {task.description && (
                                  <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap break-words">
                                    {task.description}
                                  </p>
                                )}

                                {Array.isArray(task.tags) && task.tags.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {task.tags.map((tag) => (
                                      <span
                                        key={`${task._id}-${tag}`}
                                        className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"
                                      >
                                        #{tag}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                <div className="mt-2 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-600">
                                  <p>
                                    Reminders:{" "}
                                    {reminderRules.enabled !== false
                                      ? reminderMinuteLabels.join(", ")
                                      : "Disabled"}
                                  </p>
                                  <p>
                                    Escalation:{" "}
                                    {escalationRules.enabled !== false
                                      ? `${formatRuleMinutesLabel(escalationMinutesAfterDue)} after due`
                                      : "Disabled"}
                                  </p>
                                </div>
                              </>
                            )}

                            {showTaskDetails && (
                              <>
                                {Array.isArray(task.attachments) && task.attachments.length > 0 && (
                                  <div className="mt-2 space-y-2">
                                    {task.attachments.map((attachment, attachmentIndex) => {
                                      const attachmentType = getAttachmentType(attachment);
                                      const displayName =
                                        attachment.name || getFileNameFromUrl(attachment.url);
                                      const sizeLabel = formatAttachmentSize(attachment.size);

                                      return (
                                        <div
                                          key={`${attachment.url}-${attachmentIndex}`}
                                          className="rounded border border-slate-200 bg-slate-50 p-2"
                                        >
                                          {attachmentType === "image" && (
                                            <img
                                              src={attachment.url}
                                              alt={displayName}
                                              className="mb-2 max-h-48 w-auto rounded border border-slate-200"
                                            />
                                          )}
                                          {attachmentType === "video" && (
                                            <video
                                              controls
                                              src={attachment.url}
                                              className="mb-2 max-h-48 w-full rounded border border-slate-200"
                                            />
                                          )}
                                          {attachmentType === "audio" && (
                                            <audio
                                              controls
                                              src={attachment.url}
                                              className="mb-2 w-full"
                                            />
                                          )}
                                          {attachmentType === "pdf" && (
                                            <iframe
                                              title={displayName}
                                              src={attachment.url}
                                              className="mb-2 h-48 w-full rounded border border-slate-200 bg-white"
                                            />
                                          )}

                                          <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="min-w-0">
                                              <p
                                                className="truncate text-xs font-medium text-slate-700"
                                                title={displayName}
                                              >
                                                {displayName}
                                              </p>
                                              <p className="text-[10px] text-slate-500">
                                                {attachmentType.toUpperCase()}
                                                {sizeLabel ? ` | ${sizeLabel}` : ""}
                                              </p>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  window.open(
                                                    attachment.url,
                                                    "_blank",
                                                    "noopener,noreferrer"
                                                  )
                                                }
                                                className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-50"
                                              >
                                                Open
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  downloadFile(attachment.url, displayName)
                                                }
                                                className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-50"
                                              >
                                                Download
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                <p className="mt-2 text-xs text-gray-500">
                                  Created by {creatorName} | Deadline {" "}
                                  {moment(task.deadline).format("DD MMM YYYY, HH:mm")}
                                </p>
                              </>
                            )}

                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openTaskDrawer(task._id, "comments")}
                                className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                Comments ({taskCommentCount})
                              </button>
                              <button
                                type="button"
                                onClick={() => openTaskDrawer(task._id, "activity")}
                                className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                Activity ({taskActivityCount})
                              </button>
                            </div>

                            {showQuickEdit && (
                              <div className="mt-3 grid grid-cols-1 gap-2 border-t border-gray-100 pt-2 md:grid-cols-3">
                                <select
                                  value={assigneeId || ""}
                                  onChange={(event) =>
                                    patchTask(task._id, { assignedTo: event.target.value })
                                  }
                                  className="border border-gray-300 rounded px-2 py-2 text-sm outline-none"
                                  disabled={updatingTaskId === task._id}
                                >
                                  {memberOptions.map((member) => (
                                    <option key={member.id} value={member.id}>
                                      {member.name}
                                    </option>
                                  ))}
                                </select>

                                <input
                                  type="datetime-local"
                                  value={toInputDateTime(task.deadline)}
                                  onChange={(event) =>
                                    patchTask(task._id, {
                                      deadline: new Date(event.target.value).toISOString(),
                                    })
                                  }
                                  className="border border-gray-300 rounded px-2 py-2 text-sm outline-none"
                                  disabled={updatingTaskId === task._id}
                                />

                                <select
                                  value={task.status}
                                  onChange={(event) =>
                                    patchTask(task._id, { status: event.target.value })
                                  }
                                  className="border border-gray-300 rounded px-2 py-2 text-sm outline-none"
                                  disabled={updatingTaskId === task._id}
                                >
                                  {STATUS_OPTIONS.map((status) => (
                                    <option key={status} value={status}>
                                      {status}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {updatingTaskId === task._id && (
                              <p className="mt-2 text-xs text-gray-500">Updating task...</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {taskDrawer.open && selectedDrawerTask && (
        <div
          className="fixed inset-0 z-[70] bg-black/40"
          onClick={closeTaskDrawer}
        >
          <div
            className="absolute inset-y-0 right-0 flex w-full max-w-full flex-col border-l border-slate-200 bg-white shadow-xl sm:w-[420px] md:w-[460px]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-200 px-3 py-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-500">
                  {selectedDrawerTask.taskNumber || "Task"}
                </p>
                <h4 className="truncate text-sm font-semibold text-slate-800">
                  {selectedDrawerTask.title || "Task Details"}
                </h4>
              </div>
              <button
                type="button"
                onClick={closeTaskDrawer}
                className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
              <button
                type="button"
                onClick={() => switchTaskDrawerTab("comments")}
                className={`rounded px-2.5 py-1 text-xs font-medium ${
                  taskDrawer.tab === "comments"
                    ? "bg-orange-500 text-white"
                    : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                Comments ({selectedDrawerTask.comments?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => switchTaskDrawerTab("activity")}
                className={`rounded px-2.5 py-1 text-xs font-medium ${
                  taskDrawer.tab === "activity"
                    ? "bg-orange-500 text-white"
                    : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                Activity ({selectedDrawerTask.activityLog?.length || 0})
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3">
              {taskDrawer.tab === "comments" && (
                <div className="space-y-2">
                  {(selectedDrawerTask.comments || []).length === 0 && (
                    <p className="text-[11px] text-slate-500">No comments yet.</p>
                  )}
                  {(selectedDrawerTask.comments || []).map((comment) => (
                    <div
                      key={comment._id || `${comment.author}-${comment.createdAt}`}
                      className="rounded border border-slate-200 bg-white px-2 py-1.5"
                    >
                      <div className="mb-0.5 flex items-center justify-between gap-2">
                        <span className="truncate text-[11px] font-semibold text-slate-700">
                          {comment.authorUser?.name || "Unknown"}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {moment(comment.createdAt).format("DD MMM, HH:mm")}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap break-words text-xs text-slate-700">
                        {comment.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {taskDrawer.tab === "activity" && (
                <div className="space-y-2">
                  {(selectedDrawerTask.activityLog || []).length === 0 && (
                    <p className="text-[11px] text-slate-500">No activity yet.</p>
                  )}
                  {(selectedDrawerTask.activityLog || [])
                    .slice()
                    .reverse()
                    .map((activity, index) => (
                      <div key={activity._id || `${activity.action}-${activity.createdAt}-${index}`}>
                        <div className="rounded border border-slate-200 bg-white px-2 py-1.5">
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${getActivityActionClass(
                                activity.action
                              )}`}
                            >
                              {formatActivityActionLabel(activity.action)}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {moment(activity.createdAt).format("DD MMM, HH:mm")}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700">
                            {activity.message || "Task updated."}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-500">
                            By {activity.actorUser?.name || "System"}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {taskDrawer.tab === "comments" && (
              <div className="border-t border-slate-200 px-3 py-3">
                <div className="relative">
                  <textarea
                    value={commentDraftByTask[selectedDrawerTask._id] || ""}
                    onChange={(event) =>
                      updateCommentDraft(selectedDrawerTask._id, event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        submitTaskComment(selectedDrawerTask._id);
                      }
                    }}
                    placeholder="Add comment... use @ to mention (e.g. @[John])"
                    className="w-full resize-y rounded border border-gray-300 px-2 py-1.5 text-xs outline-none min-h-[72px]"
                  />

                  {(() => {
                    const mentionQuery = getMentionQuery(
                      commentDraftByTask[selectedDrawerTask._id] || ""
                    );
                    if (mentionQuery === null) return null;
                    const suggestions = memberOptions
                      .filter((member) =>
                        (member.name || "").toLowerCase().includes(mentionQuery)
                      )
                      .slice(0, 6);
                    if (suggestions.length === 0) return null;

                    return (
                      <div className="absolute bottom-full left-0 z-10 mb-1 w-full rounded border border-slate-200 bg-white shadow-md">
                        {suggestions.map((member) => (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() =>
                              insertMentionIntoDraft(selectedDrawerTask._id, member)
                            }
                            className="block w-full px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100"
                          >
                            {member.name}
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => submitTaskComment(selectedDrawerTask._id)}
                    disabled={submittingCommentTaskId === selectedDrawerTask._id}
                    className={`rounded px-2.5 py-1.5 text-xs font-medium text-white ${
                      submittingCommentTaskId === selectedDrawerTask._id
                        ? "cursor-not-allowed bg-orange-300"
                        : "bg-orange-500 hover:bg-orange-600"
                    }`}
                  >
                    {submittingCommentTaskId === selectedDrawerTask._id
                      ? "Posting..."
                      : "Post Comment"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ChannelTaskManager;
