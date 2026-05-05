// hooks/useGlobalNotification.js
import { useEffect } from "react";
import { onNotificationReceived } from "../utils/socket";

export const useGlobalNotification = () => {
  useEffect(() => {
    const unsubscribe = onNotificationReceived(
      () => {},
      { showBrowserNotification: true }
    );

    return () => unsubscribe(); // Cleanup listener on unmount
  }, []);
};
