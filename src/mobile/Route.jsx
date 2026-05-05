import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import MobileLayout from "./layout/MobileLayout";
import Home from "../desktop/pages/Home";
import Attendance from "../desktop/pages/Attendance";
import Chat from "../desktop/pages/Chat";
import NotificationPage from "../desktop/pages/Notification";
import Callback from "../desktop/pages/Callback";
import MobileConversations from "./pages/MobileConversations";
import Transfer from "../desktop/pages/Transfer";
import Sales from "../desktop/pages/Sales";
import Concern from "../desktop/pages/Concern";
import NotesPage from "../desktop/pages/Notes";
import BookLeave from "../desktop/pages/BookLeave";
import ForgotClock from "../desktop/pages/ForgotClock";
import CallbackList from "../desktop/pages/CallbackList";
import TransferList from "../desktop/pages/TransferList";
import SalesList from "../desktop/pages/SalesList";
import AttendanceList from "../desktop/pages/AttendanceList";
import ChannelChat from "../desktop/pages/ChannelChat";
import Login from "../desktop/pages/Login";
import ProtectedRoute from "../desktop/ProtectedRoute";

function MobileRouting() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<MobileLayout />}>
          <Route path="/home" element={<Home />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/conversations" element={<MobileConversations />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/callback" element={<Callback />} />
          <Route path="/callbacklist" element={<CallbackList />} />
          <Route path="/transfer" element={<Transfer />} />
          <Route path="/transferlist" element={<TransferList />} />
          <Route path="/sales" element={<Sales />} />
          <Route path="/saleslist" element={<SalesList />} />
          <Route path="/concern" element={<Concern />} />
          <Route path="/notes" element={<NotesPage />} />
          <Route path="/book-leave" element={<BookLeave />} />
          <Route path="/forgotClock" element={<ForgotClock />} />
          <Route path="/attendance-list" element={<AttendanceList />} />
          <Route path="/channelchat" element={<ChannelChat />} />
          <Route path="/channelchat/:id" element={<ChannelChat />} />
          <Route path="/notification" element={<NotificationPage />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default MobileRouting;
