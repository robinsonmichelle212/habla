import type { MemoryPalaceVerbSet, PalacePerson, PalaceSlot } from '@/lib/memory-palace';

const ITEMS: Record<
  PalacePerson,
  { itemEmoji: string; itemName: string }
> = {
  yo: { itemEmoji: '🫖', itemName: 'the kettle' },
  tu: { itemEmoji: '🧊', itemName: 'the fridge' },
  el: { itemEmoji: '🍳', itemName: 'the cooker' },
  nosotros: { itemEmoji: '🪑', itemName: 'the kitchen table' },
  vosotros: { itemEmoji: '🪟', itemName: 'the window' },
  ellos: { itemEmoji: '🚪', itemName: 'the kitchen door' },
};

const PERSON_ORDER: PalacePerson[] = ['yo', 'tu', 'el', 'nosotros', 'vosotros', 'ellos'];

const PERSON_LABEL: Record<PalacePerson, string> = {
  yo: 'yo',
  tu: 'tú',
  el: 'él/ella',
  nosotros: 'nosotros',
  vosotros: 'vosotros',
  ellos: 'ellos/ellas',
};

type Forms = Record<PalacePerson, string>;

type VerbSpec = {
  id: string;
  label: string;
  meaning: string;
  forms: Forms;
};

function personalize(text: string, name: string): string {
  return text.replace(/\{name\}/g, name);
}

function quizFor(itemName: string): string {
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

function buildSlots(
  forms: Forms,
  name: string,
  tenseHint: string,
): PalaceSlot[] {
  return PERSON_ORDER.map((person) => {
    const item = ITEMS[person];
    const answer = forms[person];
    return {
      person,
      itemEmoji: item.itemEmoji,
      itemName: item.itemName,
      answer,
      acceptableAnswers: [answer],
      memoryHook: `${PERSON_LABEL[person]} → ${answer}`,
      walkthroughScene: personalize(
        `${item.itemEmoji} {name}, at ${item.itemName} — ${tenseHint}: ${PERSON_LABEL[person]} → ${answer}. Say it: ${answer}.`,
        name,
      ),
      quizPrompt: quizFor(item.itemName),
    };
  });
}

function buildVerbSet(
  spec: VerbSpec,
  name: string,
  tenseHint: string,
  preview: string,
): MemoryPalaceVerbSet {
  return {
    id: spec.id,
    verbLabel: spec.label,
    englishMeaning: spec.meaning,
    previewForms: preview,
    slots: buildSlots(spec.forms, name, tenseHint),
  };
}

function previewFrom(forms: Forms): string {
  return `${forms.yo}, ${forms.tu}, ${forms.el}…`;
}

const PRESENT: VerbSpec[] = [
  {
    id: 'ser_present',
    label: 'SER',
    meaning: 'to be (identity)',
    forms: { yo: 'soy', tu: 'eres', el: 'es', nosotros: 'somos', vosotros: 'sois', ellos: 'son' },
  },
  {
    id: 'estar_present',
    label: 'ESTAR',
    meaning: 'to be (state/location)',
    forms: {
      yo: 'estoy',
      tu: 'estás',
      el: 'está',
      nosotros: 'estamos',
      vosotros: 'estáis',
      ellos: 'están',
    },
  },
  {
    id: 'tener_present',
    label: 'TENER',
    meaning: 'to have',
    forms: {
      yo: 'tengo',
      tu: 'tienes',
      el: 'tiene',
      nosotros: 'tenemos',
      vosotros: 'tenéis',
      ellos: 'tienen',
    },
  },
  {
    id: 'ir_present',
    label: 'IR',
    meaning: 'to go',
    forms: { yo: 'voy', tu: 'vas', el: 'va', nosotros: 'vamos', vosotros: 'vais', ellos: 'van' },
  },
  {
    id: 'hacer_present',
    label: 'HACER',
    meaning: 'to do / make',
    forms: {
      yo: 'hago',
      tu: 'haces',
      el: 'hace',
      nosotros: 'hacemos',
      vosotros: 'hacéis',
      ellos: 'hacen',
    },
  },
  {
    id: 'poder_present',
    label: 'PODER',
    meaning: 'to be able to',
    forms: {
      yo: 'puedo',
      tu: 'puedes',
      el: 'puede',
      nosotros: 'podemos',
      vosotros: 'podéis',
      ellos: 'pueden',
    },
  },
  {
    id: 'querer_present',
    label: 'QUERER',
    meaning: 'to want',
    forms: {
      yo: 'quiero',
      tu: 'quieres',
      el: 'quiere',
      nosotros: 'queremos',
      vosotros: 'queréis',
      ellos: 'quieren',
    },
  },
  {
    id: 'saber_present',
    label: 'SABER',
    meaning: 'to know',
    forms: { yo: 'sé', tu: 'sabes', el: 'sabe', nosotros: 'sabemos', vosotros: 'sabéis', ellos: 'saben' },
  },
  {
    id: 'dar_present',
    label: 'DAR',
    meaning: 'to give',
    forms: { yo: 'doy', tu: 'das', el: 'da', nosotros: 'damos', vosotros: 'dais', ellos: 'dan' },
  },
  {
    id: 'venir_present',
    label: 'VENIR',
    meaning: 'to come',
    forms: {
      yo: 'vengo',
      tu: 'vienes',
      el: 'viene',
      nosotros: 'venimos',
      vosotros: 'venís',
      ellos: 'vienen',
    },
  },
];

const IMPERFECT: VerbSpec[] = [
  {
    id: 'ser_imperfect',
    label: 'SER',
    meaning: 'to be — imperfect',
    forms: { yo: 'era', tu: 'eras', el: 'era', nosotros: 'éramos', vosotros: 'erais', ellos: 'eran' },
  },
  {
    id: 'estar_imperfect',
    label: 'ESTAR',
    meaning: 'to be — imperfect',
    forms: {
      yo: 'estaba',
      tu: 'estabas',
      el: 'estaba',
      nosotros: 'estábamos',
      vosotros: 'estabais',
      ellos: 'estaban',
    },
  },
  {
    id: 'tener_imperfect',
    label: 'TENER',
    meaning: 'to have — imperfect',
    forms: {
      yo: 'tenía',
      tu: 'tenías',
      el: 'tenía',
      nosotros: 'teníamos',
      vosotros: 'teníais',
      ellos: 'tenían',
    },
  },
  {
    id: 'ir_imperfect',
    label: 'IR',
    meaning: 'to go — imperfect',
    forms: { yo: 'iba', tu: 'ibas', el: 'iba', nosotros: 'íbamos', vosotros: 'ibais', ellos: 'iban' },
  },
  {
    id: 'hacer_imperfect',
    label: 'HACER',
    meaning: 'to do — imperfect',
    forms: {
      yo: 'hacía',
      tu: 'hacías',
      el: 'hacía',
      nosotros: 'hacíamos',
      vosotros: 'hacíais',
      ellos: 'hacían',
    },
  },
  {
    id: 'poder_imperfect',
    label: 'PODER',
    meaning: 'to be able — imperfect',
    forms: {
      yo: 'podía',
      tu: 'podías',
      el: 'podía',
      nosotros: 'podíamos',
      vosotros: 'podíais',
      ellos: 'podían',
    },
  },
  {
    id: 'querer_imperfect',
    label: 'QUERER',
    meaning: 'to want — imperfect',
    forms: {
      yo: 'quería',
      tu: 'querías',
      el: 'quería',
      nosotros: 'queríamos',
      vosotros: 'queríais',
      ellos: 'querían',
    },
  },
  {
    id: 'saber_imperfect',
    label: 'SABER',
    meaning: 'to know — imperfect',
    forms: {
      yo: 'sabía',
      tu: 'sabías',
      el: 'sabía',
      nosotros: 'sabíamos',
      vosotros: 'sabíais',
      ellos: 'sabían',
    },
  },
  {
    id: 'dar_imperfect',
    label: 'DAR',
    meaning: 'to give — imperfect',
    forms: {
      yo: 'daba',
      tu: 'dabas',
      el: 'daba',
      nosotros: 'dábamos',
      vosotros: 'dabais',
      ellos: 'daban',
    },
  },
  {
    id: 'venir_imperfect',
    label: 'VENIR',
    meaning: 'to come — imperfect',
    forms: {
      yo: 'venía',
      tu: 'venías',
      el: 'venía',
      nosotros: 'veníamos',
      vosotros: 'veníais',
      ellos: 'venían',
    },
  },
];

const FUTURE: VerbSpec[] = [
  {
    id: 'ser_future',
    label: 'SER',
    meaning: 'to be — future',
    forms: {
      yo: 'seré',
      tu: 'serás',
      el: 'será',
      nosotros: 'seremos',
      vosotros: 'seréis',
      ellos: 'serán',
    },
  },
  {
    id: 'estar_future',
    label: 'ESTAR',
    meaning: 'to be — future',
    forms: {
      yo: 'estaré',
      tu: 'estarás',
      el: 'estará',
      nosotros: 'estaremos',
      vosotros: 'estaréis',
      ellos: 'estarán',
    },
  },
  {
    id: 'tener_future',
    label: 'TENER',
    meaning: 'to have — future',
    forms: {
      yo: 'tendré',
      tu: 'tendrás',
      el: 'tendrá',
      nosotros: 'tendremos',
      vosotros: 'tendréis',
      ellos: 'tendrán',
    },
  },
  {
    id: 'ir_future',
    label: 'IR',
    meaning: 'to go — future',
    forms: { yo: 'iré', tu: 'irás', el: 'irá', nosotros: 'iremos', vosotros: 'iréis', ellos: 'irán' },
  },
  {
    id: 'hacer_future',
    label: 'HACER',
    meaning: 'to do — future',
    forms: {
      yo: 'haré',
      tu: 'harás',
      el: 'hará',
      nosotros: 'haremos',
      vosotros: 'haréis',
      ellos: 'harán',
    },
  },
  {
    id: 'poder_future',
    label: 'PODER',
    meaning: 'to be able — future',
    forms: {
      yo: 'podré',
      tu: 'podrás',
      el: 'podrá',
      nosotros: 'podremos',
      vosotros: 'podréis',
      ellos: 'podrán',
    },
  },
  {
    id: 'querer_future',
    label: 'QUERER',
    meaning: 'to want — future',
    forms: {
      yo: 'querré',
      tu: 'querrás',
      el: 'querrá',
      nosotros: 'querremos',
      vosotros: 'querréis',
      ellos: 'querrán',
    },
  },
  {
    id: 'saber_future',
    label: 'SABER',
    meaning: 'to know — future',
    forms: {
      yo: 'sabré',
      tu: 'sabrás',
      el: 'sabrá',
      nosotros: 'sabremos',
      vosotros: 'sabréis',
      ellos: 'sabrán',
    },
  },
  {
    id: 'dar_future',
    label: 'DAR',
    meaning: 'to give — future',
    forms: {
      yo: 'daré',
      tu: 'darás',
      el: 'dará',
      nosotros: 'daremos',
      vosotros: 'daréis',
      ellos: 'darán',
    },
  },
  {
    id: 'venir_future',
    label: 'VENIR',
    meaning: 'to come — future',
    forms: {
      yo: 'vendré',
      tu: 'vendrás',
      el: 'vendrá',
      nosotros: 'vendremos',
      vosotros: 'vendréis',
      ellos: 'vendrán',
    },
  },
];

const CONDITIONAL: VerbSpec[] = [
  {
    id: 'ser_conditional',
    label: 'SER',
    meaning: 'to be — conditional',
    forms: {
      yo: 'sería',
      tu: 'serías',
      el: 'sería',
      nosotros: 'seríamos',
      vosotros: 'seríais',
      ellos: 'serían',
    },
  },
  {
    id: 'estar_conditional',
    label: 'ESTAR',
    meaning: 'to be — conditional',
    forms: {
      yo: 'estaría',
      tu: 'estarías',
      el: 'estaría',
      nosotros: 'estaríamos',
      vosotros: 'estaríais',
      ellos: 'estarían',
    },
  },
  {
    id: 'tener_conditional',
    label: 'TENER',
    meaning: 'to have — conditional',
    forms: {
      yo: 'tendría',
      tu: 'tendrías',
      el: 'tendría',
      nosotros: 'tendríamos',
      vosotros: 'tendríais',
      ellos: 'tendrían',
    },
  },
  {
    id: 'ir_conditional',
    label: 'IR',
    meaning: 'to go — conditional',
    forms: {
      yo: 'iría',
      tu: 'irías',
      el: 'iría',
      nosotros: 'iríamos',
      vosotros: 'iríais',
      ellos: 'irían',
    },
  },
  {
    id: 'hacer_conditional',
    label: 'HACER',
    meaning: 'to do — conditional',
    forms: {
      yo: 'haría',
      tu: 'harías',
      el: 'haría',
      nosotros: 'haríamos',
      vosotros: 'haríais',
      ellos: 'harían',
    },
  },
  {
    id: 'poder_conditional',
    label: 'PODER',
    meaning: 'to be able — conditional',
    forms: {
      yo: 'podría',
      tu: 'podrías',
      el: 'podría',
      nosotros: 'podríamos',
      vosotros: 'podríais',
      ellos: 'podrían',
    },
  },
  {
    id: 'querer_conditional',
    label: 'QUERER',
    meaning: 'to want — conditional',
    forms: {
      yo: 'querría',
      tu: 'querrías',
      el: 'querría',
      nosotros: 'querríamos',
      vosotros: 'querríais',
      ellos: 'querrían',
    },
  },
  {
    id: 'saber_conditional',
    label: 'SABER',
    meaning: 'to know — conditional',
    forms: {
      yo: 'sabría',
      tu: 'sabrías',
      el: 'sabría',
      nosotros: 'sabríamos',
      vosotros: 'sabríais',
      ellos: 'sabrían',
    },
  },
  {
    id: 'dar_conditional',
    label: 'DAR',
    meaning: 'to give — conditional',
    forms: {
      yo: 'daría',
      tu: 'darías',
      el: 'daría',
      nosotros: 'daríamos',
      vosotros: 'daríais',
      ellos: 'darían',
    },
  },
  {
    id: 'venir_conditional',
    label: 'VENIR',
    meaning: 'to come — conditional',
    forms: {
      yo: 'vendría',
      tu: 'vendrías',
      el: 'vendría',
      nosotros: 'vendríamos',
      vosotros: 'vendríais',
      ellos: 'vendrían',
    },
  },
];

const SUBJUNCTIVE: VerbSpec[] = [
  {
    id: 'ser_subjunctive',
    label: 'SER',
    meaning: 'to be — present subjunctive',
    forms: { yo: 'sea', tu: 'seas', el: 'sea', nosotros: 'seamos', vosotros: 'seáis', ellos: 'sean' },
  },
  {
    id: 'estar_subjunctive',
    label: 'ESTAR',
    meaning: 'to be — present subjunctive',
    forms: {
      yo: 'esté',
      tu: 'estés',
      el: 'esté',
      nosotros: 'estemos',
      vosotros: 'estéis',
      ellos: 'estén',
    },
  },
  {
    id: 'tener_subjunctive',
    label: 'TENER',
    meaning: 'to have — present subjunctive',
    forms: {
      yo: 'tenga',
      tu: 'tengas',
      el: 'tenga',
      nosotros: 'tengamos',
      vosotros: 'tengáis',
      ellos: 'tengan',
    },
  },
  {
    id: 'ir_subjunctive',
    label: 'IR',
    meaning: 'to go — present subjunctive',
    forms: {
      yo: 'vaya',
      tu: 'vayas',
      el: 'vaya',
      nosotros: 'vayamos',
      vosotros: 'vayáis',
      ellos: 'vayan',
    },
  },
  {
    id: 'hacer_subjunctive',
    label: 'HACER',
    meaning: 'to do — present subjunctive',
    forms: {
      yo: 'haga',
      tu: 'hagas',
      el: 'haga',
      nosotros: 'hagamos',
      vosotros: 'hagáis',
      ellos: 'hagan',
    },
  },
  {
    id: 'poder_subjunctive',
    label: 'PODER',
    meaning: 'to be able — present subjunctive',
    forms: {
      yo: 'pueda',
      tu: 'puedas',
      el: 'pueda',
      nosotros: 'podamos',
      vosotros: 'podáis',
      ellos: 'puedan',
    },
  },
  {
    id: 'querer_subjunctive',
    label: 'QUERER',
    meaning: 'to want — present subjunctive',
    forms: {
      yo: 'quiera',
      tu: 'quieras',
      el: 'quiera',
      nosotros: 'queramos',
      vosotros: 'queráis',
      ellos: 'quieran',
    },
  },
  {
    id: 'saber_subjunctive',
    label: 'SABER',
    meaning: 'to know — present subjunctive',
    forms: {
      yo: 'sepa',
      tu: 'sepas',
      el: 'sepa',
      nosotros: 'sepamos',
      vosotros: 'sepáis',
      ellos: 'sepan',
    },
  },
  {
    id: 'dar_subjunctive',
    label: 'DAR',
    meaning: 'to give — present subjunctive',
    forms: { yo: 'dé', tu: 'des', el: 'dé', nosotros: 'demos', vosotros: 'deis', ellos: 'den' },
  },
  {
    id: 'venir_subjunctive',
    label: 'VENIR',
    meaning: 'to come — present subjunctive',
    forms: {
      yo: 'venga',
      tu: 'vengas',
      el: 'venga',
      nosotros: 'vengamos',
      vosotros: 'vengáis',
      ellos: 'vengan',
    },
  },
];

const REFLEXIVE: VerbSpec[] = [
  {
    id: 'levantarse_reflexive',
    label: 'LEVANTARSE',
    meaning: 'to get up',
    forms: {
      yo: 'me levanto',
      tu: 'te levantas',
      el: 'se levanta',
      nosotros: 'nos levantamos',
      vosotros: 'os levantáis',
      ellos: 'se levantan',
    },
  },
  {
    id: 'acostarse_reflexive',
    label: 'ACOSTARSE',
    meaning: 'to go to bed',
    forms: {
      yo: 'me acuesto',
      tu: 'te acuestas',
      el: 'se acuesta',
      nosotros: 'nos acostamos',
      vosotros: 'os acostáis',
      ellos: 'se acuestan',
    },
  },
  {
    id: 'ducharse_reflexive',
    label: 'DUCHARSE',
    meaning: 'to shower',
    forms: {
      yo: 'me ducho',
      tu: 'te duchas',
      el: 'se ducha',
      nosotros: 'nos duchamos',
      vosotros: 'os ducháis',
      ellos: 'se duchan',
    },
  },
  {
    id: 'vestirse_reflexive',
    label: 'VESTIRSE',
    meaning: 'to get dressed',
    forms: {
      yo: 'me visto',
      tu: 'te vistes',
      el: 'se viste',
      nosotros: 'nos vestimos',
      vosotros: 'os vestís',
      ellos: 'se visten',
    },
  },
  {
    id: 'llamarse_reflexive',
    label: 'LLAMARSE',
    meaning: 'to be called',
    forms: {
      yo: 'me llamo',
      tu: 'te llamas',
      el: 'se llama',
      nosotros: 'nos llamamos',
      vosotros: 'os llamáis',
      ellos: 'se llaman',
    },
  },
  {
    id: 'sentirse_reflexive',
    label: 'SENTIRSE',
    meaning: 'to feel',
    forms: {
      yo: 'me siento',
      tu: 'te sientes',
      el: 'se siente',
      nosotros: 'nos sentimos',
      vosotros: 'os sentís',
      ellos: 'se sienten',
    },
  },
  {
    id: 'ponerse_reflexive',
    label: 'PONERSE',
    meaning: 'to put on / become',
    forms: {
      yo: 'me pongo',
      tu: 'te pones',
      el: 'se pone',
      nosotros: 'nos ponemos',
      vosotros: 'os ponéis',
      ellos: 'se ponen',
    },
  },
  {
    id: 'irse_reflexive',
    label: 'IRSE',
    meaning: 'to leave',
    forms: {
      yo: 'me voy',
      tu: 'te vas',
      el: 'se va',
      nosotros: 'nos vamos',
      vosotros: 'os vais',
      ellos: 'se van',
    },
  },
  {
    id: 'quedarse_reflexive',
    label: 'QUEDARSE',
    meaning: 'to stay',
    forms: {
      yo: 'me quedo',
      tu: 'te quedas',
      el: 'se queda',
      nosotros: 'nos quedamos',
      vosotros: 'os quedáis',
      ellos: 'se quedan',
    },
  },
  {
    id: 'despertarse_reflexive',
    label: 'DESPERTARSE',
    meaning: 'to wake up',
    forms: {
      yo: 'me despierto',
      tu: 'te despiertas',
      el: 'se despierta',
      nosotros: 'nos despertamos',
      vosotros: 'os despertáis',
      ellos: 'se despiertan',
    },
  },
];

/** Essential gerunds as a single walk (weeks 21–22 catalog addition). */
const ESSENTIAL_GERUNDS: Forms = {
  yo: 'siendo',
  tu: 'estando',
  el: 'teniendo',
  nosotros: 'yendo',
  vosotros: 'haciendo',
  ellos: 'pudiendo',
};

const ESSENTIAL_PARTICIPLES: Forms = {
  yo: 'sido',
  tu: 'estado',
  el: 'tenido',
  nosotros: 'ido',
  vosotros: 'hecho',
  ellos: 'podido',
};

const PERFECT: Forms = {
  yo: 'he sido',
  tu: 'has estado',
  el: 'ha tenido',
  nosotros: 'hemos ido',
  vosotros: 'habéis hecho',
  ellos: 'han venido',
};

const IMPERATIVE_TU: Forms = {
  yo: 'sé',
  tu: 'está',
  el: 'ten',
  nosotros: 've',
  vosotros: 'haz',
  ellos: 'ven',
};

const IMPERATIVE_USTED: Forms = {
  yo: 'sea',
  tu: 'esté',
  el: 'tenga',
  nosotros: 'vaya',
  vosotros: 'haga',
  ellos: 'venga',
};

function mapSpecs(specs: VerbSpec[], name: string, tenseHint: string): MemoryPalaceVerbSet[] {
  return specs.map((spec) => buildVerbSet(spec, name, tenseHint, previewFrom(spec.forms)));
}

export function buildPresentSets(name: string): MemoryPalaceVerbSet[] {
  return mapSpecs(PRESENT, name, 'present tense');
}

export function buildImperfectSets(name: string): MemoryPalaceVerbSet[] {
  return mapSpecs(IMPERFECT, name, 'imperfect');
}

export function buildFutureSets(name: string): MemoryPalaceVerbSet[] {
  return mapSpecs(FUTURE, name, 'future tense');
}

export function buildConditionalSets(name: string): MemoryPalaceVerbSet[] {
  return mapSpecs(CONDITIONAL, name, 'conditional');
}

export function buildSubjunctiveSets(name: string): MemoryPalaceVerbSet[] {
  return mapSpecs(SUBJUNCTIVE, name, 'present subjunctive');
}

export function buildReflexiveSets(name: string): MemoryPalaceVerbSet[] {
  return mapSpecs(REFLEXIVE, name, 'reflexive verb');
}

export function buildEssentialGerundSet(name: string): MemoryPalaceVerbSet {
  return {
    id: 'essential_gerunds',
    verbLabel: 'GERUNDS',
    englishMeaning: 'essential present participles',
    previewForms: 'siendo, estando, teniendo…',
    slots: buildSlots(ESSENTIAL_GERUNDS, name, 'gerund'),
  };
}

export function buildEssentialParticipleSet(name: string): MemoryPalaceVerbSet {
  return {
    id: 'essential_participles',
    verbLabel: 'PARTICIPLES',
    englishMeaning: 'essential past participles',
    previewForms: 'sido, estado, tenido…',
    slots: buildSlots(ESSENTIAL_PARTICIPLES, name, 'past participle'),
  };
}

export function buildPerfectSet(name: string): MemoryPalaceVerbSet {
  return {
    id: 'perfect_haber',
    verbLabel: 'PERFECT (HABER +)',
    englishMeaning: 'haber + past participle',
    previewForms: 'he sido, has estado, ha tenido…',
    slots: buildSlots(PERFECT, name, 'perfect tense'),
  };
}

export function buildImperativeSets(name: string): MemoryPalaceVerbSet[] {
  return [
    {
      id: 'imperative_tu',
      verbLabel: 'IMPERATIVE (tú)',
      englishMeaning: 'commands — tú form',
      previewForms: 'sé, ten, ve, haz, ven…',
      slots: buildSlots(IMPERATIVE_TU, name, 'imperative (tú)'),
    },
    {
      id: 'imperative_usted',
      verbLabel: 'IMPERATIVE (usted)',
      englishMeaning: 'commands — usted form',
      previewForms: 'sea, tenga, vaya, haga, venga…',
      slots: buildSlots(IMPERATIVE_USTED, name, 'imperative (usted)'),
    },
  ];
}

/** Mixed preterite + imperfect yo-forms for weeks 7–8. */
export function buildPreteriteVsImperfectSet(name: string): MemoryPalaceVerbSet {
  const pairs: Array<{ person: PalacePerson; answer: string; hint: string }> = [
    { person: 'yo', answer: 'fui', hint: 'preterite — completed trip' },
    { person: 'tu', answer: 'era', hint: 'imperfect — ongoing state' },
    { person: 'el', answer: 'tuve', hint: 'preterite — one completed moment' },
    { person: 'nosotros', answer: 'teníamos', hint: 'imperfect — used to have' },
    { person: 'vosotros', answer: 'hice', hint: 'preterite — I did it once' },
    { person: 'ellos', answer: 'hacía', hint: 'imperfect — was doing / used to' },
  ];
  return {
    id: 'preterite_vs_imperfect',
    verbLabel: 'PRETERITE VS IMPERFECT',
    englishMeaning: 'practise both past tenses together',
    previewForms: 'fui / era, tuve / tenía…',
    slots: pairs.map(({ person, answer, hint }) => {
      const item = ITEMS[person];
      return {
        person,
        itemEmoji: item.itemEmoji,
        itemName: item.itemName,
        answer,
        acceptableAnswers: [answer],
        memoryHook: hint,
        walkthroughScene: personalize(
          `${item.itemEmoji} {name}, at ${item.itemName} — ${hint}. Say it: ${answer}.`,
          name,
        ),
        quizPrompt: quizFor(item.itemName),
      };
    }),
  };
}

/** Ser vs estar across learned tenses — weeks 15–16. */
export function buildSerVsEstarSet(name: string): MemoryPalaceVerbSet {
  const pairs: Array<{ person: PalacePerson; answer: string; hint: string }> = [
    { person: 'yo', answer: 'soy', hint: 'ser present — identity' },
    { person: 'tu', answer: 'estoy', hint: 'estar present — temporary state' },
    { person: 'el', answer: 'fui', hint: 'ser/ir preterite — completed' },
    { person: 'nosotros', answer: 'estuve', hint: 'estar preterite — was (location/state)' },
    { person: 'vosotros', answer: 'era', hint: 'ser imperfect — used to be' },
    { person: 'ellos', answer: 'estaba', hint: 'estar imperfect — was being' },
  ];
  return {
    id: 'ser_vs_estar',
    verbLabel: 'SER VS ESTAR',
    englishMeaning: 'side-by-side comparison across tenses',
    previewForms: 'soy / estoy, fui / estuve…',
    slots: pairs.map(({ person, answer, hint }) => {
      const item = ITEMS[person];
      return {
        person,
        itemEmoji: item.itemEmoji,
        itemName: item.itemName,
        answer,
        acceptableAnswers: [answer],
        memoryHook: hint,
        walkthroughScene: personalize(
          `${item.itemEmoji} {name}, at ${item.itemName} — ${hint}. Say it: ${answer}.`,
          name,
        ),
        quizPrompt: quizFor(item.itemName),
      };
    }),
  };
}
