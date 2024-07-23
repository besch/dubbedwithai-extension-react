import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState, AppDispatch } from "@/store";
import {
  setSubtitleOffset,
  resetSubtitleOffset,
  setDubbingVolumeMultiplier,
} from "@/store/movieSlice";
import PageLayout from "@/components/ui/PageLayout";
import Button from "@/components/ui/Button";
import { millisecondsToTimeString } from "@/extension/utils";
import { toast } from "react-toastify";
import config from "@/extension/content/config";
import { DubbingMessage } from "@/extension/content/types";

const SettingsPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { subtitleOffset, dubbingVolumeMultiplier } = useSelector(
    (state: RootState) => state.movie
  );
  const [localOffset, setLocalOffset] = useState(subtitleOffset);
  const [localDubbingVolume, setLocalDubbingVolume] = useState(
    dubbingVolumeMultiplier
  );
  const [currentTime, setCurrentTime] = useState(0);
  const [adjustedTime, setAdjustedTime] = useState(0);

  useEffect(() => {
    setLocalOffset(subtitleOffset);
    setLocalDubbingVolume(dubbingVolumeMultiplier);
  }, [subtitleOffset, dubbingVolumeMultiplier]);

  useEffect(() => {
    const messageListener = (message: any) => {
      if (message.action === "updateCurrentTime") {
        setCurrentTime(message.currentTime);
        setAdjustedTime(message.adjustedTime);
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    return () => chrome.runtime.onMessage.removeListener(messageListener);
  }, []);

  const handleOffsetChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLocalOffset(parseFloat(event.target.value));
  };

  const handleDubbingVolumeChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setLocalDubbingVolume(parseFloat(event.target.value));
  };

  const handleApplyChanges = () => {
    dispatch(setSubtitleOffset(localOffset));
    dispatch(setDubbingVolumeMultiplier(localDubbingVolume));
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "setDubbingVolumeMultiplier",
          payload: localDubbingVolume,
        } as DubbingMessage);
      }
    });
    toast.success("Settings applied successfully!");
  };

  const handleReset = () => {
    dispatch(resetSubtitleOffset());
    dispatch(setDubbingVolumeMultiplier(1));
    setLocalOffset(0);
    setLocalDubbingVolume(1);
    toast.success("Settings reset to default!");
  };

  return (
    <PageLayout title="Dubbing Settings">
      <div className="space-y-6">
        <div className="bg-secondary p-4 rounded-lg shadow-inner">
          <div className="flex justify-between text-sm font-medium">
            <span>Current: {millisecondsToTimeString(currentTime)}</span>
            <span>Adjusted: {millisecondsToTimeString(adjustedTime)}</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <label className="w-24 text-sm font-medium">Subtitle Offset</label>
            <input
              type="range"
              min="-10"
              max="10"
              step="0.1"
              value={localOffset}
              onChange={handleOffsetChange}
              className="flex-grow h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
            />
            <span className="w-16 text-right">{localOffset.toFixed(1)}s</span>
          </div>

          <div className="flex items-center space-x-4">
            <label className="w-24 text-sm font-medium">Dubbing Volume</label>
            <input
              type="range"
              min="0"
              max={config.maxDubbingVolumeMultiplier}
              step="0.1"
              value={localDubbingVolume}
              onChange={handleDubbingVolumeChange}
              className="flex-grow h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
            />
            <span className="w-16 text-right">
              {(localDubbingVolume * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        <div className="flex space-x-4 pt-4">
          <Button
            onClick={handleApplyChanges}
            variant="primary"
            className="flex-1"
          >
            Apply Changes
          </Button>
          <Button onClick={handleReset} variant="outline" className="flex-1">
            Reset to Default
          </Button>
        </div>
      </div>
    </PageLayout>
  );
};

export default SettingsPage;
