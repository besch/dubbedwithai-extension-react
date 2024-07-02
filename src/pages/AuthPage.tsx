import React from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { login } from "@/store/authSlice";
import { AppDispatch, RootState } from "@/store";

const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { loading, error } = useSelector((state: RootState) => state.auth);

  const handleLogin = async () => {
    try {
      await dispatch(login()).unwrap();
      navigate("/search");
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-4">
      <h2 className="mb-4 text-xl font-bold">Welcome to Dubabase</h2>
      <p className="mb-4 text-center text-gray-600">
        Please log in to access the movie dubbing features.
      </p>
      {error && <p className="text-red-500 mb-2">{error}</p>}
      <button
        onClick={handleLogin}
        disabled={loading}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition duration-200 disabled:opacity-50"
      >
        {loading ? "Logging in..." : "Login with Google"}
      </button>
    </div>
  );
};

export default AuthPage;
