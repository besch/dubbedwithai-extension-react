// src/components/DubbingControls.tsx
import React from "react";

interface DubbingControlsProps {
  isDubbingActive: boolean;
  onDubbingToggle: (isActive: boolean) => void;
}

const DubbingControls: React.FC<DubbingControlsProps> = ({
  isDubbingActive,
  onDubbingToggle,
}) => {
  return (
    <div>
      <button
        onClick={() => onDubbingToggle(!isDubbingActive)}
        className={`px-4 py-2 rounded transition duration-200 ${
          isDubbingActive
            ? "bg-red-500 text-white hover:bg-red-600"
            : "bg-green-500 text-white hover:bg-green-600"
        }`}
      >
        {isDubbingActive ? "Stop Dubbing" : "Start Dubbing"}
      </button>
    </div>
  );
};

export default DubbingControls;
