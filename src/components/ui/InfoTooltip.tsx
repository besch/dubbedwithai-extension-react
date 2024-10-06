import React, { useState, useRef, useEffect } from "react";
import { createPopper, Instance as PopperInstance } from "@popperjs/core";
import { Info } from "lucide-react";

interface InfoTooltipProps {
  id: string;
  content: string;
}

const InfoTooltip: React.FC<InfoTooltipProps> = ({ id, content }) => {
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const popperInstanceRef = useRef<PopperInstance | null>(null);

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

  const handleInfoMouseEnter = () => {
    setActiveTooltip(id);
  };

  const handleInfoMouseLeave = () => {
    setActiveTooltip(null);
  };

  return (
    <>
      <div
        id={id}
        className="cursor-help"
        onMouseEnter={handleInfoMouseEnter}
        onMouseLeave={handleInfoMouseLeave}
      >
        <Info size={20} className="text-muted-foreground" />
      </div>
      {activeTooltip === id && (
        <div
          ref={tooltipRef}
          className="bg-background text-foreground p-2 rounded-md text-sm z-10 border border-muted-foreground shadow-sm absolute"
        >
          {content}
        </div>
      )}
    </>
  );
};

export default InfoTooltip;
