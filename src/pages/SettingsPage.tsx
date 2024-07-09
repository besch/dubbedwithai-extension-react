// src/components/SettingsPage.tsx
import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/store";
import { setSubtitleOffset } from "@/store/movieSlice";

const SettingsPage: React.FC = () => {
  const dispatch = useDispatch();
  const subtitleOffset = useSelector(
    (state: RootState) => state.movie.subtitleOffset
  );
  const [localOffset, setLocalOffset] = useState(subtitleOffset);

  useEffect(() => {
    setLocalOffset(subtitleOffset);
  }, [subtitleOffset]);

  const handleOffsetChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newOffset = parseFloat(event.target.value);
    setLocalOffset(newOffset);
  };

  const handleOffsetApply = () => {
    dispatch(setSubtitleOffset(localOffset));
  };

  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded-xl shadow-md space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">Subtitle Settings</h2>
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
      <button
        onClick={handleOffsetApply}
        className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        Apply Offset
      </button>
    </div>
  );
};

export default SettingsPage;
