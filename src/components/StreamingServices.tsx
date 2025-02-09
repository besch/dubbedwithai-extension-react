import React from "react";
import { TvMinimalPlayIcon } from "lucide-react";

const StreamingServices: React.FC = () => {
  return (
    <div className="bg-card transition-colors duration-200 p-4 rounded-lg shadow-sm">
      <a
        href="https://telegram.me/s/streamingwebsites"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-1 p-3 rounded bg-accent text-accent-foreground hover:bg-accent/80 transition-colors"
      >
        <TvMinimalPlayIcon className="w-4 h-4" />
        <span className="text-xs">Free Streaming Websites</span>
      </a>
    </div>
  );
};

export default StreamingServices;
