// src/components/DubbingControls.tsx
import React from "react";
import Button from "@/components/ui/Button";

interface DubbingControlsProps {
  isDubbingActive: boolean;
  onDubbingToggle: (isActive: boolean) => void;
}

const DubbingControls: React.FC<DubbingControlsProps> = ({
  isDubbingActive,
  onDubbingToggle,
}) => (
  <Button
    onClick={() => onDubbingToggle(!isDubbingActive)}
    variant={isDubbingActive ? "destructive" : "primary"}
  >
    {isDubbingActive ? "Stop Dubbing" : "Start Dubbing"}
  </Button>
);

export default DubbingControls;
