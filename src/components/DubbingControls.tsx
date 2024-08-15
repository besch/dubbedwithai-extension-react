import React from "react";
import Button from "@/components/ui/Button";
import { Play, Pause } from "lucide-react";
import { useTranslation } from "react-i18next";

interface DubbingControlsProps {
  isDubbingActive: boolean;
  onDubbingToggle: (isActive: boolean) => void;
  disabled?: boolean;
}

const DubbingControls: React.FC<DubbingControlsProps> = ({
  isDubbingActive,
  onDubbingToggle,
  disabled,
}) => {
  const { t } = useTranslation();

  return (
    <Button
      onClick={() => onDubbingToggle(!isDubbingActive)}
      variant={isDubbingActive ? "outline" : "primary"}
      disabled={disabled}
    >
      {isDubbingActive ? (
        <>
          <Pause className="w-4 h-4 mr-2" />
          {t("stopDubbing")}
        </>
      ) : (
        <>
          <Play className="w-4 h-4 mr-2" />
          {t("startDubbing")}
        </>
      )}
    </Button>
  );
};

export default DubbingControls;
