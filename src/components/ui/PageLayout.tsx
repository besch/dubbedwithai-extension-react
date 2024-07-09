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
      <h1 className="text-xl font-bold text-secondary">{title}</h1>
      {children}
    </div>
  );
};

export default PageLayout;
