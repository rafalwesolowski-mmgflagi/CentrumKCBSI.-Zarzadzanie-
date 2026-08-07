import { useEffect } from "react";

export function useAutoFade(
  message: string | null,
  clear: () => void,
  delay = 5000
) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(clear, delay);
    return () => clearTimeout(timer);
  }, [message, clear, delay]);
}
