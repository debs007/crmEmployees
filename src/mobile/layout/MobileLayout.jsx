import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Home, CheckSquare, MessageCircle, Bell, Briefcase, Users } from "lucide-react";
import logo from "../../assets/desktop/logo.svg";

// Mobile shell for employee app with top bar and bottom nav.
const MobileLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (window.location.pathname === "/") {
      navigate("/home", { replace: true });
    }
  }, [navigate]);

  const navItems = [
    { to: "/home", label: "Home", icon: <Home size={20} /> },
    { to: "/attendance", label: "Attendance", icon: <CheckSquare size={20} /> },
    { to: "/conversations", label: "Chats", icon: <MessageCircle size={20} /> },
    { to: "/notification", label: "Alerts", icon: <Bell size={20} /> },
    { to: "/callback", label: "Leads", icon: <Briefcase size={20} /> },
  ];
  const isConversationList = /^\/conversations(\/|$)/.test(location.pathname);
  const isChatThread = /^\/(chat|channelchat)(\/|$)/.test(location.pathname);
  const hideTopBar = isConversationList || isChatThread;
  const hideBottomNav = isChatThread;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {!hideTopBar && (
        <header className="flex items-center justify-between px-4 py-3 border-b bg-white">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Digital Mitro" className="h-9 w-9" />
            <span className="text-sm font-semibold text-gray-800">Employee</span>
          </div>
        </header>
      )}

      <main
        className={`flex-1 overflow-y-auto ${
          isChatThread ? "px-0 pb-0" : isConversationList ? "px-0 pb-16" : "px-3 pb-16"
        }`}
      >
        <Outlet />
      </main>

      {!hideBottomNav && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-sm">
          <div className="grid grid-cols-5 text-xs">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center py-2 ${
                    isActive ? "text-orange-500" : "text-gray-600"
                  }`
                }
              >
                {item.icon}
                <span className="mt-1">{item.label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
};

export default MobileLayout;
