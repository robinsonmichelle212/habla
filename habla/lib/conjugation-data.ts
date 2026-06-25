import type { GrammarTopic } from '@/lib/grammar-curriculum';
import {
  ESSENTIAL_TENSE_KEYS,
  ESSENTIAL_VERB_INFINITIVES,
  PERSON_LABELS,
  TENSE_LABELS,
  parseFocusVerb,
  tensesForTopic,
  type PersonLabel,
  type TenseKey,
} from '@/lib/grammar-tenses';

export type ConjugationFormRow = {
  person: PersonLabel;
  form: string;
  argentinaNote?: string;
  irregular?: boolean;
};

export type ConjugationTenseTable = {
  tenseKey: TenseKey;
  tenseLabel: string;
  forms: ConjugationFormRow[];
};

export type VerbConjugationEntry = {
  infinitive: string;
  english: string;
  regular: boolean;
  regionNote?: string;
  tenses: ConjugationTenseTable[];
};

type RowInput = {
  spain: string[];
  argentina?: (string | undefined)[];
  irregular?: number[];
};

function buildForms(input: RowInput): ConjugationFormRow[] {
  return PERSON_LABELS.map((person, i) => ({
    person,
    form: input.spain[i] ?? '',
    argentinaNote: input.argentina?.[i] ? `(${input.argentina[i]})` : undefined,
    irregular: input.irregular?.includes(i) ?? false,
  }));
}

function tenseTable(tenseKey: TenseKey, input: RowInput): ConjugationTenseTable {
  return {
    tenseKey,
    tenseLabel: TENSE_LABELS[tenseKey],
    forms: buildForms(input),
  };
}

function entry(
  infinitive: string,
  english: string,
  regular: boolean,
  tables: ConjugationTenseTable[],
  regionNote?: string,
): VerbConjugationEntry {
  return { infinitive, english, regular, regionNote, tenses: tables };
}

const VERB_DICTIONARY: Record<string, VerbConjugationEntry> = {
  ser: entry('ser', 'to be (permanent)', false, [
    tenseTable('present', {
      spain: ['soy', 'eres', 'es', 'somos', 'sois', 'son'],
      argentina: [undefined, 'sos', undefined, undefined, undefined, undefined],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
    tenseTable('preterite', {
      spain: ['fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
    tenseTable('imperfect', {
      spain: ['era', 'eras', 'era', 'éramos', 'erais', 'eran'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
    tenseTable('future', {
      spain: ['seré', 'serás', 'será', 'seremos', 'seréis', 'serán'],
    }),
    tenseTable('conditional', {
      spain: ['sería', 'serías', 'sería', 'seríamos', 'seríais', 'serían'],
    }),
    tenseTable('presentSubjunctive', {
      spain: ['sea', 'seas', 'sea', 'seamos', 'seáis', 'sean'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
  ]),
  estar: entry('estar', 'to be (temporary)', false, [
    tenseTable('present', {
      spain: ['estoy', 'estás', 'está', 'estamos', 'estáis', 'están'],
      argentina: [undefined, 'estás', undefined, undefined, undefined, undefined],
    }),
    tenseTable('preterite', {
      spain: ['estuve', 'estuviste', 'estuvo', 'estuvimos', 'estuvisteis', 'estuvieron'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
    tenseTable('imperfect', {
      spain: ['estaba', 'estabas', 'estaba', 'estábamos', 'estabais', 'estaban'],
    }),
    tenseTable('future', {
      spain: ['estaré', 'estarás', 'estará', 'estaremos', 'estaréis', 'estarán'],
    }),
    tenseTable('conditional', {
      spain: ['estaría', 'estarías', 'estaría', 'estaríamos', 'estaríais', 'estarían'],
    }),
    tenseTable('presentSubjunctive', {
      spain: ['esté', 'estés', 'esté', 'estemos', 'estéis', 'estén'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
  ]),
  tener: entry('tener', 'to have', false, [
    tenseTable('present', {
      spain: ['tengo', 'tienes', 'tiene', 'tenemos', 'tenéis', 'tienen'],
      argentina: [undefined, 'tenés', undefined, undefined, undefined, undefined],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
    tenseTable('preterite', {
      spain: ['tuve', 'tuviste', 'tuvo', 'tuvimos', 'tuvisteis', 'tuvieron'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
    tenseTable('imperfect', {
      spain: ['tenía', 'tenías', 'tenía', 'teníamos', 'teníais', 'tenían'],
    }),
    tenseTable('future', {
      spain: ['tendré', 'tendrás', 'tendrá', 'tendremos', 'tendréis', 'tendrán'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
    tenseTable('conditional', {
      spain: ['tendría', 'tendrías', 'tendría', 'tendríamos', 'tendríais', 'tendrían'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
    tenseTable('presentSubjunctive', {
      spain: ['tenga', 'tengas', 'tenga', 'tengamos', 'tengáis', 'tengan'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
  ]),
  ir: entry('ir', 'to go', false, [
    tenseTable('present', {
      spain: ['voy', 'vas', 'va', 'vamos', 'vais', 'van'],
      argentina: [undefined, 'vas', undefined, undefined, undefined, undefined],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
    tenseTable('preterite', {
      spain: ['fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
    tenseTable('imperfect', {
      spain: ['iba', 'ibas', 'iba', 'íbamos', 'ibais', 'iban'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
    tenseTable('future', {
      spain: ['iré', 'irás', 'irá', 'iremos', 'iréis', 'irán'],
    }),
    tenseTable('conditional', {
      spain: ['iría', 'irías', 'iría', 'iríamos', 'iríais', 'irían'],
    }),
    tenseTable('presentSubjunctive', {
      spain: ['vaya', 'vayas', 'vaya', 'vayamos', 'vayáis', 'vayan'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
  ], 'Preterite forms are identical to ser'),
  hacer: entry('hacer', 'to do / make', false, [
    tenseTable('present', {
      spain: ['hago', 'haces', 'hace', 'hacemos', 'hacéis', 'hacen'],
      argentina: [undefined, 'hacés', undefined, undefined, undefined, undefined],
      irregular: [0],
    }),
    tenseTable('preterite', {
      spain: ['hice', 'hiciste', 'hizo', 'hicimos', 'hicisteis', 'hicieron'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
    tenseTable('imperfect', {
      spain: ['hacía', 'hacías', 'hacía', 'hacíamos', 'hacíais', 'hacían'],
    }),
    tenseTable('future', {
      spain: ['haré', 'harás', 'hará', 'haremos', 'haréis', 'harán'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
    tenseTable('conditional', {
      spain: ['haría', 'harías', 'haría', 'haríamos', 'haríais', 'harían'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
    tenseTable('presentSubjunctive', {
      spain: ['haga', 'hagas', 'haga', 'hagamos', 'hagáis', 'hagan'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
  ]),
  poder: entry('poder', 'to be able to', false, [
    tenseTable('present', {
      spain: ['puedo', 'puedes', 'puede', 'podemos', 'podéis', 'pueden'],
      argentina: [undefined, 'podés', undefined, undefined, undefined, undefined],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
    tenseTable('preterite', {
      spain: ['pude', 'pudiste', 'pudo', 'pudimos', 'pudisteis', 'pudieron'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
    tenseTable('imperfect', {
      spain: ['podía', 'podías', 'podía', 'podíamos', 'podíais', 'podían'],
    }),
    tenseTable('future', {
      spain: ['podré', 'podrás', 'podrá', 'podremos', 'podréis', 'podrán'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
    tenseTable('conditional', {
      spain: ['podría', 'podrías', 'podría', 'podríamos', 'podríais', 'podrían'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
    tenseTable('presentSubjunctive', {
      spain: ['pueda', 'puedas', 'pueda', 'podamos', 'podáis', 'puedan'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
  ]),
  querer: entry('querer', 'to want', false, [
    tenseTable('present', {
      spain: ['quiero', 'quieres', 'quiere', 'queremos', 'queréis', 'quieren'],
      argentina: [undefined, 'querés', undefined, undefined, undefined, undefined],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
    tenseTable('preterite', {
      spain: ['quise', 'quisiste', 'quiso', 'quisimos', 'quisisteis', 'quisieron'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
    tenseTable('imperfect', {
      spain: ['quería', 'querías', 'quería', 'queríamos', 'queríais', 'querían'],
    }),
    tenseTable('future', {
      spain: ['querré', 'querrás', 'querrá', 'querremos', 'querréis', 'querrán'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
    tenseTable('conditional', {
      spain: ['querría', 'querrías', 'querría', 'querríamos', 'querríais', 'querrían'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
    tenseTable('presentSubjunctive', {
      spain: ['quiera', 'quieras', 'quiera', 'queramos', 'queráis', 'quieran'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
  ]),
  saber: entry('saber', 'to know', false, [
    tenseTable('present', {
      spain: ['sé', 'sabes', 'sabe', 'sabemos', 'sabéis', 'saben'],
      argentina: [undefined, 'sabés', undefined, undefined, undefined, undefined],
      irregular: [0],
    }),
    tenseTable('preterite', {
      spain: ['supe', 'supiste', 'supo', 'supimos', 'supisteis', 'supieron'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
    tenseTable('imperfect', {
      spain: ['sabía', 'sabías', 'sabía', 'sabíamos', 'sabíais', 'sabían'],
    }),
    tenseTable('future', {
      spain: ['sabré', 'sabrás', 'sabrá', 'sabremos', 'sabréis', 'sabrán'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
    tenseTable('conditional', {
      spain: ['sabría', 'sabrías', 'sabría', 'sabríamos', 'sabríais', 'sabrían'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
    tenseTable('presentSubjunctive', {
      spain: ['sepa', 'sepas', 'sepa', 'sepamos', 'sepáis', 'sepan'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
  ]),
  dar: entry('dar', 'to give', false, [
    tenseTable('present', {
      spain: ['doy', 'das', 'da', 'damos', 'dais', 'dan'],
      argentina: [undefined, 'das', undefined, undefined, undefined, undefined],
      irregular: [0],
    }),
    tenseTable('preterite', {
      spain: ['di', 'diste', 'dio', 'dimos', 'disteis', 'dieron'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
    tenseTable('imperfect', {
      spain: ['daba', 'dabas', 'daba', 'dábamos', 'dabais', 'daban'],
    }),
    tenseTable('future', {
      spain: ['daré', 'darás', 'dará', 'daremos', 'daréis', 'darán'],
    }),
    tenseTable('conditional', {
      spain: ['daría', 'darías', 'daría', 'daríamos', 'daríais', 'darían'],
    }),
    tenseTable('presentSubjunctive', {
      spain: ['dé', 'des', 'dé', 'demos', 'deis', 'den'],
      irregular: [0, 2],
    }),
  ]),
  venir: entry('venir', 'to come', false, [
    tenseTable('present', {
      spain: ['vengo', 'vienes', 'viene', 'venimos', 'venís', 'vienen'],
      argentina: [undefined, 'venís', undefined, undefined, undefined, undefined],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
    tenseTable('preterite', {
      spain: ['vine', 'viniste', 'vino', 'vinimos', 'vinisteis', 'vinieron'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
    tenseTable('imperfect', {
      spain: ['venía', 'venías', 'venía', 'veníamos', 'veníais', 'venían'],
    }),
    tenseTable('future', {
      spain: ['vendré', 'vendrás', 'vendrá', 'vendremos', 'vendréis', 'vendrán'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
    tenseTable('conditional', {
      spain: ['vendría', 'vendrías', 'vendría', 'vendríamos', 'vendríais', 'vendrían'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
    tenseTable('presentSubjunctive', {
      spain: ['venga', 'vengas', 'venga', 'vengamos', 'vengáis', 'vengan'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
  ]),
  ver: entry('ver', 'to see', false, [
    tenseTable('present', {
      spain: ['veo', 'ves', 've', 'vemos', 'veis', 'ven'],
      argentina: [undefined, 'ves', undefined, undefined, undefined, undefined],
      irregular: [0, 5],
    }),
    tenseTable('preterite', {
      spain: ['vi', 'viste', 'vio', 'vimos', 'visteis', 'vieron'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
    tenseTable('imperfect', {
      spain: ['veía', 'veías', 'veía', 'veíamos', 'veíais', 'veían'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
    tenseTable('future', {
      spain: ['veré', 'verás', 'verá', 'veremos', 'veréis', 'verán'],
    }),
    tenseTable('conditional', {
      spain: ['vería', 'verías', 'vería', 'veríamos', 'veríais', 'verían'],
    }),
    tenseTable('presentSubjunctive', {
      spain: ['vea', 'veas', 'vea', 'veamos', 'veáis', 'vean'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
  ]),
  decir: entry('decir', 'to say / tell', false, [
    tenseTable('present', {
      spain: ['digo', 'dices', 'dice', 'decimos', 'decís', 'dicen'],
      argentina: [undefined, 'decís', undefined, undefined, undefined, undefined],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
    tenseTable('preterite', {
      spain: ['dije', 'dijiste', 'dijo', 'dijimos', 'dijisteis', 'dijeron'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
    tenseTable('future', {
      spain: ['diré', 'dirás', 'dirá', 'diremos', 'diréis', 'dirán'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
    tenseTable('conditional', {
      spain: ['diría', 'dirías', 'diría', 'diríamos', 'diríais', 'dirían'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
    tenseTable('presentSubjunctive', {
      spain: ['diga', 'digas', 'diga', 'digamos', 'digáis', 'digan'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
  ]),
  salir: entry('salir', 'to leave / go out', false, [
    tenseTable('present', {
      spain: ['salgo', 'sales', 'sale', 'salimos', 'salís', 'salen'],
      argentina: [undefined, 'salís', undefined, undefined, undefined, undefined],
      irregular: [0],
    }),
    tenseTable('preterite', {
      spain: ['salí', 'saliste', 'salió', 'salimos', 'salisteis', 'salieron'],
    }),
    tenseTable('future', {
      spain: ['saldré', 'saldrás', 'saldrá', 'saldremos', 'saldréis', 'saldrán'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
    tenseTable('conditional', {
      spain: ['saldría', 'saldrías', 'saldría', 'saldríamos', 'saldríais', 'saldrían'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
    tenseTable('presentSubjunctive', {
      spain: ['salga', 'salgas', 'salga', 'salgamos', 'salgáis', 'salgan'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
  ]),
  poner: entry('poner', 'to put', false, [
    tenseTable('present', {
      spain: ['pongo', 'pones', 'pone', 'ponemos', 'ponéis', 'ponen'],
      argentina: [undefined, 'ponés', undefined, undefined, undefined, undefined],
      irregular: [0],
    }),
    tenseTable('preterite', {
      spain: ['puse', 'pusiste', 'puso', 'pusimos', 'pusisteis', 'pusieron'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
    tenseTable('future', {
      spain: ['pondré', 'pondrás', 'pondrá', 'pondremos', 'pondréis', 'pondrán'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
    tenseTable('conditional', {
      spain: ['pondría', 'pondrías', 'pondría', 'pondríamos', 'pondríais', 'pondrían'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
    tenseTable('presentSubjunctive', {
      spain: ['ponga', 'pongas', 'ponga', 'pongamos', 'pongáis', 'pongan'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
  ]),
  valer: entry('valer', 'to be worth', false, [
    tenseTable('present', {
      spain: ['valgo', 'vales', 'vale', 'valemos', 'valéis', 'valen'],
      argentina: [undefined, 'valés', undefined, undefined, undefined, undefined],
      irregular: [0],
    }),
    tenseTable('future', {
      spain: ['valdré', 'valdrás', 'valdrá', 'valdremos', 'valdréis', 'valdrán'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
    tenseTable('conditional', {
      spain: ['valdría', 'valdrías', 'valdría', 'valdríamos', 'valdríais', 'valdrían'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
    tenseTable('presentSubjunctive', {
      spain: ['valga', 'valgas', 'valga', 'valgamos', 'valgáis', 'valgan'],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
  ]),
  pasar: entry('pasar', 'to pass / spend time', true, [
    tenseTable('present', {
      spain: ['paso', 'pasas', 'pasa', 'pasamos', 'pasáis', 'pasan'],
      argentina: [undefined, 'pasás', undefined, undefined, undefined, undefined],
    }),
  ]),
  trabajar: entry('trabajar', 'to work', true, [
    tenseTable('present', {
      spain: ['trabajo', 'trabajas', 'trabaja', 'trabajamos', 'trabajáis', 'trabajan'],
      argentina: [undefined, 'trabajás', undefined, undefined, undefined, undefined],
    }),
  ]),
  levantarse: entry('levantarse', 'to get up', true, [
    tenseTable('present', {
      spain: ['me levanto', 'te levantas', 'se levanta', 'nos levantamos', 'os levantáis', 'se levantan'],
      argentina: [undefined, 'te levantás', undefined, undefined, undefined, undefined],
    }),
  ], 'Reflexive — pronoun + verb'),
  ducharse: entry('ducharse', 'to shower', true, [
    tenseTable('present', {
      spain: ['me ducho', 'te duchas', 'se ducha', 'nos duchamos', 'os ducháis', 'se duchan'],
      argentina: [undefined, 'te duchás', undefined, undefined, undefined, undefined],
    }),
  ], 'Reflexive — pronoun + verb'),
  vestirse: entry('vestirse', 'to get dressed', false, [
    tenseTable('present', {
      spain: ['me visto', 'te vistes', 'se viste', 'nos vestimos', 'os vestís', 'se visten'],
      argentina: [undefined, 'te vestís', undefined, undefined, undefined, undefined],
      irregular: [0, 1, 2, 3, 4, 5],
    }),
  ], 'Reflexive — stem-changing e→i'),
  acostarse: entry('acostarse', 'to go to bed', false, [
    tenseTable('present', {
      spain: ['me acuesto', 'te acuestas', 'se acuesta', 'nos acostamos', 'os acostáis', 'se acuestan'],
      argentina: [undefined, 'te acostás', undefined, undefined, undefined, undefined],
      irregular: [0, 1, 2, 5],
    }),
  ], 'Reflexive — stem-changing o→ue'),
  despertarse: entry('despertarse', 'to wake up', false, [
    tenseTable('present', {
      spain: ['me despierto', 'te despiertas', 'se despierta', 'nos despertamos', 'os despertáis', 'se despiertan'],
      argentina: [undefined, 'te despertás', undefined, undefined, undefined, undefined],
      irregular: [0, 1, 2, 5],
    }),
  ], 'Reflexive — stem-changing e→ie'),
  llamarse: entry('llamarse', 'to be called', true, [
    tenseTable('present', {
      spain: ['me llamo', 'te llamas', 'se llama', 'nos llamamos', 'os llamáis', 'se llaman'],
      argentina: [undefined, 'te llamás', undefined, undefined, undefined, undefined],
    }),
  ], 'Reflexive'),
  sentirse: entry('sentirse', 'to feel', false, [
    tenseTable('present', {
      spain: ['me siento', 'te sientes', 'se siente', 'nos sentimos', 'os sentís', 'se sienten'],
      argentina: [undefined, 'te sentís', undefined, undefined, undefined, undefined],
      irregular: [0, 1, 2, 5],
    }),
  ], 'Reflexive — stem-changing e→ie'),
  quedarse: entry('quedarse', 'to stay / remain', true, [
    tenseTable('present', {
      spain: ['me quedo', 'te quedas', 'se queda', 'nos quedamos', 'os quedáis', 'se quedan'],
      argentina: [undefined, 'te quedás', undefined, undefined, undefined, undefined],
    }),
  ], 'Reflexive'),
};

function filterTenses(verb: VerbConjugationEntry, tenseKeys: TenseKey[]): VerbConjugationEntry {
  return {
    ...verb,
    tenses: verb.tenses.filter((t) => tenseKeys.includes(t.tenseKey)),
  };
}

export function getVerbConjugation(infinitive: string): VerbConjugationEntry | null {
  const key = infinitive.trim().toLowerCase();
  return VERB_DICTIONARY[key] ?? null;
}

export function getVerbConjugationForTopic(
  infinitive: string,
  topic: GrammarTopic,
): VerbConjugationEntry | null {
  const verb = getVerbConjugation(infinitive);
  if (!verb) return null;
  return filterTenses(verb, tensesForTopic(topic));
}

export function getEssentialVerbsReference(): VerbConjugationEntry[] {
  return ESSENTIAL_VERB_INFINITIVES.map((v) => {
    const verb = VERB_DICTIONARY[v];
    if (!verb) return null;
    return filterTenses(verb, ESSENTIAL_TENSE_KEYS);
  }).filter((v): v is VerbConjugationEntry => v != null);
}

export function getFocusVerbsForTopic(
  focusVerbs: string[],
  topic: GrammarTopic,
): VerbConjugationEntry[] {
  const seen = new Set<string>();
  const results: VerbConjugationEntry[] = [];

  for (const focus of focusVerbs) {
    const base = parseFocusVerb(focus).toLowerCase();
    if (seen.has(base)) continue;
    seen.add(base);
    const verb = getVerbConjugationForTopic(base, topic);
    if (verb && verb.tenses.length > 0) {
      results.push(verb);
    }
  }

  return results;
}

export function normalizeSearchVerb(query: string): string {
  return query.trim().toLowerCase().replace(/^to\s+/, '');
}
