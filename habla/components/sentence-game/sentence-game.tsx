import { SlotRound, SwapRound, TilesRound } from '@/components/sentence-game/round-modes';
import {
  ADVANCE_DELAY_MS,
  type GameRound,
  type SentenceGameProps,
} from '@/components/sentence-game/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';

export type { GameMode, GameRound, GameSequence, SentenceGameProps } from '@/components/sentence-game/types';
export { ADVANCE_DELAY_MS, BLANK_MARKER } from '@/components/sentence-game/types';

type Feedback = 'correct' | 'incorrect' | null;

function answersMatch(given: string, expected: string): boolean {
  const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
  return normalize(given) === normalize(expected);
}

function RoundBody({
  round,
  locked,
  feedback,
  onSubmit,
}: {
  round: GameRound;
  locked: boolean;
  feedback: Feedback;
  onSubmit: (answer: string) => void;
}) {
  if (round.mode === 'swap') {
    return <SwapRound round={round} locked={locked} feedback={feedback} onSubmit={onSubmit} />;
  }
  if (round.mode === 'tiles') {
    return <TilesRound round={round} locked={locked} feedback={feedback} onSubmit={onSubmit} />;
  }
  return <SlotRound round={round} locked={locked} feedback={feedback} onSubmit={onSubmit} />;
}

export function SentenceGame({ sequence, onComplete }: SentenceGameProps) {
  const [roundIndex, setRoundIndex] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const advancing = useRef(false);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  const rounds = sequence.rounds;
  const round = rounds[roundIndex];
  const total = rounds.length;

  useEffect(() => {
    return () => {
      advancing.current = false;
    };
  }, []);

  const handleSubmit = useCallback(
    (answer: string) => {
      if (!round || advancing.current) return;
      advancing.current = true;
      const matched = answersMatch(answer, round.correctAnswer);
      setFeedback(matched ? 'correct' : 'incorrect');

      setTimeout(() => {
        const nextIndex = roundIndex + 1;
        if (nextIndex >= total) {
          completeRef.current();
          return;
        }
        setFeedback(null);
        setRoundIndex(nextIndex);
        advancing.current = false;
      }, ADVANCE_DELAY_MS);
    },
    [round, roundIndex, total],
  );

  if (!round) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.progress}>
        Round {roundIndex + 1} of {total}
      </Text>
      <Animated.View
        key={round.id}
        entering={FadeIn.duration(240)}
        exiting={FadeOut.duration(160)}
        style={styles.round}>
        <Text style={styles.prompt}>{round.prompt}</Text>
        {round.hint ? <Text style={styles.hint}>{round.hint}</Text> : null}
        <RoundBody
          key={round.id}
          round={round}
          locked={feedback != null}
          feedback={feedback}
          onSubmit={handleSubmit}
        />
        {feedback === 'correct' ? (
          <Animated.Text entering={ZoomIn.duration(180)} style={styles.correctNote}>
            ✓
          </Animated.Text>
        ) : null}
        {feedback === 'incorrect' ? (
          <Text style={styles.reveal}>Correct: {round.correctAnswer}</Text>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    gap: 14,
  },
  progress: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8B95A5',
    letterSpacing: 0.2,
  },
  round: {
    gap: 12,
  },
  prompt: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: '#F4F6F8',
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: '#8B95A5',
  },
  correctNote: {
    alignSelf: 'center',
    fontSize: 28,
    fontWeight: '900',
    color: '#34D399',
  },
  reveal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#8B95A5',
    textAlign: 'center',
  },
});
