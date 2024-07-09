import React from "react";
import { cn } from "@/lib/utils";

interface AlertProps {
  children: React.ReactNode;
  variant?: "default" | "destructive";
}

export const Alert: React.FC<AlertProps> = ({
  children,
  variant = "default",
}) => (
  <div
    className={cn("rounded-lg border p-4", {
      "bg-background text-foreground": variant === "default",
      "bg-destructive text-destructive-foreground": variant === "destructive",
    })}
  >
    {children}
  </div>
);

export const AlertDescription: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <div className="text-sm">{children}</div>;
