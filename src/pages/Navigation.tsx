import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "@/store";
import { logout } from "@/store/authSlice";

const Navigation: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

  const handleLogout = async () => {
    try {
      await dispatch(logout()).unwrap();
      navigate("/auth");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (location.pathname === "/auth") {
    return null;
  }

  return (
    <nav className="flex justify-between items-center p-4 bg-gray-100">
      <h1 className="text-xl font-bold">Dubabase</h1>
      {isAuthenticated && (
        <button
          onClick={handleLogout}
          className="text-blue-500 hover:text-blue-700"
        >
          Logout
        </button>
      )}
    </nav>
  );
};

export default Navigation;
