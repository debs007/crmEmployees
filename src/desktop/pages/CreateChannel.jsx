import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/authContext";
import { useState } from "react";
function CreateChannel() {
  const navigate = useNavigate();
  const [channelName, setChannelName] = useState({
    channel: "",
  });
  const handleAddPeople = () => {
    navigate("/addpeople-channel", {
      state: {
        channelName,

      },
    });
  };

  const handleChange = (e) => {
    let name = e.target.name;
    let value = e.target.value;
    setChannelName({ ...channelName, [name]: value });
  };
  const handleSubmit = (e) => {
    e.preventDefault();
  };
  return (
    <div className="w-full p-4 border-b-2 border-orange-400 space-y-2 ">
      <h2 className="text-[14px] font-medium">Create a channel</h2>
      <p className="text-[13px]">Name</p>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          name="channel"
          id="channel"
          onChange={handleChange}
          value={channelName.channel}
          className="border-b-2 border-gray-300 outline-none w-full  text-[12px] p-1"
          placeholder="project-peigon"
        />
        <div className="flex justify-end mt-4">
          <button
            className="text-[12px] text-orange-400 border border-orange-400 rounded px-3 cursor-pointer"
            onClick={handleAddPeople}
          >
            Next
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateChannel;
