import { useEffect, useState } from "react";
import searchIcon from "../../assets/desktop/search.svg";
import { IoIosClose } from "react-icons/io";
import { useAuth } from "../../context/authContext";
import { useNavigate } from "react-router-dom";

function AddCoworkers() {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const { getAllUsers } = useAuth();
  const navigate=useNavigate();

  useEffect(() => {
    const fetchUsers = async () => {
      const userList = await getAllUsers();
      setUsers(userList);
      setFilteredUsers(userList); // Show all users by default
    };
    fetchUsers();
  }, []);

  const handleCreate=()=>{
    navigate("/chat",{
      state:{
        name:selectedUsers[0].name,id: selectedUsers[0].id
      }
    })
  }

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);

    // Show all users if input is empty, otherwise filter
    if (value.trim() === "") {
      setFilteredUsers(users);
    } else {
      setFilteredUsers(
        users.filter((user) =>
          user.name.toLowerCase().includes(value.toLowerCase())
        )
      );
    }

    setShowDropdown(true);
  };

  // Show all users when input is focused
  const handleInputFocus = () => {
    setFilteredUsers(users);
    setShowDropdown(true);
  };

  const handleSelectUser = (user) => {
    if (!selectedUsers.some((u) => u._id === user._id)) {
      setSelectedUsers([...selectedUsers, user]);
    }
    setSearchTerm("");
    setShowDropdown(false);
  };

  const removeUser = (userId) => {
    setSelectedUsers(selectedUsers.filter((user) => user._id !== userId));
  };

  return (
    <div className="relative w-full border-b-2 border-orange-400 p-4 space-y-2">
      <h2 className="text-[14px] font-medium">Add Coworkers</h2>

      {/* Search Box */}
      <div className="relative bg-gray-200 rounded flex gap-2 px-4 py-2">
        <img src={searchIcon} alt="Search" className="w-5 h-5" />
        <input
          type="text"
          placeholder="Search for coworkers"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          className="outline-none w-full text-[12px] p-1"
        />
      </div>

      {/* Dropdown for Suggestions */}
      {showDropdown && filteredUsers.length > 0 && (
        <div className="max-h-[415px] absolute overflow-y-auto top-full left-0 w-full bg-white border border-gray-300 rounded shadow-md mt-1 z-10">
          {filteredUsers.map((user) => (
            <div
              key={user._id}
              className="p-2 cursor-pointer hover:bg-gray-100"
              onClick={() => handleSelectUser(user)}
            >
              {user.name}
            </div>
          ))}
        </div>
      )}

      {/* Selected Users */}
      {selectedUsers.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedUsers.map((user) => (
            <div
              key={user._id}
              className="bg-orange-200 text-orange-800 px-2 py-1 rounded flex items-center"
            >
              {user.name}
              <button
                onClick={() => removeUser(user._id)}
                className="ml-2 text-red-600 hover:text-red-800"
              >
                <IoIosClose size={25} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create Button */}
      <div className="flex justify-end">
        <button className="text-[12px] text-orange-400 border border-orange-400 rounded px-3 cursor-pointer" onClick={handleCreate}>
          Create Chat
        </button>
      </div>
    </div>
  );
}

export default AddCoworkers;
