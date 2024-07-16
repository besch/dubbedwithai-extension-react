// src/components/ui/LoadingSpinner.tsx

import React from "react";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = "md" }) => {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-12 w-12",
    lg: "h-16 w-16",
  };

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative">
        <div
          className={`animate-spin rounded-full ${sizeClasses[size]} border-4 border-primary border-t-transparent`}
        ></div>
        <div
          className={`absolute top-0 left-0 animate-ping rounded-full ${sizeClasses[size]} border-4 border-primary opacity-20`}
        ></div>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
    </div>
  );
};

export default LoadingSpinner;
