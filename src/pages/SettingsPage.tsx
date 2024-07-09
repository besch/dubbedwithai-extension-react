import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState, AppDispatch } from "@/store";
import { setSubtitleOffset, resetSubtitleOffset } from "@/store/movieSlice";
import PageLayout from "@/components/ui/PageLayout";
import Button from "@/components/ui/Button";

const formatTime = (time: number): string => {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
};

const SettingsPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
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
    <PageLayout title="Subtitle Settings">
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Time: {formatTime(currentTime)} | Adjusted:{" "}
            {formatTime(adjustedTime)}
          </p>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="subtitleOffset"
            className="block text-sm font-medium text-foreground"
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
            className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>-10s</span>
            <span>0s</span>
            <span>+10s</span>
          </div>
          <div className="text-center text-lg font-semibold text-primary">
            {localOffset.toFixed(1)}s
          </div>
        </div>

        <div className="flex space-x-2">
          <Button
            onClick={handleOffsetApply}
            variant={isApplied ? "secondary" : "primary"}
            className="flex-1"
          >
            {isApplied ? "Applied!" : "Apply Offset"}
          </Button>
          <Button
            onClick={handleOffsetReset}
            variant="outline"
            className="flex-1"
          >
            Reset Offset
          </Button>
        </div>

        {isApplied && (
          <div className="text-center text-primary font-medium animate-pulse">
            Offset has been applied successfully!
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default SettingsPage;
