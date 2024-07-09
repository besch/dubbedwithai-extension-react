import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { AppDispatch, RootState } from "@/store";
import { Search, Mic, User, Settings } from "lucide-react";
import { checkDubbingStatus } from "@/store/movieSlice";

const Navigation: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();

  const { isDubbingActive } = useSelector((state: RootState) => state.movie);

  if (location.pathname === "/auth") {
    return null;
  }

  const getIconClass = (path: string) => {
    const baseClass = "cursor-pointer transition-colors";
    const activeClass = "text-blue-600";
    const inactiveClass = "hover:text-blue-500";

    if (location.pathname === path) {
      return `${baseClass} ${activeClass}`;
    }
    return `${baseClass} ${inactiveClass}`;
  };

  const getMicIconClass = () => {
    const baseClass = "cursor-pointer transition-colors";
    const isDubbingPage = location.pathname === "/dubbing";

    if (isDubbingActive) {
      if (isDubbingPage) {
        return `${baseClass} animate-flash-blue-red`;
      } else {
        return `${baseClass} animate-flash-red`;
      }
    } else {
      return getIconClass("/dubbing");
    }
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    if (path === "/dubbing") {
      dispatch(checkDubbingStatus());
    }
  };

  return (
    <nav className="flex justify-between items-center p-4 bg-gray-100">
      <div className="flex items-center space-x-4">
        <h1
          className="text-2xl font-bold text-blue-600 cursor-pointer"
          onClick={() => handleNavigate("/")}
        >
          Dubabase
        </h1>
      </div>
      <div className="flex space-x-6">
        <Search
          className={getIconClass("/search")}
          onClick={() => handleNavigate("/search")}
          size={24}
        />
        <Mic
          className={getMicIconClass()}
          onClick={() => handleNavigate("/dubbing")}
          size={24}
        />
        <Settings
          className={getIconClass("/settings")}
          onClick={() => handleNavigate("/settings")}
          size={24}
        />
        <User
          className={getIconClass("/profile")}
          onClick={() => handleNavigate("/profile")}
          size={24}
        />
      </div>
    </nav>
  );
};

export default Navigation;
