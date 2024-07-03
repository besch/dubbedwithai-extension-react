// src/components/Navigation.tsx

import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { Search, Mic, User } from "lucide-react";

const Navigation: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isDubbingActive } = useSelector((state: RootState) => state.movie);

  if (location.pathname === "/auth") {
    return null;
  }

  return (
    <nav className="flex justify-between items-center p-4 bg-gray-100">
      <div className="flex space-x-4">
        <Search
          className="cursor-pointer"
          onClick={() => navigate("/search")}
          size={24}
        />
        <Mic
          className={`cursor-pointer ${
            isDubbingActive ? "text-red-500 animate-flicker" : ""
          }`}
          onClick={() => navigate("/dubbing")}
          size={24}
        />
        <User
          className="cursor-pointer"
          onClick={() => navigate("/profile")}
          size={24}
        />
      </div>
    </nav>
  );
};

export default Navigation;
