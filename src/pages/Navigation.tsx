import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/store";
import { Search, Mic, User } from "lucide-react";
import { updateDubbingState } from "@/store/movieSlice";

const Navigation: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { isDubbingActive } = useSelector((state: RootState) => state.movie);

  useEffect(() => {
    const messageListener = (message: any) => {
      if (message.action === "updateDubbingState") {
        dispatch(updateDubbingState(message.payload));
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, [dispatch]);

  if (location.pathname === "/auth") {
    return null;
  }

  return (
    <nav className="flex justify-between items-center p-4 bg-gray-100">
      <div className="flex items-center space-x-4">
        <h1
          className="text-2xl font-bold text-blue-600 cursor-pointer"
          onClick={() => navigate("/")}
        >
          Dubabase
        </h1>
      </div>
      <div className="flex space-x-6">
        <Search
          className="cursor-pointer hover:text-blue-500 transition-colors"
          onClick={() => navigate("/search")}
          size={24}
        />
        <Mic
          className={`cursor-pointer hover:text-blue-500 transition-colors ${
            isDubbingActive ? "text-red-500 animate-flicker" : ""
          }`}
          onClick={() => navigate("/dubbing")}
          size={24}
        />
        <User
          className="cursor-pointer hover:text-blue-500 transition-colors"
          onClick={() => navigate("/profile")}
          size={24}
        />
      </div>
    </nav>
  );
};

export default Navigation;
