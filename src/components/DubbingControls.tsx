import React from "react";
import Button from "@/components/ui/Button";
import { Play, Pause } from "lucide-react";

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
    variant={isDubbingActive ? "outline" : "primary"}
  >
    {isDubbingActive ? (
      <>
        <Pause className="w-4 h-4 mr-2" />
        Stop Dubbing
      </>
    ) : (
      <>
        <Play className="w-4 h-4 mr-2" />
        Start Dubbing
      </>
    )}
  </Button>
);

export default DubbingControls;
