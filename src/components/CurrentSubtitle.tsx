import React, { useState, useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import "animate.css";

interface SubtitleItem {
  text: string;
  start: number;
  end: number;
  currentTime: number;
}

const CurrentSubtitle: React.FC = () => {
  const [subtitle, setSubtitle] = useState<SubtitleItem | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const isDubbingActive = useSelector(
    (state: RootState) => state.movie.isDubbingActive
  );
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const handleSubtitleChange = (message: any) => {
      if (message.action === "currentSubtitle") {
        if (message.subtitle) {
          setSubtitle(message.subtitle);
          setIsVisible(true);

          if (timerRef.current) {
            clearTimeout(timerRef.current);
          }

          const remainingTime =
            (message.subtitle.end - message.subtitle.currentTime) * 1000;
          timerRef.current = window.setTimeout(() => {
            setIsVisible(false);
          }, remainingTime);
        } else {
          setSubtitle(null);
          setIsVisible(false);
          if (timerRef.current) {
            clearTimeout(timerRef.current);
          }
        }
      }
    };

    chrome.runtime.onMessage.addListener(handleSubtitleChange);

    return () => {
      chrome.runtime.onMessage.removeListener(handleSubtitleChange);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  if (!isDubbingActive || !subtitle || !isVisible) {
    return null;
  }

  return (
    <div
      className={`fixed top-[100px] left-0 right-0 text-center p-4 bg-secondary bg-opacity-75 text-white text-xl rounded-t-lg
        animate__animated ${
          isVisible ? "animate__fadeInUp" : "animate__fadeOutDown"
        }`}
    >
      <div className="mb-2 text-sm opacity-75">
        {formatTime(subtitle.start)} - {formatTime(subtitle.end)}
      </div>
      <div>{subtitle.text}</div>
    </div>
  );
};

export default CurrentSubtitle;
