import { SentenceGame, type GameSequence } from '@/components/sentence-game/sentence-game';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** Temporary sample sequence — delete this route when the game is wired into lessons. */
const SAMPLE_SEQUENCE: GameSequence = {
  rounds: [
    {
      id: 'slot-1',
      mode: 'slot',
      prompt: 'Complete the sentence',
      sentenceTemplate: 'Yo {{blank}} al mercado',
      options: ['voy', 'va', 'vamos', 'fui'],
      correctAnswer: 'voy',
    },
    {
      id: 'swap-1',
      mode: 'swap',
      prompt: 'Change the verb to pretérito (yo)',
      sentenceTemplate: 'Yo {{blank}} café todas las mañanas',
      options: ['tomé', 'tomo', 'tomaba', 'tomaré'],
      correctAnswer: 'tomé',
    },
    {
      id: 'tiles-1',
      mode: 'tiles',
      prompt: 'Tap the words in the correct order',
      tiles: ['mercado', 'al', 'voy', 'Yo'],
      correctAnswer: 'Yo voy al mercado',
    },
    {
      id: 'slot-2',
      mode: 'slot',
      prompt: 'Pick the word that fits',
      sentenceTemplate: 'Nosotros {{blank}} pizza anoche',
      options: ['comemos', 'comimos', 'comeremos'],
      correctAnswer: 'comimos',
    },
  ],
};

export default function GameTestScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Sentence game</Text>
        <View style={styles.headerSpacer} />
      </View>
      <View style={styles.body}>
        <SentenceGame
          sequence={SAMPLE_SEQUENCE}
          onComplete={() => {
            Alert.alert('Sentence game', 'All rounds complete.', [
              { text: 'OK', onPress: () => router.back() },
            ]);
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B0F14' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#252D3A',
  },
  back: { fontSize: 16, fontWeight: '700', color: '#FF7A59', minWidth: 72 },
  title: { fontSize: 17, fontWeight: '900', color: '#F4F6F8' },
  headerSpacer: { minWidth: 72 },
  body: { flex: 1, padding: 20, justifyContent: 'center' },
});
