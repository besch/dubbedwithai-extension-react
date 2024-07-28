import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { parseSrt } from "@/extension/utils";
import { Subtitle } from "@/extension/content/types";

const SubtitleCarousel: React.FC = () => {
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const srtContent = useSelector((state: RootState) => state.movie.srtContent);

  useEffect(() => {
    if (srtContent) {
      const parsedSubtitles = parseSrt(srtContent);
      setSubtitles(parsedSubtitles);
      setCurrentIndex(-1);
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

  const visibleSubtitles =
    currentIndex >= 0
      ? [
          subtitles[currentIndex - 2],
          subtitles[currentIndex - 1],
          subtitles[currentIndex],
          subtitles[currentIndex + 1],
          subtitles[currentIndex + 2],
        ].filter(Boolean)
      : [];

  return (
    <div
      className="h-full flex flex-col justify-center items-center p-2 overflow-hidden relative"
      style={{ minHeight: "400px", width: "100%" }}
    >
      {currentIndex < 0 ? (
        <div className="text-white text-lg">Waiting for subtitles...</div>
      ) : (
        <AnimatePresence initial={false}>
          {visibleSubtitles.map((subtitle, index) => (
            <motion.div
              key={`${subtitle.start}-${subtitle.end}`}
              initial={{ opacity: 0, y: 100 }}
              animate={{
                opacity: index === 2 ? 1 : 0.5,
                y: (index - 2) * 80,
                scale: index === 2 ? 1 : 0.9,
              }}
              exit={{ opacity: 0, y: -100 }}
              transition={{
                duration: 0.5,
                type: "spring",
                stiffness: 120,
                damping: 20,
              }}
              className={`absolute w-full text-center px-4 ${
                index === 2
                  ? "text-white text-lg font-semibold"
                  : "text-gray-300 text-base"
              }`}
              style={{
                maxWidth: "90%",
                width: "100%",
                filter:
                  index === 2
                    ? "drop-shadow(0 0 8px rgba(255,255,255,0.5))"
                    : "none",
              }}
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="mb-2 text-xs opacity-75"
              >
                {formatTime(subtitle.start)} - {formatTime(subtitle.end)}
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="break-words"
                style={{
                  maxWidth: "100%",
                  whiteSpace: "normal",
                  wordWrap: "break-word",
                }}
              >
                {subtitle.text}
              </motion.div>
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </div>
  );
};

export default SubtitleCarousel;
