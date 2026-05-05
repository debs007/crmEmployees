import React, { useState, useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import DesktopRouting from "./desktop/Route";
import MobileRouting from "./mobile/Route";
import { AuthProvider } from "./context/authContext";
import { connectSocket } from "./utils/socket";

function App() {
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);
  // useEffect(() => {
  //   connectSocket(); // Ensures connection on app start
  //   checkNotificationPermission();
  //   return () => {
  //     console.log("Cleaning up socket connection...");
  //   };
  // }, []);

  useEffect(() => {
    const handleResize = () => {
      setScreenWidth(window.innerWidth); 
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []); 

  // const checkNotificationPermission = async () => {
  //   if ("Notification" in window) {
  //     if (Notification.permission === "default") {
  //       const permission = await Notification.requestPermission();
  //       console.log(`Notification permission: ${permission}`);
  //     } else if (Notification.permission === "denied") {
  //       console.warn("User has blocked notifications.");
  //     }
  //   }
  // };

  return (
    <AuthProvider>
    <BrowserRouter>
      {screenWidth >= 900 ? <DesktopRouting /> : <MobileRouting />}
    </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
