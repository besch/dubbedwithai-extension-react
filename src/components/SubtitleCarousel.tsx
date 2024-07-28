import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { parseSrt } from "@/extension/utils";
import { Subtitle } from "@/extension/content/types";

const SubtitleCarousel: React.FC = () => {
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const srtContent = useSelector((state: RootState) => state.movie.srtContent);

  useEffect(() => {
    if (srtContent) {
      const parsedSubtitles = parseSrt(srtContent);
      setSubtitles(parsedSubtitles);
      setCurrentIndex(0);
    }
  }, [srtContent]);

  const handleSubtitleChange = useCallback(
    (message: any) => {
      if (message.action === "currentSubtitle" && message.subtitle) {
        const index = subtitles.findIndex(
          (sub) =>
            Math.abs(sub.start - message.subtitle.start * 1000) < 100 &&
            Math.abs(sub.end - message.subtitle.end * 1000) < 100
        );
        if (index !== -1) {
          setCurrentIndex(index);
        }
      }
    },
    [subtitles]
  );

  useEffect(() => {
    chrome.runtime.onMessage.addListener(handleSubtitleChange);

    return () => {
      chrome.runtime.onMessage.removeListener(handleSubtitleChange);
    };
  }, [handleSubtitleChange]);

  const formatTime = (timeInMilliseconds: number) => {
    const totalSeconds = Math.floor(timeInMilliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  const visibleSubtitles = [
    subtitles[currentIndex - 2],
    subtitles[currentIndex - 1],
    subtitles[currentIndex],
    subtitles[currentIndex + 1],
    subtitles[currentIndex + 2],
  ].filter(Boolean);

  return (
    <div
      className="h-full flex flex-col justify-center items-center p-2 overflow-hidden relative"
      style={{ minHeight: "300px" }}
    >
      <AnimatePresence initial={false}>
        {visibleSubtitles.map((subtitle, index) => (
          <motion.div
            key={`${subtitle.start}-${subtitle.end}`}
            initial={{ opacity: 0, y: 50 }}
            animate={{
              opacity: index === 2 ? 1 : 0.5,
              y: (index - 2) * 60,
              scale: index === 2 ? 1 : 0.9,
            }}
            exit={{ opacity: 0, y: -50 }}
            transition={{ duration: 0.3 }}
            className={`absolute w-full text-center px-2 ${
              index === 2 ? "text-white text-lg" : "text-gray-300 text-base"
            }`}
          >
            <div className="mb-1 text-xs opacity-75">
              {formatTime(subtitle.start)} - {formatTime(subtitle.end)}
            </div>
            <div className="break-words">{subtitle.text}</div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default SubtitleCarousel;
