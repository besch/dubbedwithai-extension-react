import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/store";
import { setSubtitleOffset, resetSubtitleOffset } from "@/store/movieSlice";

const formatTime = (time: number): string => {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
};

const SettingsPage: React.FC = () => {
  const dispatch = useDispatch();
  const { subtitleOffset } = useSelector((state: RootState) => state.movie);
  const [localOffset, setLocalOffset] = useState(subtitleOffset);
  const [isApplied, setIsApplied] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [adjustedTime, setAdjustedTime] = useState(0);

  useEffect(() => {
    setLocalOffset(subtitleOffset);
  }, [subtitleOffset]);

  useEffect(() => {
    const messageListener = (message: any) => {
      if (message.action === "updateCurrentTime") {
        setCurrentTime(message.currentTime);
        setAdjustedTime(message.adjustedTime);
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, []);

  const handleOffsetChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newOffset = parseFloat(event.target.value);
    setLocalOffset(newOffset);
    setIsApplied(false);
  };

  const handleOffsetApply = () => {
    dispatch(setSubtitleOffset(localOffset));
    setIsApplied(true);
    setTimeout(() => setIsApplied(false), 2000);
  };

  const handleOffsetReset = () => {
    dispatch(resetSubtitleOffset());
    setIsApplied(true);
    setTimeout(() => setIsApplied(false), 2000);
  };

  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded-xl shadow-md space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">Subtitle Settings</h2>

      <div className="space-y-2">
        <p className="text-sm text-gray-600">
          Time: {formatTime(currentTime)} | Adjusted: {formatTime(adjustedTime)}
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="subtitleOffset"
          className="block text-sm font-medium text-gray-700"
        >
          Subtitle Offset (seconds)
        </label>
        <input
          type="range"
          id="subtitleOffset"
          min="-10"
          max="10"
          step="0.1"
          value={localOffset}
          onChange={handleOffsetChange}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-sm text-gray-600">
          <span>-10s</span>
          <span>0s</span>
          <span>+10s</span>
        </div>
        <div className="text-center text-lg font-semibold text-blue-600">
          {localOffset.toFixed(1)}s
        </div>
      </div>

      <div className="flex space-x-2">
        <button
          onClick={handleOffsetApply}
          className={`flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
            isApplied ? "bg-green-600" : "bg-blue-600 hover:bg-blue-700"
          } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200`}
        >
          {isApplied ? "Applied!" : "Apply Offset"}
        </button>
        <button
          onClick={handleOffsetReset}
          className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
        >
          Reset Offset
        </button>
      </div>

      {isApplied && (
        <div className="text-center text-green-600 font-medium animate-pulse">
          Offset has been applied successfully!
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
