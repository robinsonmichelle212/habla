import AsyncStorage from '@react-native-async-storage/async-storage';

import { resolveGrammarCurriculum } from '@/lib/grammar-curriculum';

const HISTORY_KEY = 'memoryPalaceHistory';

export type PalacePerson = 'yo' | 'tu' | 'el' | 'nosotros' | 'vosotros' | 'ellos';

export type PalaceSlot = {
  person: PalacePerson;
  itemEmoji: string;
  itemName: string;
  answer: string;
  acceptableAnswers: string[];
  memoryHook: string;
  walkthroughScene: string;
  quizPrompt: string;
};

export type MemoryPalaceVerbSet = {
  id: string;
  verbLabel: string;
  englishMeaning: string;
  previewForms: string;
  slots: PalaceSlot[];
};

export type MemoryPalaceWeekGroup = {
  id: string;
  weekLabel: string;
  minWeek: number;
  maxWeek: number;
  verbSets: MemoryPalaceVerbSet[];
};

const KETTLE = { itemEmoji: '🫖', itemName: 'the kettle' };
const FRIDGE = { itemEmoji: '🧊', itemName: 'the fridge' };
const COOKER = { itemEmoji: '🍳', itemName: 'the cooker' };
const TABLE = { itemEmoji: '🪑', itemName: 'the kitchen table' };
const WINDOW = { itemEmoji: '🪟', itemName: 'the window' };
const DOOR = { itemEmoji: '🚪', itemName: 'the kitchen door' };

function slot(
  person: PalacePerson,
  item: { itemEmoji: string; itemName: string },
  answer: string,
  memoryHook: string,
  walkthroughScene: string,
  extraAcceptable: string[] = [],
): PalaceSlot {
  return {
    person,
    itemEmoji: item.itemEmoji,
    itemName: item.itemName,
    answer,
    acceptableAnswers: [answer, ...extraAcceptable],
    memoryHook,
    walkthroughScene,
    quizPrompt: quizQuestionForItem(item.itemName),
  };
}

function quizQuestionForItem(itemName: string): string {
  const map: Record<string, string> = {
    'the kettle': 'What happened at the kettle?',
    'the fridge': 'What did you do at the fridge?',
    'the cooker': 'What about the cooker?',
    'the kitchen table': 'At the table?',
    'the window': 'By the window?',
    'the kitchen door': 'At the door?',
  };
  return map[itemName] ?? `What do you find at ${itemName}?`;
}

function personalize(text: string, name: string): string {
  return text.replace(/\{name\}/g, name);
}

function buildIrPreterite(name: string): MemoryPalaceVerbSet {
  return {
    id: 'ir_preterite',
    verbLabel: 'IR / SER',
    englishMeaning: 'to go / to be',
    previewForms: 'fui, fuiste, fue…',
    slots: [
      slot(
        'yo',
        KETTLE,
        'fui',
        'Phooey!',
        personalize(
          `${KETTLE.itemEmoji} ${name}, your kettle — PHOOEY! You went (fui) to make tea and the kettle was cold. Say it: fui.`,
          name,
        ),
      ),
      slot(
        'tu',
        FRIDGE,
        'fuiste',
        'Fwisty — the twisty road you went down',
        personalize(
          `${FRIDGE.itemEmoji} The fridge — you went (fuiste) to the fridge twice looking for the same thing, ${name}. Typical. Say it: fuiste.`,
          name,
        ),
      ),
      slot(
        'el',
        COOKER,
        'fue',
        'Phooey! (same hook as fui)',
        personalize(
          `${COOKER.itemEmoji} The cooker — it went (fue) cold before dinner was ready. Say it: fue.`,
          name,
        ),
      ),
      slot(
        'nosotros',
        TABLE,
        'fuimos',
        'Fwee-moose — the moose we went to see',
        personalize(
          `${TABLE.itemEmoji} At the table — we went (fuimos) through three cups of tea this morning. Say it: fuimos.`,
          name,
        ),
      ),
      slot(
        'vosotros',
        WINDOW,
        'fuisteis',
        'You all went to look outside',
        personalize(
          `${WINDOW.itemEmoji} By the window — you all went (fuisteis) to see who was at the door. Say it: fuisteis.`,
          name,
        ),
      ),
      slot(
        'ellos',
        DOOR,
        'fueron',
        'Fweh-ron — the wren that went flying off',
        personalize(
          `${DOOR.itemEmoji} The door — they went (fueron) out without saying goodbye. Say it: fueron.`,
          name,
        ),
      ),
    ],
  };
}

function buildTenerPreterite(name: string): MemoryPalaceVerbSet {
  return {
    id: 'tener_preterite',
    verbLabel: 'TENER',
    englishMeaning: 'to have',
    previewForms: 'tuve, tuviste, tuvo…',
    slots: [
      slot(
        'yo',
        KETTLE,
        'tuve',
        'Too vague — it was too vague what I had',
        personalize(
          `${KETTLE.itemEmoji} ${name}, at the kettle — you had (tuve) a moment when breakfast was too vague to remember. Say it: tuve.`,
          name,
        ),
      ),
      slot(
        'tu',
        FRIDGE,
        'tuviste',
        'Too-vee-stay — too vee shaped to stay',
        personalize(
          `${FRIDGE.itemEmoji} The fridge — you had (tuviste) to open it twice. Say it: tuviste.`,
          name,
        ),
      ),
      slot(
        'el',
        COOKER,
        'tuvo',
        'Two-bo — two bows I had',
        personalize(
          `${COOKER.itemEmoji} The cooker — it had (tuvo) just enough heat left. Say it: tuvo.`,
          name,
        ),
      ),
      slot(
        'nosotros',
        TABLE,
        'tuvimos',
        'We had a long chat at the table',
        personalize(
          `${TABLE.itemEmoji} At the table — we had (tuvimos) a quiet moment together. Say it: tuvimos.`,
          name,
        ),
      ),
      slot(
        'vosotros',
        WINDOW,
        'tuvisteis',
        'You all had a view from the window',
        personalize(
          `${WINDOW.itemEmoji} By the window — you all had (tuvisteis) the best light in the flat. Say it: tuvisteis.`,
          name,
        ),
      ),
      slot(
        'ellos',
        DOOR,
        'tuvieron',
        'They had to leave through the door',
        personalize(
          `${DOOR.itemEmoji} The door — they had (tuvieron) coats on and were ready to go. Say it: tuvieron.`,
          name,
        ),
      ),
    ],
  };
}

function buildHacerPreterite(name: string): MemoryPalaceVerbSet {
  return {
    id: 'hacer_preterite',
    verbLabel: 'HACER',
    englishMeaning: 'to do / to make',
    previewForms: 'hice, hiciste, hizo…',
    slots: [
      slot(
        'yo',
        KETTLE,
        'hice',
        'Easy — I did it easy',
        personalize(
          `${KETTLE.itemEmoji} ${name}, at the kettle — you made (hice) tea the easy way. Say it: hice.`,
          name,
        ),
      ),
      slot(
        'tu',
        FRIDGE,
        'hiciste',
        'Easy-stay — you did it and stayed',
        personalize(
          `${FRIDGE.itemEmoji} The fridge — you made (hiciste) a snack and stayed in the kitchen. Say it: hiciste.`,
          name,
        ),
      ),
      slot(
        'el',
        COOKER,
        'hizo',
        'It made a perfect sound',
        personalize(
          `${COOKER.itemEmoji} The cooker — it made (hizo) that click when it was ready. Say it: hizo.`,
          name,
        ),
      ),
      slot(
        'nosotros',
        TABLE,
        'hicimos',
        'We made dinner at the table',
        personalize(
          `${TABLE.itemEmoji} At the table — we made (hicimos) space for everyone. Say it: hicimos.`,
          name,
        ),
      ),
      slot(
        'vosotros',
        WINDOW,
        'hicisteis',
        'You all made a mess by the window',
        personalize(
          `${WINDOW.itemEmoji} By the window — you all made (hicisteis) the plants happy with sunlight. Say it: hicisteis.`,
          name,
        ),
      ),
      slot(
        'ellos',
        DOOR,
        'hicieron',
        'They made a quick exit',
        personalize(
          `${DOOR.itemEmoji} The door — they made (hicieron) a racket leaving. Say it: hicieron.`,
          name,
        ),
      ),
    ],
  };
}

function buildPoderPreterite(name: string): MemoryPalaceVerbSet {
  return {
    id: 'poder_preterite',
    verbLabel: 'PODER',
    englishMeaning: 'to be able to',
    previewForms: 'pude, pudiste, pudo…',
    slots: [
      slot(
        'yo',
        KETTLE,
        'pude',
        'Poodle — the poodle could do it',
        personalize(
          `${KETTLE.itemEmoji} ${name}, at the kettle — you could (pude) finally get it to boil. Say it: pude.`,
          name,
        ),
      ),
      slot(
        'tu',
        FRIDGE,
        'pudiste',
        'Poo-dees-tay — the poodle that could stay',
        personalize(
          `${FRIDGE.itemEmoji} The fridge — you could (pudiste) find what you needed on the second try. Say it: pudiste.`,
          name,
        ),
      ),
      slot(
        'el',
        COOKER,
        'pudo',
        'It could heat up fast',
        personalize(
          `${COOKER.itemEmoji} The cooker — it could (pudo) manage one more dish. Say it: pudo.`,
          name,
        ),
      ),
      slot(
        'nosotros',
        TABLE,
        'pudimos',
        'We could sit and talk',
        personalize(
          `${TABLE.itemEmoji} At the table — we could (pudimos) eat without rushing. Say it: pudimos.`,
          name,
        ),
      ),
      slot(
        'vosotros',
        WINDOW,
        'pudisteis',
        'You all could see out clearly',
        personalize(
          `${WINDOW.itemEmoji} By the window — you all could (pudisteis) see the street clearly. Say it: pudisteis.`,
          name,
        ),
      ),
      slot(
        'ellos',
        DOOR,
        'pudieron',
        'They could leave on time',
        personalize(
          `${DOOR.itemEmoji} The door — they could (pudieron) slip out quietly. Say it: pudieron.`,
          name,
        ),
      ),
    ],
  };
}

function buildQuererPreterite(name: string): MemoryPalaceVerbSet {
  return {
    id: 'querer_preterite',
    verbLabel: 'QUERER',
    englishMeaning: 'to want',
    previewForms: 'quise, quisiste, quiso…',
    slots: [
      slot(
        'yo',
        KETTLE,
        'quise',
        'Keys — I wanted my keys',
        personalize(
          `${KETTLE.itemEmoji} ${name}, at the kettle — you wanted (quise) tea more than anything. Say it: quise.`,
          name,
        ),
      ),
      slot(
        'tu',
        FRIDGE,
        'quisiste',
        'Keys-stay — you wanted the keys to stay',
        personalize(
          `${FRIDGE.itemEmoji} The fridge — you wanted (quisiste) something sweet from the back shelf. Say it: quisiste.`,
          name,
        ),
      ),
      slot(
        'el',
        COOKER,
        'quiso',
        'It wanted more time',
        personalize(
          `${COOKER.itemEmoji} The cooker — it wanted (quiso) one more minute. Say it: quiso.`,
          name,
        ),
      ),
      slot(
        'nosotros',
        TABLE,
        'quisimos',
        'We wanted a slow breakfast',
        personalize(
          `${TABLE.itemEmoji} At the table — we wanted (quisimos) a calm start to the day. Say it: quisimos.`,
          name,
        ),
      ),
      slot(
        'vosotros',
        WINDOW,
        'quisisteis',
        'You all wanted the view',
        personalize(
          `${WINDOW.itemEmoji} By the window — you all wanted (quisisteis) fresh air. Say it: quisisteis.`,
          name,
        ),
      ),
      slot(
        'ellos',
        DOOR,
        'quisieron',
        'They wanted to leave',
        personalize(
          `${DOOR.itemEmoji} The door — they wanted (quisieron) to head out early. Say it: quisieron.`,
          name,
        ),
      ),
    ],
  };
}

function buildVenirPreterite(name: string): MemoryPalaceVerbSet {
  return {
    id: 'venir_preterite',
    verbLabel: 'VENIR',
    englishMeaning: 'to come',
    previewForms: 'vine, viniste, vino…',
    slots: [
      slot(
        'yo',
        KETTLE,
        'vine',
        'Wine — I came bearing wine',
        personalize(
          `${KETTLE.itemEmoji} ${name}, at the kettle — you came (vine) to the kitchen first thing. Say it: vine.`,
          name,
        ),
      ),
      slot(
        'tu',
        FRIDGE,
        'viniste',
        'Vee-nees-tay — you came to stay',
        personalize(
          `${FRIDGE.itemEmoji} The fridge — you came (viniste) back twice for snacks. Say it: viniste.`,
          name,
        ),
      ),
      slot(
        'el',
        COOKER,
        'vino',
        'Someone came to the cooker',
        personalize(
          `${COOKER.itemEmoji} The cooker — someone came (vino) to check on dinner. Say it: vino.`,
          name,
        ),
      ),
      slot(
        'nosotros',
        TABLE,
        'vinimos',
        'We came together to eat',
        personalize(
          `${TABLE.itemEmoji} At the table — we came (vinimos) together for breakfast. Say it: vinimos.`,
          name,
        ),
      ),
      slot(
        'vosotros',
        WINDOW,
        'vinisteis',
        'You all came to the window',
        personalize(
          `${WINDOW.itemEmoji} By the window — you all came (vinisteis) to watch the rain. Say it: vinisteis.`,
          name,
        ),
      ),
      slot(
        'ellos',
        DOOR,
        'vinieron',
        'They came through the door',
        personalize(
          `${DOOR.itemEmoji} The door — they came (vinieron) in laughing. Say it: vinieron.`,
          name,
        ),
      ),
    ],
  };
}

function buildEstarPreterite(name: string): MemoryPalaceVerbSet {
  return {
    id: 'estar_preterite',
    verbLabel: 'ESTAR',
    englishMeaning: 'to be (location/state)',
    previewForms: 'estuve, estuviste, estuvo…',
    slots: [
      slot(
        'yo',
        KETTLE,
        'estuve',
        'S-TWO-veh — picture S and TWO at the kettle',
        personalize(
          `${KETTLE.itemEmoji} ${name}, the kettle WAS cold — it had been sitting there. Estuve — "I was" — S-TWO-veh — imagine S and TWO at the kettle. Say it: estuve.`,
          name,
        ),
      ),
      slot(
        'tu',
        FRIDGE,
        'estuviste',
        'You were at the fridge all morning',
        personalize(
          `${FRIDGE.itemEmoji} The fridge — you WERE (estuviste) at the fridge all morning. Say it: estuviste.`,
          name,
        ),
      ),
      slot(
        'el',
        COOKER,
        'estuvo',
        'The cooker was on all night',
        personalize(
          `${COOKER.itemEmoji} The cooker — it WAS (estuvo) on all night. Say it: estuvo.`,
          name,
        ),
      ),
      slot(
        'nosotros',
        TABLE,
        'estuvimos',
        'We were at the table for hours',
        personalize(
          `${TABLE.itemEmoji} At the table — we WERE (estuvimos) at the table for hours. Say it: estuvimos.`,
          name,
        ),
      ),
      slot(
        'vosotros',
        WINDOW,
        'estuvisteis',
        'You all were by the window',
        personalize(
          `${WINDOW.itemEmoji} By the window — you all WERE (estuvisteis) by the window. Say it: estuvisteis.`,
          name,
        ),
      ),
      slot(
        'ellos',
        DOOR,
        'estuvieron',
        'They were at the door waiting',
        personalize(
          `${DOOR.itemEmoji} The door — they WERE (estuvieron) at the door waiting. Say it: estuvieron.`,
          name,
        ),
      ),
    ],
  };
}

function buildSaberPreterite(name: string): MemoryPalaceVerbSet {
  return {
    id: 'saber_preterite',
    verbLabel: 'SABER',
    englishMeaning: 'to know',
    previewForms: 'supe, supiste, supo…',
    slots: [
      slot(
        'yo',
        KETTLE,
        'supe',
        'SUPER — super, I knew it!',
        personalize(
          `${KETTLE.itemEmoji} ${name}, the kettle KNEW it was going to boil — SUPE sounds like SUPER — super, I knew it! Say it: supe.`,
          name,
        ),
      ),
      slot(
        'tu',
        FRIDGE,
        'supiste',
        'You knew the fridge was empty',
        personalize(
          `${FRIDGE.itemEmoji} The fridge — you KNEW (supiste) the fridge was empty. Say it: supiste.`,
          name,
        ),
      ),
      slot(
        'el',
        COOKER,
        'supo',
        'The cooker knew when to stop',
        personalize(
          `${COOKER.itemEmoji} The cooker — it KNEW (supo) when to stop. Say it: supo.`,
          name,
        ),
      ),
      slot(
        'nosotros',
        TABLE,
        'supimos',
        'We knew at the table',
        personalize(
          `${TABLE.itemEmoji} At the table — we KNEW (supimos) at the table. Say it: supimos.`,
          name,
        ),
      ),
      slot(
        'vosotros',
        WINDOW,
        'supisteis',
        'You all knew by the window',
        personalize(
          `${WINDOW.itemEmoji} By the window — you all KNEW (supisteis) by the window. Say it: supisteis.`,
          name,
        ),
      ),
      slot(
        'ellos',
        DOOR,
        'supieron',
        'They knew at the door',
        personalize(
          `${DOOR.itemEmoji} The door — they KNEW (supieron) at the door. Say it: supieron.`,
          name,
        ),
      ),
    ],
  };
}

function buildDarPreterite(name: string): MemoryPalaceVerbSet {
  return {
    id: 'dar_preterite',
    verbLabel: 'DAR',
    englishMeaning: 'to give',
    previewForms: 'di, diste, dio…',
    slots: [
      slot(
        'yo',
        KETTLE,
        'di',
        'DJ — the DJ gave everyone a great night',
        personalize(
          `${KETTLE.itemEmoji} ${name}, the kettle GAVE out steam — DI sounds like "dee" — imagine a DJ at the kettle. Say it: di.`,
          name,
        ),
      ),
      slot(
        'tu',
        FRIDGE,
        'diste',
        'You gave the fridge a good clean',
        personalize(
          `${FRIDGE.itemEmoji} The fridge — you GAVE (diste) the fridge a good clean. Say it: diste.`,
          name,
        ),
      ),
      slot(
        'el',
        COOKER,
        'dio',
        'The cooker gave off heat',
        personalize(
          `${COOKER.itemEmoji} The cooker — it GAVE (dio) off heat. Say it: dio.`,
          name,
        ),
      ),
      slot(
        'nosotros',
        TABLE,
        'dimos',
        'We gave thanks at the table',
        personalize(
          `${TABLE.itemEmoji} At the table — we GAVE (dimos) thanks at the table. Say it: dimos.`,
          name,
        ),
      ),
      slot(
        'vosotros',
        WINDOW,
        'disteis',
        'You all gave by the window',
        personalize(
          `${WINDOW.itemEmoji} By the window — you all GAVE (disteis) by the window. Say it: disteis.`,
          name,
        ),
      ),
      slot(
        'ellos',
        DOOR,
        'dieron',
        'They gave at the door',
        personalize(
          `${DOOR.itemEmoji} The door — they GAVE (dieron) at the door. Say it: dieron.`,
          name,
        ),
      ),
    ],
  };
}

export const MEMORY_PALACE_GROUPS: MemoryPalaceWeekGroup[] = [
  {
    id: 'week-3-4-preterite',
    weekLabel: 'Week 3–4: Preterite irregulars',
    minWeek: 3,
    maxWeek: 4,
    verbSets: [], // filled by buildVerbSetsForUser
  },
];

export function buildVerbSetsForUser(name: string): MemoryPalaceWeekGroup[] {
  const learnerName = name.trim() || 'friend';
  return [
    {
      id: 'week-3-4-preterite',
      weekLabel: 'Week 3–4: Preterite irregulars',
      minWeek: 3,
      maxWeek: 4,
      verbSets: [
        buildIrPreterite(learnerName),
        buildEstarPreterite(learnerName),
        buildTenerPreterite(learnerName),
        buildHacerPreterite(learnerName),
        buildPoderPreterite(learnerName),
        buildQuererPreterite(learnerName),
        buildSaberPreterite(learnerName),
        buildDarPreterite(learnerName),
        buildVenirPreterite(learnerName),
      ],
    },
  ];
}

export function isWeekGroupUnlocked(
  group: MemoryPalaceWeekGroup,
  currentWeek: number,
  completedWeeks: number[],
): boolean {
  if (currentWeek >= group.minWeek) return true;
  return completedWeeks.some((w) => w >= group.minWeek);
}

export const MEMORY_PALACE_VERB_IDS = [
  'ir_preterite',
  'estar_preterite',
  'tener_preterite',
  'hacer_preterite',
  'poder_preterite',
  'querer_preterite',
  'saber_preterite',
  'dar_preterite',
  'venir_preterite',
] as const;

export type MemoryPalaceHistoryEntry = {
  verbId: string;
  visited: boolean;
  lastVisited: string | null;
  timesCompleted: number;
};

function defaultHistoryEntry(verbId: string): MemoryPalaceHistoryEntry {
  return {
    verbId,
    visited: false,
    lastVisited: null,
    timesCompleted: 0,
  };
}

function parseHistoryEntries(raw: string | null): MemoryPalaceHistoryEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const map = new Map<string, MemoryPalaceHistoryEntry>();
    for (const item of parsed) {
      if (typeof item === 'string') {
        map.set(item, {
          verbId: item,
          visited: true,
          lastVisited: null,
          timesCompleted: 1,
        });
        continue;
      }
      if (!item || typeof item !== 'object') continue;
      const entry = item as Partial<MemoryPalaceHistoryEntry>;
      if (typeof entry.verbId !== 'string' || !entry.verbId.trim()) continue;
      const existing = map.get(entry.verbId);
      map.set(entry.verbId, {
        verbId: entry.verbId,
        visited: entry.visited === true || existing?.visited === true,
        lastVisited:
          typeof entry.lastVisited === 'string'
            ? entry.lastVisited
            : existing?.lastVisited ?? null,
        timesCompleted:
          typeof entry.timesCompleted === 'number' && Number.isFinite(entry.timesCompleted)
            ? Math.max(0, Math.floor(entry.timesCompleted))
            : existing?.timesCompleted ?? (entry.visited ? 1 : 0),
      });
    }
    return Array.from(map.values());
  } catch {
    return [];
  }
}

/** Merge new verb catalog entries without overwriting existing progress. */
export async function ensureMemoryPalaceHistoryMerged(): Promise<void> {
  const raw = await AsyncStorage.getItem(HISTORY_KEY);
  const history = parseHistoryEntries(raw);
  const byId = new Map(history.map((entry) => [entry.verbId, entry]));

  let changed = false;
  for (const verbId of MEMORY_PALACE_VERB_IDS) {
    if (!byId.has(verbId)) {
      byId.set(verbId, defaultHistoryEntry(verbId));
      changed = true;
    }
  }

  if (!raw) {
    changed = true;
  } else if (!changed) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
        changed = true;
      }
    } catch {
      changed = true;
    }
  }

  if (!changed) return;

  const merged = MEMORY_PALACE_VERB_IDS.map((verbId) => byId.get(verbId) ?? defaultHistoryEntry(verbId));
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(merged));
}

export async function getMemoryPalaceHistory(): Promise<string[]> {
  await ensureMemoryPalaceHistoryMerged();
  const raw = await AsyncStorage.getItem(HISTORY_KEY);
  const entries = parseHistoryEntries(raw);
  return entries.filter((entry) => entry.visited).map((entry) => entry.verbId);
}

export async function markMemoryPalaceVisited(verbSetId: string): Promise<void> {
  await ensureMemoryPalaceHistoryMerged();
  const raw = await AsyncStorage.getItem(HISTORY_KEY);
  const entries = parseHistoryEntries(raw);
  const byId = new Map(entries.map((entry) => [entry.verbId, entry]));
  const existing = byId.get(verbSetId);
  const now = new Date().toISOString();

  byId.set(verbSetId, {
    verbId: verbSetId,
    visited: true,
    lastVisited: now,
    timesCompleted: (existing?.timesCompleted ?? 0) + 1,
  });

  const merged = [
    ...MEMORY_PALACE_VERB_IDS.map((verbId) => byId.get(verbId) ?? defaultHistoryEntry(verbId)),
    ...Array.from(byId.values()).filter(
      (entry) => !MEMORY_PALACE_VERB_IDS.includes(entry.verbId as (typeof MEMORY_PALACE_VERB_IDS)[number]),
    ),
  ];
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(merged));
}

export function findVerbSet(
  groups: MemoryPalaceWeekGroup[],
  verbSetId: string,
): MemoryPalaceVerbSet | null {
  for (const group of groups) {
    const found = group.verbSets.find((v) => v.id === verbSetId);
    if (found) return found;
  }
  return null;
}

export function normalizePalaceAnswer(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function checkPalaceAnswer(slot: PalaceSlot, userAnswer: string): boolean {
  const normalized = normalizePalaceAnswer(userAnswer);
  if (!normalized) return false;
  return slot.acceptableAnswers.some((a) => normalizePalaceAnswer(a) === normalized);
}

export function walkthroughSuccessMessage(slot: PalaceSlot): string {
  return `✅ ${slot.answer.charAt(0).toUpperCase() + slot.answer.slice(1)} — ${slot.itemName}. Remember that image.`;
}

export function walkthroughRetryMessage(slot: PalaceSlot): string {
  return `Take your time. ${slot.itemName} holds "${slot.answer}" — ${slot.memoryHook}. Try again when you're ready.`;
}

export function quizSuccessMessage(): string {
  return '✅ Got it.';
}

export function quizRetryMessage(slot: PalaceSlot): string {
  return `The ${slot.itemName} holds ${slot.answer} — ${slot.memoryHook}. Try again.`;
}

export function freeRecallIntro(name: string): string {
  const n = name.trim() || 'friend';
  return `Now close your eyes, ${n}. Walk through your kitchen in your mind. Tell me what you find at each item — one conjugation at a time. There's no rush here.`;
}

export function freeRecallPrompt(slot: PalaceSlot, index: number): string {
  const ordinals = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth'];
  return `${ordinals[index] ?? 'Next'} — at ${slot.itemEmoji} ${slot.itemName}. What conjugation lives there?`;
}

export function freeRecallConfirm(slot: PalaceSlot): string {
  return `✅ Yes — ${slot.itemName}: ${slot.answer}. Let it stick.`;
}

export async function getUnlockedPalaceGroups(
  name: string,
): Promise<{ groups: MemoryPalaceWeekGroup[]; currentWeek: number }> {
  await ensureMemoryPalaceHistoryMerged();
  const curriculum = await resolveGrammarCurriculum();
  const allGroups = buildVerbSetsForUser(name);
  const groups = allGroups.filter((g) =>
    isWeekGroupUnlocked(g, curriculum.currentWeek, curriculum.completedWeeks),
  );
  return { groups, currentWeek: curriculum.currentWeek };
}
