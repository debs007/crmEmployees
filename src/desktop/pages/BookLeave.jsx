import { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useAuth } from "../../context/authContext";

function BookLeave() {
  const { userData, allConcerns } = useAuth();
  const [selectedDate, setSelectedDate] = useState(null);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [leave, setLeave] = useState([]);
  const itemsPerPage = 5; // Limit to 5 items per page

  const fetchLeave = async () => {
    const response = await allConcerns("Book Leave");
    if (response && response.length) {
      setLeave(response);
      setTotalPages(Math.ceil(response.length / itemsPerPage));
      setCurrentPage(1); // Reset to first page on new fetch
    } else {
      setLeave([]);
      setTotalPages(1);
    }
  };

  useEffect(() => {
    fetchLeave();
  }, []);

  const handleSubmit = async () => {
    if (!selectedDate || !comment) {
      alert("Please select a date and enter a comment.");
      return;
    }

    setLoading(true);

    const adjustForTimezone = (date) => {
      const timezoneOffset = date.getTimezoneOffset() * 60000; // Convert offset to milliseconds
      return new Date(date.getTime() - timezoneOffset);
    };
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_API}/concern/submit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({
            ConcernDate: adjustForTimezone(selectedDate).toISOString().split("T")[0], // Corrected date
            message: comment,
            concernType: "Book Leave",
          }),
          
        }
      );

      if (response.ok) {
        alert("Leave request submitted successfully!");
        setSelectedDate(null);
        setComment("");
        fetchLeave();
      } else {
        alert("Failed to submit leave request.");
      }
    } catch (error) {
      console.error("Error submitting leave request:", error);
      alert("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentConcerns = leave.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div className="w-full p-4  space-y-2">
      <h2 className="text-[14px] font-medium">Book Leave</h2>

      <div className="flex items-center space-x-4">
        <DatePicker
          selected={selectedDate}
          onChange={(date) => setSelectedDate(date)}
          dateFormat="yyyy-MM-dd"
          placeholderText="Select a Date"
          className="border px-4 py-2 outline-none border-gray-400 text-[12px]"
        />

        <input
          type="text"
          placeholder="Comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="border px-4 py-2 w-full rounded text-[14px] outline-none border-gray-400"
        />
      </div>

      <div>
        <button
          onClick={handleSubmit}
          className="text-[12px] text-orange-400 border border-orange-400 rounded px-3 cursor-pointer"
          disabled={loading}
        >
          {loading ? "Submitting..." : "Submit"}
        </button>
      </div>

      <div>
        {currentConcerns.length > 0 ? (
          <div className="my-6 overflow-x-auto">
            <table className="min-w-full border border-gray-300 rounded-lg shadow-md">
              <thead className="bg-gray-200">
                <tr>
                  <th className="py-2 px-4 border-b text-left">Date</th>
                  <th className="py-2 px-4 border-b text-left">Message</th>
                  <th className="py-2 px-4 border-b text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {currentConcerns.map((query, i) => (
                  <tr key={i} className="hover:bg-gray-100 text-[14px]">
                    <td className="py-2 px-4 border-b">{query.ConcernDate}</td>
                    <td className="py-2 px-4 border-b">{query.message}</td>
                    <td className="py-2 px-4 border-b">{query.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            <div className="flex justify-center mt-4">
              <button
                className="mx-1 border border-orange-500 text-[12px] py-0.5 text-orange-500 px-2 rounded cursor-pointer"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                Previous
              </button>

              <span className="border border-orange-500 text-[12px] py-0.5 text-orange-500 px-2 rounded">
                Page {currentPage} of {totalPages}
              </span>

              <button
                className="mx-1 border border-orange-500 text-[12px] py-0.5 text-orange-500 px-2 rounded cursor-pointer"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                Next
              </button>
            </div>
          </div>
        ) : (
          <p className="text-center text-gray-500 mt-4">No Booked Leave yet.</p>
        )}
      </div>
    </div>
  );
}

export default BookLeave;
