import profile from "../../assets/desktop/profileIcon.svg";
import edit from "../../assets/desktop/edit.svg";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/authContext";
import moment from "moment";
function Attendance() {
  const { token, fetchAttendance, userData } = useAuth();
  const [isClockedOut, setIsClockedOut] = useState(true);
  // console.log(userData?.name?.charAt(0))
  const navigate = useNavigate();
  const opeAttendancelist = () => {
    navigate("/attendance-list");
  };
  const handleForgot = () => {
    navigate("/forgotClock");
  };
  const handleConcern = () => {
    navigate("/concern");
  };
  const handleBookLeave = () => {
    navigate("/book-leave");
  };
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(false);
  const duration = moment.duration(attendanceData?.workingTime, "minutes");
  const clockinTime = attendanceData?.firstPunchIn
    ? moment(attendanceData?.firstPunchIn).format("HH:mm")
    : "00:00";
  const clockoutTime = attendanceData?.punchOut
    ? moment(attendanceData?.punchOut).format("HH:mm")
    : "00:00";
  const getAttendance = async () => {
    const data = await fetchAttendance("today");
    if (data) {
      setAttendanceData(data?.data?.[0]);
      setIsClockedOut(!data?.data?.[0]?.isPunchedIn);
    }
  };
  useEffect(() => {
    getAttendance();
  }, []);
  const [clientIp, setClientIp] = useState("");
  useEffect(() => {
    const fetchIpAddress = async () => {
      try {
        const response = await fetch(`https://api.ipify.org/?format=json`);
        if (response.ok) {
          const data = await response.json();
          setClientIp(data.ip); // Store IP in state
        } else {
          console.error("Failed to fetch IP address");
        }
      } catch (error) {
        console.error("Error fetching IP address:", error);
      }
    };

    fetchIpAddress();
  }, []);

  const handlePunch = async () => {
    if (!token) {
      console.error("No token available!");
      return;
    }
    setLoading(true);
    const apiUrl = isClockedOut
      ? `${import.meta.env.VITE_BACKEND_API}/attendance/punch-in`
      : `${import.meta.env.VITE_BACKEND_API}/attendance/punch-out`;
    // console.log( token)

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientIp,
        }),
      });

      getAttendance();
    } catch (error) {
      console.error("Error in punch-in API:", error);
    }
    setLoading(false);
  };

  return (
    <div className="w-full p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <p className=" rounded-full border items-center  flex justify-center w-10 h-10 text-2xl font-medium text-white bg-orange-500">
          {userData?.name?.charAt(0)}
        </p>
        <div>
          <h2 className="text-md font-semibold">{userData?.name}</h2>
          <p className="text-sm text-green-500">● Active</p>
        </div>
        <button className=" px-4 text-gray-500 hover:text-gray-700">
          <img src={edit} alt="" />
        </button>
      </div>

      {/* Punch In/Out Section */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h3 className="text-md font-semibold mb-2">Clock In / Clock Out</h3>
        <p className="text-sm text-gray-500 mb-4">
          Click the button below to clock in.
        </p>
        <div className="space-x-5">
          {loading && (
            <div className="absolute inset-0  bg-opacity-20 flex items-center justify-center z-50">
              <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}

          <button
            className="border border-orange-500 text-[12px] py-0.5 text-orange-500 px-2 rounded cursor-pointer"
            onClick={handlePunch}
          >
            {isClockedOut ? "Clock In" : "Clock Out"}
          </button>
          <button className="text-sm p-1.5 text-gray-600 text-[12px] bg-gray-100 rounded-md inline-block">
            IP: {clientIp || "Fetching..."}
          </button>
        </div>
      </div>

      {/* Work Details */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-white p-6 shadow-md rounded-lg text-sm">
        <div>
          <p className="text-gray-500 text-sm">Clock In:</p>
          <p className="font-semibold ">{clockinTime}</p>
        </div>
        <div>
          <p className="text-gray-500 text-sm">Clock Out:</p>
          <p className="font-semibold">{clockoutTime}</p>
        </div>
        <div>
          <p className="text-gray-500 text-sm">Working Time:</p>
          <p className="font-semibold">{`${duration.hours()}h ${duration.minutes()}m`}</p>
        </div>
        <div>
          <p className="text-gray-500 text-sm">IP Address:</p>
          <p className="font-semibold">{attendanceData?.ip}</p>
        </div>
        <div>
          <p className="text-gray-500 text-sm">Status:</p>
          <p className="font-semibold text-green-500">
            {attendanceData?.status}
          </p>
        </div>
        <div>
          <p className="text-gray-500 text-sm">Work Status:</p>
          <p className="font-semibold">{attendanceData?.workStatus}</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap justify-center gap-4 mt-6">
        <button
          className="border border-orange-500 text-[12px] py-0.5 text-orange-500 px-2 rounded cursor-pointer"
          onClick={handleBookLeave}
        >
          + Book Leave
        </button>
        <button
          className="border border-orange-500 text-[12px] py-0.5 text-orange-500 px-2 rounded cursor-pointer"
          onClick={handleForgot}
        >
          Forgot to Clock
        </button>
        <button
          className="border border-orange-500 text-[12px] py-0.5 text-orange-500 px-2 rounded cursor-pointer"
          onClick={opeAttendancelist}
        >
          View Calendar
        </button>
        <button
          className="border border-orange-500 text-[12px] py-0.5 text-orange-500 px-2 rounded cursor-pointer"
          onClick={handleConcern}
        >
          Employee Concern
        </button>
      </div>
    </div>
  );
}

export default Attendance;
