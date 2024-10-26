import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Subtitle {
  start: number;
  end: number;
  text: string;
}

const SubtitleCarousel: React.FC = () => {
  const [currentSubtitles, setCurrentSubtitles] = useState<Subtitle[]>([]);

  useEffect(() => {
    const handleSubtitleUpdate = (message: any) => {
      if (message.action === "updateSubtitles") {
        setCurrentSubtitles(message.subtitles);
      }
    };

    chrome.runtime.onMessage.addListener(handleSubtitleUpdate);

    return () => {
      chrome.runtime.onMessage.removeListener(handleSubtitleUpdate);
    };
  }, []);

  const formatTime = (timeInMilliseconds: number) => {
    const totalSeconds = Math.floor(timeInMilliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <div
      className="h-full flex flex-col justify-center items-center p-2 overflow-hidden relative"
      style={{ minHeight: "400px", width: "100%" }}
    >
      <AnimatePresence initial={false}>
        {currentSubtitles.map((subtitle, index) => (
          <motion.div
            key={`subtitle-${subtitle.start}-${index}`}
            initial={{ opacity: 0, y: 100 }}
            animate={{
              opacity: index === 2 ? 1 : 0.5 - Math.abs(index - 2) * 0.05,
              y: (index - 2) * 120,
              scale: 1 - Math.abs(index - 2) * 0.1,
            }}
            exit={{ opacity: 0, y: -100 }}
            transition={{
              duration: 0.5,
              type: "spring",
              stiffness: 120,
              damping: 20,
            }}
            className={`absolute w-full text-center px-4 font-roboto ${
              index === 2
                ? "text-white text-xl font-semibold"
                : "text-gray-300 text-base"
            }`}
            style={{
              maxWidth: "90%",
              width: "100%",
              filter:
                index === 2
                  ? "drop-shadow(0 0 8px rgba(255,255,255,0.5))"
                  : "none",
              pointerEvents: "none",
            }}
          >
            <>
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
            </>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default SubtitleCarousel;
