"use client";
import { useState } from "react";

interface Props {
  error: string;
  onDismiss?: () => void;
}

/** Shared error display with optional dismiss button. */
export function ErrorState({ error, onDismiss }: Props) {
  if (!error) return null;
  return (
    <div className="form-error" role="alert">
      {error}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="ml-2 underline font-medium"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
