import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState, AppDispatch } from "@/store";
import { setSubtitleOffset, resetSubtitleOffset } from "@/store/movieSlice";
import PageLayout from "@/components/ui/PageLayout";
import Button from "@/components/ui/Button";
import { millisecondsToTimeString } from "@/extension/utils";
import { toast } from "react-toastify";

const SettingsPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { subtitleOffset } = useSelector((state: RootState) => state.movie);
  const [localOffset, setLocalOffset] = useState(subtitleOffset);
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
  };

  const handleOffsetAdjust = (amount: number) => {
    const newOffset = Math.round((localOffset + amount) * 10) / 10;
    setLocalOffset(newOffset);
  };

  const handleOffsetApply = () => {
    dispatch(setSubtitleOffset(localOffset));
    toast.success("Offset has been applied successfully!");
  };

  const handleOffsetReset = () => {
    dispatch(resetSubtitleOffset());
    setLocalOffset(0);
    toast.success("Offset has been reset successfully!");
  };

  return (
    <PageLayout title="Subtitle Settings">
      <div className="space-y-4">
        <div className="flex justify-between items-center bg-secondary p-3 rounded-md">
          <div className="text-sm font-medium">
            <span className="text-white">Current Time:</span>{" "}
            <span className="text-white">
              {millisecondsToTimeString(currentTime)}
            </span>
          </div>
          <div className="text-sm font-medium">
            <span className="text-white">Adjusted Time:</span>{" "}
            <span className="text-white">
              {millisecondsToTimeString(adjustedTime)}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <label
            htmlFor="subtitleOffset"
            className="block text-lg font-semibold text-foreground"
          >
            Subtitle Offset
          </label>
          <div className="flex items-center space-x-4">
            <Button
              onClick={() => handleOffsetAdjust(-0.5)}
              variant="outline"
              size="sm"
            >
              -0.5s
            </Button>
            <input
              type="range"
              id="subtitleOffset"
              min="-100"
              max="100"
              step="0.1"
              value={localOffset}
              onChange={handleOffsetChange}
              className="flex-grow h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
            />
            <Button
              onClick={() => handleOffsetAdjust(0.5)}
              variant="outline"
              size="sm"
            >
              +0.5s
            </Button>
          </div>
          <div className="flex justify-between text-sm text-white">
            <span>-100s</span>
            <span>0s</span>
            <span>+100s</span>
          </div>
          <div className="text-center text-2xl font-bold text-white">
            {localOffset.toFixed(1)}s
          </div>
        </div>

        <div className="flex space-x-4">
          <Button
            onClick={handleOffsetApply}
            variant="primary"
            className="flex-1 py-2"
          >
            Apply Offset
          </Button>
          <Button
            onClick={handleOffsetReset}
            variant="outline"
            className="flex-1 py-2"
          >
            Reset Offset
          </Button>
        </div>
      </div>
    </PageLayout>
  );
};

export default SettingsPage;
