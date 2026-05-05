import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { FaEye } from "react-icons/fa";
import { MdDelete } from "react-icons/md";
import moment from "moment";
import { onSoftRefresh } from "../../utils/socket";
function CallbackList() {
  const [data, setData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const limit = 5;
  const navigate = useNavigate();

  useEffect(() => {

    const unsubscribe = onSoftRefresh((data) => {
      if (data.type === "Callback") {
        fetchData(currentPage);
      }

    });

    
      fetchData(currentPage);
    return () => unsubscribe(); // Cleanup on unmount

  }, [currentPage]);

  const fetchData = async (page) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_API}/callback/user?page=${page}&limit=${limit}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`, // Pass token in Authorization header
          },
        }
      );
      const result = await response.json();
      setData(result.data || []);
      setTotalPages(result.totalPages || 1);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const deleteCallBack = async (id) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_API}/callback/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        console.log("Deleted successfully");
        setData((prevSales) => prevSales.filter((item) => item._id !== id));
      } else {
        console.error("Failed to delete");
      }
    } catch (error) {
      console.error("Error deleting sale:", error);
    }
  };

  const handleView = (item) => {
    navigate("/callbackview", {
      state: {
        item
      }
    })
  }

  const handleDelete = (id) => {
    if (!id) return
    deleteCallBack(id)
  }



  const handleNavigate = () => {
    navigate("/callback");
  };

  return (
    <div className="p-4">
      <div className="border-b border-gray-300 p-4 flex justify-between">
        <h2 className="text-[15px] font-medium pb-2">View Callback</h2>
        <button
          className="border border-orange-500 text-[12px] py-0.5 text-orange-500 px-2 rounded cursor-pointer"
          onClick={handleNavigate}
        >
          Create Callback
        </button>
      </div>
      <div className="pt-6 flex gap-4 justify-start">
        <button className="border px-4 rounded text-[12px] font-medium pt-1 pb-1">
          Select Month
        </button>
        <button className="border px-4 rounded text-[12px] font-medium pt-1 pb-1">
          Select Year
        </button>
        <button className="border px-4 rounded text-[12px] font-medium pt-1 pb-1">
          Select Date
        </button>
        <button className="border px-4 rounded text-[12px] font-medium pt-1 pb-1">
          Select Date
        </button>
      </div>
      {/* Table */}
      <div className="overflow-x-auto p-4 mt-4">
        <table className="min-w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-[#D9D9D9] text-[14px]">
              <th className="border px-3 py-2">Created Date</th>
              {/* <th className="border px-3 py-2">Created By</th> */}
              <th className="border px-3 py-2">Name</th>
              <th className="border px-3 py-2">Email</th>
              <th className="border px-3 py-2">Phone</th>
              {/* <th className="border px-3 py-2">Call Date</th> */}
              <th className="border px-3 py-2">Domain Name</th>
              <th className="border px-3 py-2">Address</th>
              {/* <th className="border px-3 py-2">Comments</th>
              <th className="border px-3 py-2">Budget</th>
              <th className="border px-3 py-2">Sent To</th>
              <th className="border px-3 py-2">Action</th> */}
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr key={index} className="text-[13px] text-gray-500 text-center">
                <td className="border px-3 py-2">{moment(item.createdAt).format("YYYY-MM-DD")}</td>
                {/* <td className="border px-3 py-2">{item.createdBy}</td> */}
                <td className="border px-3 py-2">{item.name}</td>
                <td className="border px-3 py-2">{item.email}</td>
                <td className="border px-3 py-2">{item.phone}</td>
                {/* <td className="border px-3 py-2">{item.callDate}</td> */}
                <td className="border px-3 py-2">{item.domainName}</td>
                {/* <td className="border px-3 py-2">{item.address}</td> */}
                {/* <td className="border px-3 py-2">{item.comments}</td>
                <td className="border px-3 py-2">{item.budget}</td>
                <td className="border px-3 py-2">{item.sentTo}</td> */}
                <td className="border px-3 space-x-2 py-2">
                  <button className="border border-orange-500 text-[12px] py-1 text-orange-500 px-2 rounded cursor-pointer" onClick={() => { handleView((item)) }}>
                    <FaEye />
                  </button>
                  <button className="border border-red-500 text-[12px] py-1 text-red-500 px-2 rounded cursor-pointer" onClick={() => { handleDelete(item?._id) }}>
                    <MdDelete />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-center mt-4">
        <button
          className=" mx-1 border border-orange-500 text-[12px] py-0.5 text-orange-500 px-2 rounded cursor-pointer"
          disabled={currentPage === 1}
          onClick={() => setCurrentPage(currentPage - 1)}
        >
          Previous
        </button>
        <span className="border border-orange-500 text-[12px] py-0.5 text-orange-500 px-2 rounded cursor-pointer">
          Page {currentPage} of {totalPages}
        </span>
        <button
          className=" mx-1 border border-orange-500 text-[12px] py-0.5 text-orange-500 px-2 rounded cursor-pointer"
          disabled={currentPage === totalPages}
          onClick={() => setCurrentPage(currentPage + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default CallbackList;
