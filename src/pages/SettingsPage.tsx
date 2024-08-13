import React, { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState, AppDispatch } from "@/store";
import {
  setSubtitleOffset,
  resetSubtitleOffset,
  setDubbingVolumeMultiplier,
  setVideoVolumeWhilePlayingDubbing,
} from "@/store/movieSlice";
import PageLayout from "@/components/ui/PageLayout";
import Button from "@/components/ui/Button";
import { millisecondsToTimeString } from "@/extension/utils";
import { toast } from "react-toastify";
import config from "@/extension/content/config";
import { DubbingMessage } from "@/types";
import { createPopper, Instance as PopperInstance } from "@popperjs/core";
import { Info } from "lucide-react";

const SettingsPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const {
    subtitleOffset,
    dubbingVolumeMultiplier,
    videoVolumeWhilePlayingDubbing,
  } = useSelector((state: RootState) => state.movie);
  const [localOffset, setLocalOffset] = useState(subtitleOffset);
  const [localDubbingVolume, setLocalDubbingVolume] = useState(
    dubbingVolumeMultiplier
  );
  const [localVideoVolume, setLocalVideoVolume] = useState(
    videoVolumeWhilePlayingDubbing
  );
  const [currentTime, setCurrentTime] = useState(0);
  const [adjustedTime, setAdjustedTime] = useState(0);

  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const popperInstanceRef = useRef<PopperInstance | null>(null);

  useEffect(() => {
    setLocalOffset(subtitleOffset);
    setLocalDubbingVolume(dubbingVolumeMultiplier);
    setLocalVideoVolume(videoVolumeWhilePlayingDubbing);
  }, [subtitleOffset, dubbingVolumeMultiplier, videoVolumeWhilePlayingDubbing]);

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

  useEffect(() => {
    if (activeTooltip && tooltipRef.current) {
      const targetElement = document.getElementById(activeTooltip);
      if (targetElement) {
        popperInstanceRef.current = createPopper(
          targetElement,
          tooltipRef.current,
          {
            placement: "bottom",
            modifiers: [
              {
                name: "offset",
                options: {
                  offset: [0, 8],
                },
              },
            ],
          }
        );
      }
    }

    return () => {
      if (popperInstanceRef.current) {
        popperInstanceRef.current.destroy();
        popperInstanceRef.current = null;
      }
    };
  }, [activeTooltip]);

  const handleInfoMouseEnter = (id: string) => {
    setActiveTooltip(id);
  };

  const handleInfoMouseLeave = () => {
    setActiveTooltip(null);
  };

  const handleOffsetChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLocalOffset(parseFloat(event.target.value));
  };

  const handleDubbingVolumeChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setLocalDubbingVolume(parseFloat(event.target.value));
  };

  const handleVideoVolumeChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setLocalVideoVolume(parseFloat(event.target.value));
  };

  const handleApplyChanges = () => {
    dispatch(setSubtitleOffset(localOffset));
    dispatch(setDubbingVolumeMultiplier(localDubbingVolume));
    dispatch(setVideoVolumeWhilePlayingDubbing(localVideoVolume));
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "setDubbingVolumeMultiplier",
          payload: localDubbingVolume,
        } as DubbingMessage);
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "setVideoVolumeWhilePlayingDubbing",
          payload: localVideoVolume,
        } as DubbingMessage);
      }
    });
    toast.success("Settings applied successfully!");
  };

  const handleReset = () => {
    dispatch(resetSubtitleOffset());
    dispatch(setDubbingVolumeMultiplier(1));
    dispatch(
      setVideoVolumeWhilePlayingDubbing(config.videoVolumeWhilePlayingDubbing)
    );
    setLocalOffset(0);
    setLocalDubbingVolume(1);
    setLocalVideoVolume(config.videoVolumeWhilePlayingDubbing);
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

        <div className="space-y-6">
          <div className="bg-secondary p-4 rounded-lg shadow-inner">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Subtitle Offset</h3>
              <div
                id="subtitle-offset-info"
                className="cursor-help"
                onMouseEnter={() =>
                  handleInfoMouseEnter("subtitle-offset-info")
                }
                onMouseLeave={handleInfoMouseLeave}
              >
                <Info size={20} />
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <input
                type="range"
                min="-10"
                max="10"
                step="0.1"
                value={localOffset}
                onChange={handleOffsetChange}
                className="flex-grow h-2 rounded-lg appearance-none cursor-pointer"
              />
              <span className="w-16 text-right">{localOffset.toFixed(1)}s</span>
            </div>
          </div>

          <div className="bg-secondary p-4 rounded-lg shadow-inner">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Dubbing Volume</h3>
              <div
                id="dubbing-volume-info"
                className="cursor-help"
                onMouseEnter={() => handleInfoMouseEnter("dubbing-volume-info")}
                onMouseLeave={handleInfoMouseLeave}
              >
                <Info size={20} />
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <input
                type="range"
                min="0"
                max={config.maxDubbingVolumeMultiplier}
                step="0.1"
                value={localDubbingVolume}
                onChange={handleDubbingVolumeChange}
                className="flex-grow h-2 rounded-lg appearance-none cursor-pointer"
              />
              <span className="w-16 text-right">
                {(localDubbingVolume * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          <div className="bg-secondary p-4 rounded-lg shadow-inner">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">
                Video Volume During Dubbing
              </h3>
              <div
                id="video-volume-info"
                className="cursor-help"
                onMouseEnter={() => handleInfoMouseEnter("video-volume-info")}
                onMouseLeave={handleInfoMouseLeave}
              >
                <Info size={20} />
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={localVideoVolume}
                onChange={handleVideoVolumeChange}
                className="flex-grow h-2 rounded-lg appearance-none cursor-pointer"
              />
              <span className="w-16 text-right">
                {(localVideoVolume * 100).toFixed(0)}%
              </span>
            </div>
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

      {activeTooltip && (
        <div
          ref={tooltipRef}
          className="bg-gray-800 text-white p-2 rounded-md text-sm z-10"
        >
          {activeTooltip === "subtitle-offset-info" &&
            "Adjust the timing of subtitles relative to the audio."}
          {activeTooltip === "dubbing-volume-info" &&
            "Adjust the volume of the dubbed audio."}
          {activeTooltip === "video-volume-info" &&
            "Adjust the volume of the original video while dubbing is active."}
        </div>
      )}
    </PageLayout>
  );
};

export default SettingsPage;
