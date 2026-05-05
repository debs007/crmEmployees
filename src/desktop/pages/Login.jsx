import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaEnvelope, FaLock } from "react-icons/fa";
import { useAuth } from "../../context/authContext";
import logo from "../../assets/desktop/logo.svg";

function Login() {
  const { setToken } = useAuth(); // Context for setting token
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_API}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      // Store token
      localStorage.setItem("token", data.token);
      setToken(data.token);
      

      // Redirect to home or the intended page
      navigate("/");
      window.location.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-96 text-center">
        <div className="flex justify-center">
          <img src={logo} alt="Logo" className="h-50" />
        </div>

        {/* Error Message */}
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}

        <form onSubmit={handleLogin}>
          <div className="relative mb-4">
            <div className="absolute left-4 top-4 text-gray-500">
              <FaEnvelope />
            </div>
            <input
              type="email"
              placeholder="Enter email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-full bg-gray-100 focus:outline-none"
              required
            />
          </div>

          <div className="relative mb-6">
            <FaLock className="absolute left-4 top-4 text-gray-500" />
            <input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-full bg-gray-100 focus:outline-none"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-orange-500 text-white rounded-full hover:bg-orange-600 transition"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
