import { useEffect, useRef, useState } from 'react';

export function useRecordingCountdown(
  isRecording: boolean,
  totalSeconds: number,
  onLimitReached: () => void,
): { secondsRemaining: number; progressRemaining: number } {
  const [secondsRemaining, setSecondsRemaining] = useState(totalSeconds);
  const callbackRef = useRef(onLimitReached);
  callbackRef.current = onLimitReached;

  useEffect(() => {
    if (!isRecording) {
      setSecondsRemaining(totalSeconds);
      return;
    }

    const startedAt = Date.now();
    let reachedLimit = false;
    setSecondsRemaining(totalSeconds);

    const finish = () => {
      if (reachedLimit) return;
      reachedLimit = true;
      setSecondsRemaining(0);
      callbackRef.current();
    };

    const interval = setInterval(() => {
      const elapsedMs = Date.now() - startedAt;
      const remaining = Math.max(0, Math.ceil((totalSeconds * 1000 - elapsedMs) / 1000));
      setSecondsRemaining(remaining);
      if (remaining === 0) finish();
    }, 200);
    const timeout = setTimeout(finish, totalSeconds * 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isRecording, totalSeconds]);

  return {
    secondsRemaining,
    progressRemaining:
      totalSeconds > 0 ? Math.max(0, Math.min(1, secondsRemaining / totalSeconds)) : 0,
  };
}
