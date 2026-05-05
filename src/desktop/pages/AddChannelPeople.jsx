import { useEffect, useState } from "react";
import search from "../../assets/desktop/search.svg";
import { IoIosClose } from "react-icons/io";
import { useAuth } from "../../context/authContext";
import { useLocation, useNavigate } from "react-router-dom";

function AddChannelPeople() {
  const { getAllUsers } = useAuth();
  const [members, setMembers] = useState([])
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPeople, setSelectedPeople] = useState([]);
  const [filteredPeople, setFilteredPeople] = useState([]);
  const [allPeople, setAllPeople] = useState([]); // Stores API response
  const [showDropdown, setShowDropdown] = useState(false);
  const location = useLocation();
  const channelName = location?.state.channelName?.channel;
  const token = localStorage.getItem("token");
  const navigate = useNavigate()

  const getPersonId = (person) => person?._id || person?.id || "";


  const handleButton = async () => {
    try {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_API}/api/create`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ name: channelName, members: members.filter(Boolean) })
        });
      if (response.ok) {

      }
    } catch (error) {
      console.log(error)
    }
    navigate("/", { replace: true });
    window.location.reload();
  }

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await getAllUsers();
        if (response && Array.isArray(response)) {
          setAllPeople(response); // Store API response
        }
      } catch (error) {
        console.log(error);
      }
    };
    fetchUsers();
  }, []);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);

    if (value.length === 0) {
      // If input is empty, show all users
      setFilteredPeople(allPeople);
    } else {
      // Filter based on input
      setFilteredPeople(
        allPeople.filter((person) =>
          person.name.toLowerCase().includes(value.toLowerCase())
        )
      );
    }

    setShowDropdown(true);
  };

  const handleInputFocus = () => {
    setFilteredPeople(allPeople); // Show all users when input is clicked
    setShowDropdown(true);
  };

  const handleSelectPerson = (id, name) => {
    if (!id) return;
    if (!selectedPeople.some((p) => p.id === id)) {
      setSelectedPeople([...selectedPeople, { id, name }]);
      setMembers((prevMembers) => [...prevMembers, id]); // Append new id to members array
    }
    setSearchTerm("");
    setShowDropdown(false);
  };


  const removePerson = (person) => {
    setSelectedPeople(selectedPeople.filter((p) => p.id !== person.id));
    setMembers((prevMembers) => prevMembers.filter((memberId) => memberId !== person.id));
  };


  return (
    <div className="relative w-full border-b-2 border-orange-400 p-4 space-y-2">
      <h2 className="text-[14px] font-medium">Add People</h2>

      {/* Search Box */}
      <div className="relative bg-gray-200 rounded flex gap-2 px-4 py-2">
        <img src={search} alt="Search" className="w-5 h-5" />
        <input
          type="text"
          placeholder="Search for people"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={handleInputFocus} // Show all users on first click
          className="outline-none w-full text-[12px] p-1"
        />
      </div>

      {/* Dropdown for Suggestions */}
      {showDropdown && filteredPeople.length > 0 && (
        <div className="absolute top-full left-0 w-full bg-white border border-gray-300 rounded shadow-md mt-1 z-10">
          {filteredPeople.map((person) => (
            <div
              key={getPersonId(person)}
              className="p-2 cursor-pointer hover:bg-gray-100"
              onClick={() => handleSelectPerson(getPersonId(person), person.name)}
            >
              {person.name}
            </div>
          ))}
        </div>
      )}

      {/* Selected People */}
      {selectedPeople.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedPeople.map((person, i) => (
            <div
              key={i}
              className="bg-orange-200 text-orange-800 px-2 py-1 rounded flex items-center"
            >
              {person.name}
              <button
                onClick={() => removePerson(person)}
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
        <button className="text-[12px] text-orange-400 border border-orange-400 rounded px-3 cursor-pointer" onClick={handleButton}>
          Create
        </button>
      </div>
    </div>
  );
}

export default AddChannelPeople;
