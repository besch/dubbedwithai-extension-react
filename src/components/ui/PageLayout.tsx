import React, { ReactNode } from "react";

interface PageLayoutProps {
  children: ReactNode;
  title: string;
  className?: string;
}

const PageLayout: React.FC<PageLayoutProps> = ({
  children,
  title,
  className = "",
}) => {
  return (
    <div className={`h-full flex flex-col ${className}`}>
      <h1 className="text-xl font-bold text-foreground p-4 flex-shrink-0">
        {title}
      </h1>
      <div className="flex-grow p-4 overflow-y-auto flex flex-col">
        {children}
      </div>
    </div>
  );
};

export default PageLayout;
