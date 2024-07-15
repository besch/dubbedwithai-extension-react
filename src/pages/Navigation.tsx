import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { AppDispatch, RootState } from "@/store";
import { Search, Mic, User, Settings } from "lucide-react";
import { checkDubbingStatus } from "@/store/movieSlice";
import { cn } from "@/lib/utils";

const Navigation: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();

  const { isDubbingActive } = useSelector((state: RootState) => state.movie);

  if (location.pathname === "/auth") {
    return null;
  }

  const getIconClass = (path: string) => {
    return cn(
      "cursor-pointer transition-colors",
      location.pathname === path
        ? "text-foreground"
        : "text-muted-foreground hover:text-foreground"
    );
  };

  const getMicIconClass = () => {
    const isDubbingPage = location.pathname === "/dubbing";

    return cn(
      "cursor-pointer transition-colors",
      {
        "animate-flash-blue-red": isDubbingActive && isDubbingPage,
        "animate-flash-red": isDubbingActive && !isDubbingPage,
      },
      !isDubbingActive && getIconClass("/dubbing")
    );
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    if (path === "/dubbing") {
      dispatch(checkDubbingStatus());
    }
  };

  return (
    <nav className="flex justify-between items-center p-4 bg-background border-b border-border">
      <div className="flex items-center space-x-4">
        <h1 className="text-2xl font-bold text-foreground">Dubabase</h1>
      </div>
      <div className="flex space-x-6 items-center">
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
