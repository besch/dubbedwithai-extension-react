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

  const handleOffsetAdjust = (amount: number) => {
    const newOffset = Math.round((localOffset + amount) * 10) / 10;
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
    setLocalOffset(0);
    setIsApplied(true);
    setTimeout(() => setIsApplied(false), 2000);
  };

  return (
    <PageLayout title="Subtitle Settings">
      <div className="space-y-4">
        <div className="flex justify-between items-center bg-secondary p-3 rounded-md">
          <div className="text-sm font-medium">
            <span className="text-white">Current Time:</span>{" "}
            <span className="text-white">{formatTime(currentTime)}</span>
          </div>
          <div className="text-sm font-medium">
            <span className="text-white">Adjusted Time:</span>{" "}
            <span className="text-white">{formatTime(adjustedTime)}</span>
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
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>-100s</span>
            <span>0s</span>
            <span>+100s</span>
          </div>
          <div className="text-center text-2xl font-bold text-primary">
            {localOffset.toFixed(1)}s
          </div>
        </div>

        <div className="flex space-x-4">
          <Button
            onClick={handleOffsetApply}
            variant={isApplied ? "secondary" : "primary"}
            className="flex-1 py-2"
          >
            {isApplied ? "Applied!" : "Apply Offset"}
          </Button>
          <Button
            onClick={handleOffsetReset}
            variant="outline"
            className="flex-1 py-2"
          >
            Reset Offset
          </Button>
        </div>

        {isApplied && (
          <div className="text-center text-lg text-primary font-semibold animate-pulse bg-primary/10 p-2 rounded-md">
            Offset has been applied successfully!
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default SettingsPage;
