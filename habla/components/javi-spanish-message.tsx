import { InteractiveSpanishText, type InteractiveSpanishSource } from '@/components/interactive-spanish-text';
import { JaviTypingText } from '@/components/javi-typing-text';
import { useEffect, useState } from 'react';
import { type TextStyle } from 'react-native';

type Props = {
  spanish: string;
  source: InteractiveSpanishSource;
  animate?: boolean;
  voiceSync?: boolean;
  resetKey?: string;
  style?: TextStyle;
  onTypingComplete?: () => void;
};

export function JaviSpanishMessage({
  spanish,
  source,
  animate = false,
  voiceSync = false,
  resetKey,
  style,
  onTypingComplete,
}: Props) {
  const [typingComplete, setTypingComplete] = useState(!animate);

  useEffect(() => {
    setTypingComplete(!animate);
  }, [animate, resetKey]);

  if (animate && !typingComplete) {
    return (
      <JaviTypingText
        text={spanish}
        animate
        voiceSync={voiceSync}
        resetKey={resetKey}
        style={style}
        onComplete={() => {
          setTypingComplete(true);
          onTypingComplete?.();
        }}
      />
    );
  }

  return (
    <InteractiveSpanishText
      text={spanish}
      source={source}
      style={style}
      contextSentence={spanish}
    />
  );
}
