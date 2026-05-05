import { useEffect } from "react";
import { connectSocket, joinChannel } from "../utils/socket";
import { useAuth } from "../context/authContext";


export const useSocketSetup = () => {
  const { token, getChannels } = useAuth();

  useEffect(() => {
    if (!token) return;

    const setupSocket = async () => {
      connectSocket(); // Connect and authenticate

      try {
        const data = await getChannels(); // ✅ Get all channels user is in
        data?.channels?.forEach((channel) => {
          joinChannel(channel._id); // 💥 Auto-join each
        });
      } catch (error) {
        console.error("Error setting up socket channels", error);
      }
    };

    setupSocket();
  }, [token]);
};
