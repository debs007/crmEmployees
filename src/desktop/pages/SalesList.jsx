import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import moment from "moment";
import { FaEye } from "react-icons/fa";
import { MdDelete } from "react-icons/md";
import { onSoftRefresh } from "../../utils/socket";
function SalesList() {
  const navigate = useNavigate();
  const [sales, setSales] = useState([])
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 5;

  const fetchSalesList = async () => {
    const token = localStorage.getItem("token");
    try {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_API}/sale/user?page=${currentPage}&limit=${limit}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`, // Pass token in Authorization header
          },
        }
      );
      if (response.ok) {
        const data = await response.json();

        setSales(data?.data || []);
        console.log(data?.data)
        setTotalPages(data.totalPages || 1);
      }
    } catch (error) {
      console.error("Error fetching sales data:", error);
    }
  };
  useEffect(() => {
    const unsubscribe = onSoftRefresh((data) => {
      if (data.type === "Sale_Employee") {
        fetchSalesList();
      }
    });
    fetchSalesList();
    return () => unsubscribe(); // Cleanup on unmount

  }, [currentPage]);

  const deleteCallBack = async (id) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_API}/sale/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        console.log("Deleted successfully");
        setSales((prevSales) => prevSales.filter((item) => item._id !== id));
      } else {
        console.error("Failed to delete");
      }
    } catch (error) {
      console.error("Error deleting sale:", error);
    }
  };

  const handleView = (item) => {
    navigate("/salesview", {
      state: {
        item
      }
    })
  }
  const handleDelete = (id) => {
    if (!id) return
    deleteCallBack(id)
    fetchSalesList();
  }


  const handleNavigate = () => {
    navigate("/sales");
  };
  return (
    <div className=" p-4">
      <div className="border-b border-gray-300 p-4 flex justify-between">
        <h2 className="text-[15px] font-medium pb-2">View Sales</h2>
        <button
          className="border  border-orange-500 text-[12px] py-0.5 text-orange-500 px-2 rounded cursor-pointer"
          onClick={handleNavigate}
        >
          Create Sale
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
      <div className="overflow-x-auto p-4 mt-4">
        <table className="min-w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-[#D9D9D9] ">
              <th className="border border-gray-400 px-4 py-2 text-[15px] font-medium pt-4 pb-4">
                Created Date
              </th>
              <th className="border border-gray-400 px-4 py-2 text-[15px] font-medium pt-4 pb-4">
                Name
              </th>
              <th className="border border-gray-400 px-4 py-2 text-[15px] font-medium pt-4 pb-4">
                Email
              </th>
              <th className="border border-gray-400 px-4 py-2 text-[15px] font-medium pt-4 pb-4">
                Phone
              </th>
              <th className="border border-gray-400 px-4 py-2 text-[15px] font-medium pt-4 pb-4">
                Domain Name
              </th>
              <th className="border border-gray-400 px-4 py-2 text-[15px] font-medium pt-4 pb-4">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {sales.map((item, index) => (
              <tr key={index} className="text-[13px] text-gray-500">
                <td className="border border-gray-300 px-4 py-2  text-center">
                  {moment(item.createdAt).format("YYYY-MM-DD")}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-center">
                  {item.name}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-center">
                  {item.phone}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-center">
                  {item.email}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-center">
                  {item.domainName}
                </td>
                <td className="border space-x-2  border-gray-300 px-4 py-2 text-center">
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

export default SalesList;
