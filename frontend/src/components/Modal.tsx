import { useEffect, type ReactNode } from "react";

export default function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="animate-fadeIn fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="animate-modalIn w-full max-w-md overflow-hidden rounded-xl bg-chat shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 text-center">
          <h2 className="text-xl font-bold text-textNormal">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-textMuted">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}
