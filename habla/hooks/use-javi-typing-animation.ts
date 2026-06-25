import { useEffect, useMemo, useRef, useState } from 'react';

import {
  TYPING_DOT_DELAY_MS,
  tokenizeWords,
  wordDelayMs,
} from '@/lib/javi-typing';

type Options = {
  /** When false, full text is shown immediately. */
  enabled: boolean;
  /** Slow word reveals to match Javi's voice — never faster than speech. */
  voiceSync?: boolean;
  /** Change when the source message changes (e.g. message id). */
  resetKey?: string;
  onComplete?: () => void;
};

type Phase = 'idle' | 'dots' | 'typing' | 'complete';

export function useJaviTypingAnimation(text: string, options: Options) {
  const { enabled, voiceSync = false, resetKey, onComplete } = options;
  const words = useMemo(() => tokenizeWords(text), [text]);
  const [phase, setPhase] = useState<Phase>(enabled ? 'dots' : 'complete');
  const [visibleWordCount, setVisibleWordCount] = useState(enabled ? 0 : words.length);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!enabled || !text.trim()) {
      setPhase('complete');
      setVisibleWordCount(words.length);
      return;
    }

    setPhase('dots');
    setVisibleWordCount(0);

    let cancelled = false;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    const finish = () => {
      if (cancelled) return;
      setPhase('complete');
      setVisibleWordCount(words.length);
      onCompleteRef.current?.();
    };

    timeouts.push(
      setTimeout(() => {
        if (cancelled) return;
        setPhase('typing');

        if (!words.length) {
          finish();
          return;
        }

        let elapsed = 0;
        for (let i = 0; i < words.length; i += 1) {
          const delay = wordDelayMs(text, i, words, voiceSync);
          elapsed += delay;
          timeouts.push(
            setTimeout(() => {
              if (cancelled) return;
              setVisibleWordCount(i + 1);
              if (i === words.length - 1) finish();
            }, elapsed),
          );
        }
      }, TYPING_DOT_DELAY_MS),
    );

    return () => {
      cancelled = true;
      timeouts.forEach(clearTimeout);
    };
  }, [text, enabled, voiceSync, resetKey, words.length]);

  const displayedText =
    !enabled || phase === 'complete'
      ? text
      : words.slice(0, visibleWordCount).join(' ');

  return {
    displayedText,
    showTypingIndicator: enabled && phase === 'dots',
    isTyping: enabled && (phase === 'dots' || phase === 'typing'),
    isComplete: !enabled || phase === 'complete',
  };
}
