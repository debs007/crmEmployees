import attendence from "../../assets/desktop/attendence.svg";
import calls from "../../assets/desktop/calls.svg";
import sales from "../../assets/desktop/saleshome.svg";
import transfer from "../../assets/desktop/transferhome.svg";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/authContext";
import { useEffect, useState } from "react";
import moment from "moment";

function Home() {
  const [dates, setDates] = useState([]);
  const { fetchAttendance } = useAuth();
  const navigate = useNavigate();
  const handleAttendaneList = () => {
    navigate("/attendance-list");
  };
  const handleCallback = () => {
    navigate("/callbacklist");
  };
  const handleSales = () => {
    navigate("/saleslist");
  };
  const handleTransfer = () => {
    navigate("/transferlist");
  };
  const attendanceDates = dates.filter(items => items.createdAt).length;
  const months = dates.map(items => moment(items?.currentDate).format("MMM"));
  const activeMonth = months[0] || moment().format("MMM");

  useEffect(() => {
    const getData = async () => {
      const data = await fetchAttendance("this_month");
      if (data) {
        setDates(data?.data);
      }
    };
    getData();
  }, []);

  const cards = [
    {
      title: "Attendance List",
      caption: `${activeMonth} - ${attendanceDates} days`,
      description: "Track your attendance details, production, and day-wise status.",
      icon: attendence,
      action: handleAttendaneList,
    },
    {
      title: "All Callback",
      caption: "Assigned follow-ups",
      description: "Review current callback work and reopen delayed follow-up items quickly.",
      icon: calls,
      action: handleCallback,
    },
    {
      title: "All Sales",
      caption: "Pipeline view",
      description: "Check current sales entries, updates, and progress without extra clicks.",
      icon: sales,
      action: handleSales,
    },
    {
      title: "All Transfer",
      caption: "Handovers",
      description: "See transfer requests and switch context between moving items smoothly.",
      icon: transfer,
      action: handleTransfer,
    },
  ];

  return (
    <div className="w-full px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-6">
      <div className="app-soft-panel rounded-[28px] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-500">
              Daily Workspace
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">Employee overview</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              The key work modules are grouped here so day-to-day actions stay clear on both
              mobile and desktop screens.
            </p>
          </div>
          <span className="app-stat-chip self-start rounded-full px-3 py-1 text-xs font-semibold">
            {attendanceDates} active days
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <button
            key={card.title}
            type="button"
            className="app-soft-panel rounded-[26px] p-5 text-left"
            onClick={card.action}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="rounded-2xl bg-orange-50 p-3 shadow-sm">
                <img src={card.icon} alt="" className="h-[34px] w-[34px] sm:h-[38px] sm:w-[38px]" />
              </div>
              <span className="app-stat-chip rounded-full px-3 py-1 text-[11px] font-semibold">
                {card.caption}
              </span>
            </div>
            <h2 className="mt-5 text-base font-semibold text-slate-900">{card.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{card.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

export default Home;
