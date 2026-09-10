"use client";

interface Props {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  fullWidth?: boolean;
}

/** Shared primary action button with loading state. */
export function AnalyzeButton({ onClick, disabled, loading, children, fullWidth = true }: Props) {
  return (
    <button
      type="submit"
      onClick={onClick}
      disabled={disabled || loading}
      className={`cta-primary action-primary ${fullWidth ? "w-full" : ""} ${disabled || loading ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
