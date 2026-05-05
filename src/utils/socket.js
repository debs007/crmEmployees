// src/utils/socket.js
import { io } from "socket.io-client";
// import { jwtDecode } from "jwt-decode";
import logo from "../assets/desktop/logo.svg"

const socket = io(`${import.meta.env.VITE_BACKEND_API}`, { autoConnect: false, reconnection: true });

const requestNotificationPermission = async () => {
  if ("Notification" in window) {
    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }
  }
};

// Show a browser notification
const showNotification = (title, body) => {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, {
      body,
      icon: {logo}, // Change to your app's icon
    });
  }
};


// Function to connect and authenticate socket
export const connectSocket = () => {
  const token = localStorage.getItem("token");
  if (!token) {
    console.warn("No token found in localStorage. Socket will not connect.");
    return;
  }
  requestNotificationPermission();



  socket.auth = { token };
  socket.connect();

  socket.on("connect", () => {
    // console.log("✅ Socket connected:", socket.id);
    socket.emit("authenticate", token);
  });

  socket.on("authenticated", (data) => {
    // console.log("✅ User authenticated:", data);
  });

  socket.on("unauthorized", (msg) => {
    console.error("❌ Unauthorized:", msg);
    socket.disconnect();
  });

  socket.on("disconnect", (reason) => {
    console.warn("⚠️ Socket disconnected:", reason);
  });

  socket.on("connect_error", (error) => {
    console.error("❌ Socket connection error:", error.message);
  });
};

// Function to send a real-time message
export const sendMessage = (sender,receiver, message) => {
  const token = localStorage.getItem("token");
  if (!token) return;

  try {
    // const sender = jwtDecode(token).userId;
    socket.emit("send-message", { sender, receiver, message });
  } catch (error) {
    console.error("Error decoding token:", error);
  }
};

// Listen for user status updates (online/offline)
export const onUserStatusUpdate = (callback) => {
  socket.off("updateUserStatus"); 
  socket.on("updateUserStatus", ({ userId, status }) => {
    console.log(`User ${userId} is now ${status}`);
    callback({ userId, status });
  });

  // Request fresh online user data when subscribing
  socket.emit("getOnlineUsers");
};

// ✅ Fetch the list of online users when connecting
export const fetchOnlineUsers = (callback) => {
  socket.emit("getOnlineUsers");
  socket.on("onlineUsersList", (users) => {
    callback(users);
  });
};

// ✅ Join a channel
export const joinChannel = (channelId) => {
  socket.emit("joinChannel", channelId);
};

// ✅ Send a message in a channel
export const sendChannelMessage = (channelId, sender, message) => {
  const token = localStorage.getItem("token");
  if (!token) return;
    let messageData = { channelId, sender, message };
    socket.emit("send-channel-message", messageData);
};

// Function to send a real-time notification
export const sendNotification = (userId, title, description) => {
  socket.emit("send-notification", { userId, title, description });
  
};

// Listen for incoming messages
export const onMessageReceived = (callback) => {
  socket.on("new-message", callback);
  return () => {
    socket.off("new-message", callback);
  };
};


export const onNotificationReceived = (callback, options = {}) => {
  const { showBrowserNotification = false } = options;
  const handler = (notification) => {
    callback(notification);
    if (showBrowserNotification) {
      showNotification(notification.title, notification.description);
    }
  };
  socket.on("receive-notification", handler);
  return () => {
    socket.off("receive-notification", handler);
  };
};

// ✅ Listen for incoming messages in a channel
export const onChannelMessageReceived = (callback) => {
  socket.on("new-channel-message", callback);
  return () => {
    socket.off("new-channel-message", callback);
  };
};

export const onSoftRefresh = (callback) => {
  socket.on("soft-refresh", callback);
  return () => {
    socket.off("soft-refresh", callback);
  };
};


// Disconnect socket
export const disconnectSocket = () => {
  console.log("🔌 Disconnecting socket...");
  socket.disconnect();
};

export default socket;

