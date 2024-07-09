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
    <div className={`p-4 space-y-4 ${className}`}>
      <h1 className="text-2xl font-bold text-primary">{title}</h1>
      {children}
    </div>
  );
};

export default PageLayout;
