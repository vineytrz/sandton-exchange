import { ReactNode } from "react";

export default function PlatformPage({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="page-header">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}
