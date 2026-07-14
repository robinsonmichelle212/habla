import type { GrammarTopic } from '@/lib/grammar-curriculum';
import type { ErrorDNAItem } from '@/lib/error-dna';

const TOPIC_KEYWORDS: Record<GrammarTopic, string[]> = {
  'Present tense': ['present', 'presente', 'soy', 'estoy', 'tengo', 'voy'],
  Preterite: ['preterite', 'pretérito', 'indefinido', 'fui', 'hice', 'tuve', 'past completed'],
  Imperfect: ['imperfect', 'imperfecto', 'iba', 'era', 'habitual', 'description'],
  'Preterite vs Imperfect': ['preterite vs imperfect', 'pretérito vs imperfecto', 'contrast', 'choice'],
  'Future tense': ['future', 'futuro', 'will', 'iré', 'haré'],
  Conditional: ['conditional', 'condicional', 'would', 'haría', 'iría'],
  'Present subjunctive': ['subjunctive', 'subjuntivo', 'sea', 'esté', 'doubt', 'wish'],
  'Ser vs Estar': ['ser vs estar', 'ser', 'estar', 'permanent', 'temporary'],
  'Por vs Para': ['por', 'para', 'por vs para'],
  'Reflexive verbs': ['reflexive', 'reflexivo', 'me ', 'se ', 'levantarse'],
  'Present participle (gerund)': ['gerund', 'gerundio', 'ando', 'iendo', 'estando', 'progresivo'],
  'Past participle': ['past participle', 'participio', 'hecho', 'visto', 'abierto', 'ado', 'ido'],
  'Perfect tenses': ['perfect', 'perfecto', 'haber', 'he ', 'has ', 'ha ', 'había', 'pluscuamperfecto'],
  'Core prepositions': ['preposition', 'preposición', ' a ', ' en ', ' de ', 'con', 'sin', 'sobre'],
  'Compound prepositions': ['delante de', 'después de', 'encima de', 'cerca de', 'a pesar de', 'en vez de'],
  'Verbs with prepositions': ['soñar con', 'pensar en', 'casarse con', 'depender de', 'enamorarse de'],
  'Imperative mood': ['imperative', 'imperativo', 'command', 'haz', 've', 'di', 'no hables'],
};

export function getErrorsForGrammarTopic(
  errors: ErrorDNAItem[],
  topic: GrammarTopic,
): ErrorDNAItem[] {
  const keywords = TOPIC_KEYWORDS[topic].map((k) => k.toLowerCase());
  return errors
    .filter((e) => e.category === 'grammar')
    .filter((e) => {
      const haystack = `${e.error} ${e.example} ${e.correction}`.toLowerCase();
      return keywords.some((kw) => haystack.includes(kw));
    })
    .sort((a, b) => b.occurrences - a.occurrences);
}

export type TenseGuideContent = {
  whenToUse: string[];
  howToForm: string[];
  irregularVerbs: string[];
  memoryTips: string[];
  commonMistakesGeneral: string[];
  contrast?: {
    title: string;
    preterite: string[];
    imperfect: string[];
  };
  examples: { spanish: string; english: string }[];
};

export const TENSE_GUIDE_CONTENT: Record<GrammarTopic, TenseGuideContent> = {
  'Present tense': {
    whenToUse: [
      'Actions happening right now: Estoy estudiando español.',
      'Habits and routines: Trabajo los lunes.',
      'General truths: El sol sale por el este.',
      'Near future with ir + a: Voy a salir pronto.',
    ],
    howToForm: [
      'Remove -ar, -er, or -ir from the infinitive.',
      '-ar verbs: -o, -as, -a, -amos, -áis, -an',
      '-er/-ir verbs: -o, -es, -e, -emos, -éis, -en',
      'Stem-changing verbs change the vowel in the boot (e→ie, o→ue, e→i).',
    ],
    irregularVerbs: ['ser', 'estar', 'tener', 'ir', 'hacer', 'poder', 'querer', 'saber', 'dar', 'venir'],
    memoryTips: ['If it feels like “right now” or “usually”, present is your friend.'],
    commonMistakesGeneral: [
      'Mixing up ser and estar in descriptions.',
      'Forgetting stem changes (poder → puedo, not podo).',
      'Using English word order with gustar.',
    ],
    examples: [
      { spanish: 'Tengo dos hermanos.', english: 'I have two siblings.' },
      { spanish: '¿Qué haces los fines de semana?', english: 'What do you do on weekends?' },
      { spanish: 'Ella vive en Madrid.', english: 'She lives in Madrid.' },
      { spanish: 'No puedo ir hoy.', english: "I can't go today." },
      { spanish: 'Queremos aprender más.', english: 'We want to learn more.' },
    ],
  },
  Preterite: {
    whenToUse: [
      'Completed actions with a clear end: Ayer comí pizza.',
      'A chain of past events: Llegué, vi y salí.',
      'Actions at a specific time: En 2010 viajé a España.',
      'Sudden changes: De repente empezó a llover.',
    ],
    howToForm: [
      '-ar: -é, -aste, -ó, -amos, -asteis, -aron',
      '-er/-ir: -í, -iste, -ió, -imos, -isteis, -ieron',
      'Third-person preterite often has accent: habló, comió.',
      'Many common verbs are completely irregular (ser/ir, tener, hacer…).',
    ],
    irregularVerbs: ['ser/ir', 'tener', 'hacer', 'poder', 'querer', 'saber', 'venir', 'dar', 'ver', 'decir'],
    memoryTips: ['Think “snapshot” — one finished moment in the past.'],
    commonMistakesGeneral: [
      'Using preterite for background description (use imperfect instead).',
      'Wrong irregular stem: *haco instead of hice.',
      'Forgetting accents on él/ella forms.',
    ],
    examples: [
      { spanish: 'Ayer hablé con mi madre.', english: 'Yesterday I spoke with my mother.' },
      { spanish: 'Compramos entradas y fuimos al cine.', english: 'We bought tickets and went to the cinema.' },
      { spanish: '¿Qué hiciste el fin de semana?', english: 'What did you do at the weekend?' },
      { spanish: 'Llegó tarde a la reunión.', english: 'He arrived late to the meeting.' },
      { spanish: 'No pude dormir bien.', english: "I couldn't sleep well." },
    ],
    contrast: {
      title: 'Preterite vs Imperfect',
      preterite: [
        'Completed action: Comí a las ocho.',
        'Specific moment: Ayer llovió.',
        'Sequence of events: Entró, vio y salió.',
      ],
      imperfect: [
        'Ongoing background: Comía cuando llamaste.',
        'Habit in the past: Siempre comía tarde.',
        'Description: Hacía frío y llovía.',
      ],
    },
  },
  Imperfect: {
    whenToUse: [
      'Ongoing past actions: Mientras cocinaba, escuchaba música.',
      'Habits in the past: De niño jugaba en el parque.',
      'Descriptions: El cielo estaba gris.',
      'Time and age in the past: Eran las tres. Tenía diez años.',
    ],
    howToForm: [
      '-ar: -aba, -abas, -aba, -ábamos, -abais, -aban',
      '-er/-ir: -ía, -ías, -ía, -íamos, -íais, -ían',
      'Only three common verbs are irregular: ser (era), ir (iba), ver (veía).',
      'Regular pattern — most verbs follow the rules exactly.',
    ],
    irregularVerbs: ['ser (era)', 'ir (iba)', 'ver (veía)'],
    memoryTips: ['Think “video” — background scene, not a single click.'],
    commonMistakesGeneral: [
      'Using imperfect for a single finished event.',
      'Confusing era (imperfect) with fue (preterite) for “was”.',
      'Forgetting that había is imperfect of haber.',
    ],
    examples: [
      { spanish: 'Cuando era niño, vivía en el campo.', english: 'When I was a child, I lived in the countryside.' },
      { spanish: 'Siempre íbamos a la playa en verano.', english: 'We always went to the beach in summer.' },
      { spanish: 'Hacía sol y hacía calor.', english: 'It was sunny and hot.' },
      { spanish: '¿Qué hacías a las ocho?', english: 'What were you doing at eight?' },
      { spanish: 'No sabía la respuesta.', english: "I didn't know the answer." },
    ],
    contrast: {
      title: 'Imperfect vs Preterite',
      preterite: ['Finished: Ayer comí.', 'One-time: De repente cayó.'],
      imperfect: ['Background: Comía cuando…', 'Habit: Siempre comía tarde.'],
    },
  },
  'Preterite vs Imperfect': {
    whenToUse: [
      'Preterite: the main event — what happened.',
      'Imperfect: the scene — what was going on around it.',
      'Often both appear in one sentence: Llovía cuando salí.',
      'Questions about habits vs one-time events need the right tense.',
    ],
    howToForm: [
      'Review both formation patterns side by side.',
      'Preterite = snapshot; imperfect = background video.',
      'Time markers help: ayer (often preterite), siempre (often imperfect).',
      'Practice with story pairs: estaba… cuando… pasó…',
    ],
    irregularVerbs: ['ser/ir', 'tener', 'hacer', 'ver', 'estar'],
    memoryTips: ['Ask: “Is this the headline or the scenery?”'],
    commonMistakesGeneral: [
      'Using only preterite in narratives.',
      'Using imperfect for sudden completed actions.',
      'Mixing tenses without a clear main vs background clause.',
    ],
    examples: [
      { spanish: 'Llovía cuando llegué a casa.', english: 'It was raining when I got home.' },
      { spanish: 'Mientras estudiaba, sonó el teléfono.', english: 'While I was studying, the phone rang.' },
      { spanish: 'Siempre caminaba al trabajo, pero ayer tomé el bus.', english: 'I always walked to work, but yesterday I took the bus.' },
      { spanish: 'Eran las diez y ya dormía.', english: 'It was ten o’clock and he was already sleeping.' },
      { spanish: 'De repente escuché un ruido.', english: 'Suddenly I heard a noise.' },
    ],
    contrast: {
      title: 'Side by side',
      preterite: ['Comí (I ate — done)', 'Fui (I went — once)', 'Ella cantó (she sang — event)'],
      imperfect: ['Comía (I was eating)', 'Iba (I used to go / was going)', 'Ella cantaba (she used to sing)'],
    },
  },
  'Future tense': {
    whenToUse: [
      'Predictions: Lloverá mañana.',
      'Promises and decisions: Te llamaré.',
      'Probability in the present: ¿Qué hora será?',
      'Plans further ahead: El año que viene viajaremos.',
    ],
    howToForm: [
      'Add endings to the full infinitive: -é, -ás, -á, -emos, -éis, -án',
      'All -ar, -er, -ir verbs share the same endings.',
      'Irregular stems: tendr-, podr-, har-, dir-, saldr-, pondr-, valdr-, vendr-',
      'Alternative: ir + a + infinitive for near future (voy a salir).',
    ],
    irregularVerbs: ['tener', 'poder', 'hacer', 'decir', 'salir', 'venir', 'poner', 'valer', 'saber', 'querer'],
    memoryTips: ['Future endings rhyme with present -ar endings shifted: hablaré like hablo pattern.'],
    commonMistakesGeneral: [
      'Dropping the accent on tú/él forms: *hablaras vs hablarás.',
      'Using future for immediate plans (ir + a is more natural).',
      'Wrong irregular stem: *haceré instead of haré.',
    ],
    examples: [
      { spanish: 'Mañana trabajaré desde casa.', english: 'Tomorrow I will work from home.' },
      { spanish: '¿Podrás venir a la fiesta?', english: 'Will you be able to come to the party?' },
      { spanish: 'Haré la cena esta noche.', english: 'I will make dinner tonight.' },
      { spanish: 'Diremos la verdad.', english: 'We will tell the truth.' },
      { spanish: 'Saldrán pronto.', english: 'They will leave soon.' },
    ],
  },
  Conditional: {
    whenToUse: [
      'Hypotheticals: Compraría una casa si tuviera dinero.',
      'Polite requests: ¿Podrías ayudarme?',
      'Advice: Yo en tu lugar hablaría con él.',
      'Reported past future: Dijo que vendría.',
    ],
    howToForm: [
      'Add to the infinitive: -ía, -ías, -ía, -íamos, -íais, -ían',
      'Same irregular stems as the future tense.',
      'Often paired with si + imperfect subjunctive in hypotheticals.',
      'Regular verbs are completely predictable once you know the pattern.',
    ],
    irregularVerbs: ['tener', 'poder', 'hacer', 'decir', 'salir', 'venir', 'poner', 'valer', 'saber', 'querer'],
    memoryTips: ['Conditional = future stem + imperfect endings (-ía).'],
    commonMistakesGeneral: [
      'Using conditional for simple past in Spanish (unlike English “would” habits).',
      'Wrong stem: *hacería instead of haría.',
      'Forgetting accents on all forms.',
    ],
    examples: [
      { spanish: 'Me gustaría un café, por favor.', english: 'I would like a coffee, please.' },
      { spanish: '¿Podrías repetir eso?', english: 'Could you repeat that?' },
      { spanish: 'Viajaríamos más si tuviéramos tiempo.', english: 'We would travel more if we had time.' },
      { spanish: 'Dijo que llegaría tarde.', english: 'He said he would arrive late.' },
      { spanish: 'Sería mejor llamar primero.', english: 'It would be better to call first.' },
    ],
  },
  'Present subjunctive': {
    whenToUse: [
      'Wishes and hopes: Espero que vengas.',
      'Doubts and denials: No creo que sea verdad.',
      'Emotions: Me alegra que estés aquí.',
      'Impersonal expressions: Es importante que estudies.',
    ],
    howToForm: [
      'Start from the yo form of present indicative.',
      '-ar verbs: swap -o for -e endings: -e, -es, -e, -emos, -éis, -en',
      '-er/-ir verbs: swap -o for -a endings: -a, -as, -a, -amos, -áis, -an',
      'Stem-changing rules mostly carry over; spelling changes apply.',
    ],
    irregularVerbs: ['ser (sea)', 'estar (esté)', 'ir (vaya)', 'tener (tenga)', 'hacer (haga)', 'poder (pueda)', 'dar (dé)', 'saber (sepa)', 'venir (venga)'],
    memoryTips: ['WEIRDO: Wishes, Emotions, Impersonal, Requests, Doubt, Ojalá.'],
    commonMistakesGeneral: [
      'Using indicative after que when subjunctive is required.',
      'Wrong vowel pattern (-ar vs -er/-ir).',
      'Forgetting that the trigger clause must signal subjectivity.',
    ],
    examples: [
      { spanish: 'Espero que tengas un buen día.', english: 'I hope you have a good day.' },
      { spanish: 'Quiero que vengas conmigo.', english: 'I want you to come with me.' },
      { spanish: 'No creo que llueva.', english: "I don't think it will rain." },
      { spanish: 'Ojalá pueda ir.', english: 'I hope I can go.' },
      { spanish: 'Es posible que llegue tarde.', english: 'It is possible that he arrives late.' },
    ],
  },
  'Ser vs Estar': {
    whenToUse: [
      'Ser: identity, profession, origin, time, permanent traits.',
      'Estar: location, mood, health, temporary states.',
      'Ser for what something is; estar for how/where something is.',
      'Some adjectives change meaning: ser listo (clever) vs estar listo (ready).',
    ],
    howToForm: [
      'Memorise present forms of ser and estar separately.',
      'Ser is highly irregular across tenses; estar is more regular.',
      'Location almost always uses estar: Madrid está en España.',
      'Events use ser for time/date: La fiesta es el sábado.',
    ],
    irregularVerbs: ['ser', 'estar'],
    memoryTips: ['DOCTOR for ser (Description, Occupation, Characteristic, Time, Origin, Relationship). PLACE for estar (Position, Location, Action, Condition, Emotion).'],
    commonMistakesGeneral: [
      'Using ser for location (*Madrid es en España).',
      'Using estar for profession (*Estoy profesor).',
      'Mixing up ser aburrido vs estar aburrido.',
    ],
    examples: [
      { spanish: 'Soy de Argentina pero estoy en España.', english: 'I am from Argentina but I am in Spain.' },
      { spanish: 'Mi hermana es médica.', english: 'My sister is a doctor.' },
      { spanish: 'Estamos cansados hoy.', english: 'We are tired today.' },
      { spanish: 'La comida está muy buena.', english: 'The food is very good (right now).' },
      { spanish: 'Es la una de la tarde.', english: 'It is one in the afternoon.' },
    ],
  },
  'Por vs Para': {
    whenToUse: [
      'Por: cause/reason, exchange, duration, through, on behalf of.',
      'Para: destination, purpose, deadline, recipient, opinion.',
      'Por + time = for how long; para + time = by when.',
      'Gracias por… / Esto es para ti.',
    ],
    howToForm: [
      'Por and para are prepositions — they do not conjugate.',
      'Learn high-frequency collocations: por favor, por ejemplo, para siempre.',
      'Purpose: para + infinitive (Estudio para aprender).',
      'Motion toward: voy para el centro (destination).',
    ],
    irregularVerbs: ['ir', 'pasar', 'trabajar', 'dar', 'venir'],
    memoryTips: ['PARA = Purpose, Arrival, Recipient, Aim. POR = Passage, Origin, Reason.'],
    commonMistakesGeneral: [
      'Swapping por and para with time expressions.',
      'Using por for recipient (*El regalo es por ti).',
      'Using para for gratitude (*Gracias para tu ayuda).',
    ],
    examples: [
      { spanish: 'Gracias por tu ayuda.', english: 'Thanks for your help.' },
      { spanish: 'Este regalo es para ti.', english: 'This gift is for you.' },
      { spanish: 'Trabajo para una empresa grande.', english: 'I work for a big company.' },
      { spanish: 'Camino por el parque cada día.', english: 'I walk through the park every day.' },
      { spanish: 'Necesito el informe para el lunes.', english: 'I need the report by Monday.' },
    ],
  },
  'Reflexive verbs': {
    whenToUse: [
      'Actions done to oneself: Me lavo las manos.',
      'Daily routines: Me levanto a las siete.',
      'Emotional states: Me siento bien.',
      'Reciprocal actions with plural: Se escriben cada semana.',
    ],
    howToForm: [
      'Conjugate the verb + reflexive pronoun (me, te, se, nos, os, se).',
      'Pronoun goes before conjugated verbs: Me ducho.',
      'Infinitive: ducharse — pronoun attaches at the end.',
      'Some verbs are always reflexive; others change meaning (ir vs irse).',
    ],
    irregularVerbs: ['levantarse', 'vestirse', 'acostarse', 'despertarse', 'sentirse'],
    memoryTips: ['The subject and object are the same person — “I wash myself”.'],
    commonMistakesGeneral: [
      'Forgetting the reflexive pronoun (*Lavo vs me lavo).',
      'Wrong pronoun with gustar-type verbs.',
      'Misplacing pronouns with infinitives or gerunds.',
    ],
    examples: [
      { spanish: 'Me levanto temprano los días de trabajo.', english: 'I get up early on work days.' },
      { spanish: '¿Cómo te llamas?', english: 'What is your name? (literally: how do you call yourself?)' },
      { spanish: 'Nos quedamos en casa.', english: 'We are staying at home.' },
      { spanish: 'Se ducha antes del desayuno.', english: 'He showers before breakfast.' },
      { spanish: 'Me siento un poco cansado.', english: 'I feel a little tired.' },
    ],
  },
  'Present participle (gerund)': {
    whenToUse: [
      'Progressive tenses with estar: Estoy hablando — I am speaking.',
      'With seguir and continuar: Sigo aprendiendo — I keep learning.',
      'With llevar: Llevo tres horas estudiando — I have been studying for three hours.',
      'As an adverb of manner: Salió corriendo — He left running.',
    ],
    howToForm: [
      '-ar verbs → -ando: hablar → hablando.',
      '-er and -ir verbs → -iendo: comer → comiendo, vivir → viviendo.',
      'Some stem changes drop the vowel: decir → diciendo, pedir → pidiendo.',
      'Key irregulars: ir → yendo, leer → leyendo, poder → pudiendo, venir → viniendo.',
    ],
    irregularVerbs: ['ir (yendo)', 'leer (leyendo)', 'poder (pudiendo)', 'venir (viniendo)', 'decir (diciendo)'],
    memoryTips: [
      '-ando sounds like “and-oh!” — present action happening.',
      '-iendo sounds like “ee-end-oh” — action in progress.',
      'Kitchen palace: kettle hirviendo, fridge enfriando, cooker cocinando, table esperando, window lloviendo, door saliendo.',
    ],
    commonMistakesGeneral: [
      'Using the infinitive after estar (*Estoy hablar).',
      'Wrong irregular gerund (*iendo for ir — use yendo).',
      'Forgetting vowel shifts with stem-changing -ir verbs.',
    ],
    examples: [
      { spanish: 'Estoy hablando con María.', english: 'I am speaking with María.' },
      { spanish: 'Estaba comiendo cuando llamaste.', english: 'I was eating when you called.' },
      { spanish: 'Sigo aprendiendo español.', english: 'I keep learning Spanish.' },
      { spanish: 'Continúa lloviendo.', english: 'It keeps raining.' },
      { spanish: 'Llevo tres horas estudiando.', english: "I've been studying for three hours." },
      { spanish: 'Salió corriendo.', english: 'He left running.' },
    ],
  },
  'Past participle': {
    whenToUse: [
      'Perfect tenses with haber: He hablado — I have spoken.',
      'As an adjective — must agree with the noun: La puerta está abierta.',
      'Passive voice with ser: El libro fue escrito por Cervantes.',
    ],
    howToForm: [
      '-ar verbs → -ado: hablar → hablado.',
      '-er and -ir verbs → -ido: comer → comido, vivir → vivido.',
      'Irregulars must be memorised: hacer → hecho, ver → visto, escribir → escrito.',
      'As adjective or with ser/estar, the participle agrees in gender and number.',
    ],
    irregularVerbs: [
      'hacer (hecho)',
      'ver (visto)',
      'escribir (escrito)',
      'abrir (abierto)',
      'decir (dicho)',
      'poner (puesto)',
      'volver (vuelto)',
      'romper (roto)',
      'morir (muerto)',
      'ir (ido)',
    ],
    memoryTips: [
      'hecho — “echo” — what’s done echoes.',
      'visto — “feast-o” — I’ve seen the feast.',
      'escrito — “es-creeto” — written in secret.',
      'abierto — “a bear-to” — opened by a bear.',
      'Kitchen palace: kettle hecho, fridge abierto, cooker hecho, table escrito, window visto, door abierto.',
    ],
    commonMistakesGeneral: [
      'Forgetting agreement when used as an adjective (*La puerta está abierto).',
      'Inventing regular forms for irregulars (*hacido instead of hecho).',
      'Making the participle agree after haber (it stays invariable: He escrito, not *He escritas).',
    ],
    examples: [
      { spanish: 'He hablado con ella.', english: 'I have spoken with her.' },
      { spanish: 'Ha comido ya.', english: 'He has already eaten.' },
      { spanish: 'Hemos visto esa película.', english: 'We have seen that film.' },
      { spanish: 'La puerta está abierta.', english: 'The door is open.' },
      { spanish: 'El libro fue escrito por Cervantes.', english: 'The book was written by Cervantes.' },
    ],
  },
  'Perfect tenses': {
    whenToUse: [
      'Present perfect (pretérito perfecto): recent past linked to now — He comido.',
      'Past perfect (pluscuamperfecto): earlier of two past actions — Había comido cuando llegó.',
      'Future perfect: completed by a future point — Para mañana habré terminado.',
      'Spain often uses present perfect for today’s events; Argentina prefers the preterite for the same idea.',
    ],
    howToForm: [
      'haber conjugated + past participle (invariable after haber).',
      'Present perfect: he, has, ha, hemos, habéis, han + participle.',
      'Past perfect: había, habías, había, habíamos, habíais, habían + participle.',
      'Future perfect: habré, habrás, habrá, habremos, habréis, habrán + participle.',
    ],
    irregularVerbs: ['hecho', 'visto', 'escrito', 'dicho', 'puesto', 'abierto', 'vuelto', 'roto'],
    memoryTips: [
      'Haber is the helper — the participle carries the meaning.',
      'Spain: ¿Has comido?  Argentina: ¿Comiste? — same idea, different tense.',
      'Javi flags the Spain vs Argentina difference every time it comes up.',
    ],
    commonMistakesGeneral: [
      'Making the participle agree after haber.',
      'Using present perfect where Argentina speakers expect the preterite.',
      'Wrong haber form (*Hemos has visto).',
    ],
    examples: [
      { spanish: 'He comido.', english: 'I have eaten.' },
      { spanish: '¿Has visto esa película?', english: 'Have you seen that film?' },
      { spanish: 'Había comido cuando llegó.', english: 'I had eaten when he arrived.' },
      { spanish: 'Ya habían salido.', english: 'They had already left.' },
      { spanish: 'Para mañana habré terminado.', english: 'By tomorrow I will have finished.' },
    ],
  },
  'Core prepositions': {
    whenToUse: [
      'A — movement and personal object marker: Voy a Madrid / Llamo a María.',
      'En — location and time: Estoy en casa / En verano.',
      'De — possession, origin, material: El libro de Ana / Soy de Londres.',
      'Con / sin / sobre / entre / hasta / desde — with, without, on/about, between, until, from/since.',
    ],
    howToForm: [
      'Prepositions do not conjugate — learn fixed patterns and collocations.',
      'Personal a is required before a specific person as direct object: Veo a Juan.',
      'Empezar a + infinitive: Empiezo a trabajar.',
      'Desde hace + time = for (duration from a point in the past).',
    ],
    irregularVerbs: ['ir a', 'estar en', 'ser de', 'llamar a', 'empezar a'],
    memoryTips: [
      'English and Spanish prepositions diverge — do not translate word for word.',
      'A = to / personal a; en = in/at/on (location); de = of/from/’s.',
    ],
    commonMistakesGeneral: [
      'Dropping the personal a (*Llamo María).',
      'Using en where English uses “at” inconsistently — Estoy en casa = at home.',
      'Confusing desde and desde hace.',
    ],
    examples: [
      { spanish: 'Voy a Madrid.', english: 'I am going to Madrid.' },
      { spanish: 'Estoy en casa.', english: 'I am at home.' },
      { spanish: 'Soy de Londres.', english: 'I am from London.' },
      { spanish: 'Escribo con bolígrafo.', english: 'I write with a pen.' },
      { spanish: 'Desde hace tres años vivo aquí.', english: 'I have lived here for three years.' },
    ],
  },
  'Compound prepositions': {
    whenToUse: [
      'Spatial relations: encima de, debajo de, delante de, detrás de, cerca de, lejos de.',
      'Time order: antes de, después de.',
      'Stance and cause: a pesar de, a causa de, gracias a, debido a, en vez de.',
      'Position and company: frente a, junto a, además de.',
    ],
    howToForm: [
      'Most follow the pattern [word] + de: delante de la casa.',
      'Algunas usan a: frente a, junto a, gracias a, debido a.',
      'Avoid English calques: “in front of” → delante de (not *en frente de as a fixed habit).',
    ],
    irregularVerbs: ['antes de', 'después de', 'delante de', 'en vez de', 'a pesar de'],
    memoryTips: [
      '“In front of the house” → delante de la casa — NOT “en frente de” (common error).',
      'Learn them as chunks with de (or a) baked in.',
    ],
    commonMistakesGeneral: [
      'Saying *en frente de instead of delante de.',
      'Dropping de after encima/debajo/cerca.',
      'Mixing frente a (facing) with delante de (in front of).',
    ],
    examples: [
      { spanish: 'El coche está delante de la casa.', english: 'The car is in front of the house.' },
      { spanish: 'Después de comer, salimos.', english: 'After eating, we left.' },
      { spanish: 'En vez de café, pedí té.', english: 'Instead of coffee, I ordered tea.' },
      { spanish: 'A pesar de la lluvia, fuimos.', english: 'Despite the rain, we went.' },
      { spanish: 'Vivo cerca de la estación.', english: 'I live near the station.' },
    ],
  },
  'Verbs with prepositions': {
    whenToUse: [
      'English speakers often pick the wrong Spanish preposition by translating directly.',
      'soñar con — dream ABOUT; pensar en — think ABOUT; pensar de — opinion OF.',
      'casarse con, depender de, enamorarse de, olvidarse de, acordarse de.',
      'quedar con (meet up), quedar en (agree to), tardar en, consistir en.',
    ],
    howToForm: [
      'Learn verb + fixed preposition as a single unit.',
      'Reflexive verbs keep the pronoun + preposition: Me enamoré de España.',
      'When an infinitive follows, keep the preposition: Me olvidé de llamar.',
    ],
    irregularVerbs: [
      'soñar con',
      'pensar en',
      'casarse con',
      'depender de',
      'enamorarse de',
      'acordarse de',
      'olvidarse de',
    ],
    memoryTips: [
      'Do not trust English “about / on / with” — check the Spanish chunk.',
      'soñar CON, pensar EN, casarse CON, enamorarse DE.',
    ],
    commonMistakesGeneral: [
      '*soñar sobre instead of soñar con.',
      '*pensar sobre instead of pensar en.',
      '*casarse a instead of casarse con.',
    ],
    examples: [
      { spanish: 'Sueño con viajar.', english: 'I dream about travelling.' },
      { spanish: 'Pienso en ti.', english: 'I think about you.' },
      { spanish: 'Se casó con María.', english: 'He married María.' },
      { spanish: 'Me enamoré de España.', english: 'I fell in love with Spain.' },
      { spanish: 'Depende de ti.', english: 'It depends on you.' },
    ],
  },
  'Imperative mood': {
    whenToUse: [
      'Positive commands and instructions: Habla más despacio.',
      'Negative commands use the present subjunctive: No hables.',
      'Formal usted/ustedes commands use the present subjunctive.',
      'Object pronouns attach to positive commands and go before negatives.',
    ],
    howToForm: [
      'Tú positive: use the present él/ella form — habla, come, escribe.',
      'Irregular tú positives: di, haz, ve, pon, sal, sé, ten, ven.',
      'Vosotros positive: replace -r with -d — hablad, comed, escribid.',
      'Negative (tú/usted/vosotros/ustedes): present subjunctive — no hables, no vayas.',
    ],
    irregularVerbs: ['di', 'haz', 've', 'pon', 'sal', 'sé', 'ten', 'ven'],
    memoryTips: [
      'Chant the irregulars: Di Haz Ve Pon Sal Sé Ten Ven.',
      'Positive — attach pronouns: ¡Dímelo! Negative — before verb: ¡No me lo digas!',
    ],
    commonMistakesGeneral: [
      'Using infinitive as a casual command (*Hablar! instead of ¡Habla!).',
      'Wrong negative form (*No habla instead of No hables).',
      'Pronoun placement on negatives (*No dígaslo instead of No lo digas).',
    ],
    examples: [
      { spanish: '¡Habla más alto!', english: 'Speak louder!' },
      { spanish: '¡Haz la tarea!', english: 'Do the homework!' },
      { spanish: '¡Ve a casa!', english: 'Go home!' },
      { spanish: 'No vayas allí.', english: "Don't go there." },
      { spanish: '¡Dímelo!', english: 'Tell it to me!' },
      { spanish: '¡No me lo digas!', english: "Don't tell me that!" },
    ],
  },
};

export function getTenseGuide(topic: GrammarTopic): TenseGuideContent {
  return TENSE_GUIDE_CONTENT[topic];
}
