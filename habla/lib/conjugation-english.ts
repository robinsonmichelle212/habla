import type { PersonLabel, TenseKey } from '@/lib/grammar-tenses';
import { PERSON_LABELS } from '@/lib/grammar-tenses';

const SUBJECTS = ['I', 'you', 'he/she', 'we', 'you all (Spain)', 'they'] as const;

type EnglishTable = Partial<Record<TenseKey, string[]>>;

/** Explicit per-verb English conjugation rows (6 per tense). */
const ENGLISH_OVERRIDES: Record<string, EnglishTable> = {
  ser: {
    present: ['I am', 'you are', 'he/she is', 'we are', 'you all are', 'they are'],
    preterite: ['I was', 'you were', 'he/she was', 'we were', 'you all were', 'they were'],
    imperfect: ['I was', 'you were', 'he/she was', 'we were', 'you all were', 'they were'],
    future: ['I will be', 'you will be', 'he/she will be', 'we will be', 'you all will be', 'they will be'],
    conditional: ['I would be', 'you would be', 'he/she would be', 'we would be', 'you all would be', 'they would be'],
    presentSubjunctive: ['(that) I be', '(that) you be', '(that) he/she be', '(that) we be', '(that) you all be', '(that) they be'],
  },
  estar: {
    present: ['I am', 'you are', 'he/she is', 'we are', 'you all are', 'they are'],
    preterite: ['I was', 'you were', 'he/she was', 'we were', 'you all were', 'they were'],
    imperfect: ['I was', 'you were', 'he/she was', 'we were', 'you all were', 'they were'],
    future: ['I will be', 'you will be', 'he/she will be', 'we will be', 'you all will be', 'they will be'],
    conditional: ['I would be', 'you would be', 'he/she would be', 'we would be', 'you all would be', 'they would be'],
    presentSubjunctive: ['(that) I be', '(that) you be', '(that) he/she be', '(that) we be', '(that) you all be', '(that) they be'],
  },
  tener: {
    present: ['I have', 'you have', 'he/she has', 'we have', 'you all have', 'they have'],
    preterite: ['I had', 'you had', 'he/she had', 'we had', 'you all had', 'they had'],
    imperfect: ['I had', 'you had', 'he/she had', 'we had', 'you all had', 'they had'],
    future: ['I will have', 'you will have', 'he/she will have', 'we will have', 'you all will have', 'they will have'],
    conditional: ['I would have', 'you would have', 'he/she would have', 'we would have', 'you all would have', 'they would have'],
    presentSubjunctive: ['(that) I have', '(that) you have', '(that) he/she have', '(that) we have', '(that) you all have', '(that) they have'],
  },
  ir: {
    present: ['I go', 'you go', 'he/she goes', 'we go', 'you all go', 'they go'],
    preterite: ['I went', 'you went', 'he/she went', 'we went', 'you all went', 'they went'],
    imperfect: ['I used to go', 'you used to go', 'he/she used to go', 'we used to go', 'you all used to go', 'they used to go'],
    future: ['I will go', 'you will go', 'he/she will go', 'we will go', 'you all will go', 'they will go'],
    conditional: ['I would go', 'you would go', 'he/she would go', 'we would go', 'you all would go', 'they would go'],
    presentSubjunctive: ['(that) I go', '(that) you go', '(that) he/she go', '(that) we go', '(that) you all go', '(that) they go'],
  },
  hacer: {
    present: ['I do / make', 'you do / make', 'he/she does / makes', 'we do / make', 'you all do / make', 'they do / make'],
    preterite: ['I did / made', 'you did / made', 'he/she did / made', 'we did / made', 'you all did / made', 'they did / made'],
    imperfect: ['I was doing / making', 'you were doing / making', 'he/she was doing / making', 'we were doing / making', 'you all were doing / making', 'they were doing / making'],
    future: ['I will do / make', 'you will do / make', 'he/she will do / make', 'we will do / make', 'you all will do / make', 'they will do / make'],
    conditional: ['I would do / make', 'you would do / make', 'he/she would do / make', 'we would do / make', 'you all would do / make', 'they would do / make'],
    presentSubjunctive: ['(that) I do / make', '(that) you do / make', '(that) he/she do / make', '(that) we do / make', '(that) you all do / make', '(that) they do / make'],
  },
  poder: {
    present: ['I can', 'you can', 'he/she can', 'we can', 'you all can', 'they can'],
    preterite: ['I could', 'you could', 'he/she could', 'we could', 'you all could', 'they could'],
    imperfect: ['I could', 'you could', 'he/she could', 'we could', 'you all could', 'they could'],
    future: ['I will be able to', 'you will be able to', 'he/she will be able to', 'we will be able to', 'you all will be able to', 'they will be able to'],
    conditional: ['I would be able to', 'you would be able to', 'he/she would be able to', 'we would be able to', 'you all would be able to', 'they would be able to'],
    presentSubjunctive: ['(that) I can', '(that) you can', '(that) he/she can', '(that) we can', '(that) you all can', '(that) they can'],
  },
  querer: {
    present: ['I want', 'you want', 'he/she wants', 'we want', 'you all want', 'they want'],
    preterite: ['I wanted', 'you wanted', 'he/she wanted', 'we wanted', 'you all wanted', 'they wanted'],
    imperfect: ['I wanted', 'you wanted', 'he/she wanted', 'we wanted', 'you all wanted', 'they wanted'],
    future: ['I will want', 'you will want', 'he/she will want', 'we will want', 'you all will want', 'they will want'],
    conditional: ['I would want', 'you would want', 'he/she would want', 'we would want', 'you all would want', 'they would want'],
    presentSubjunctive: ['(that) I want', '(that) you want', '(that) he/she want', '(that) we want', '(that) you all want', '(that) they want'],
  },
  saber: {
    present: ['I know', 'you know', 'he/she knows', 'we know', 'you all know', 'they know'],
    preterite: ['I found out', 'you found out', 'he/she found out', 'we found out', 'you all found out', 'they found out'],
    imperfect: ['I knew', 'you knew', 'he/she knew', 'we knew', 'you all knew', 'they knew'],
    future: ['I will know', 'you will know', 'he/she will know', 'we will know', 'you all will know', 'they will know'],
    conditional: ['I would know', 'you would know', 'he/she would know', 'we would know', 'you all would know', 'they would know'],
    presentSubjunctive: ['(that) I know', '(that) you know', '(that) he/she know', '(that) we know', '(that) you all know', '(that) they know'],
  },
  dar: {
    present: ['I give', 'you give', 'he/she gives', 'we give', 'you all give', 'they give'],
    preterite: ['I gave', 'you gave', 'he/she gave', 'we gave', 'you all gave', 'they gave'],
    imperfect: ['I used to give', 'you used to give', 'he/she used to give', 'we used to give', 'you all used to give', 'they used to give'],
    future: ['I will give', 'you will give', 'he/she will give', 'we will give', 'you all will give', 'they will give'],
    conditional: ['I would give', 'you would give', 'he/she would give', 'we would give', 'you all would give', 'they would give'],
    presentSubjunctive: ['(that) I give', '(that) you give', '(that) he/she give', '(that) we give', '(that) you all give', '(that) they give'],
  },
  venir: {
    present: ['I come', 'you come', 'he/she comes', 'we come', 'you all come', 'they come'],
    preterite: ['I came', 'you came', 'he/she came', 'we came', 'you all came', 'they came'],
    imperfect: ['I used to come', 'you used to come', 'he/she used to come', 'we used to come', 'you all used to come', 'they used to come'],
    future: ['I will come', 'you will come', 'he/she will come', 'we will come', 'you all will come', 'they will come'],
    conditional: ['I would come', 'you would come', 'he/she would come', 'we would come', 'you all would come', 'they would come'],
    presentSubjunctive: ['(that) I come', '(that) you come', '(that) he/she come', '(that) we come', '(that) you all come', '(that) they come'],
  },
  ver: {
    present: ['I see', 'you see', 'he/she sees', 'we see', 'you all see', 'they see'],
    preterite: ['I saw', 'you saw', 'he/she saw', 'we saw', 'you all saw', 'they saw'],
    imperfect: ['I used to see', 'you used to see', 'he/she used to see', 'we used to see', 'you all used to see', 'they used to see'],
    future: ['I will see', 'you will see', 'he/she will see', 'we will see', 'you all will see', 'they will see'],
    conditional: ['I would see', 'you would see', 'he/she would see', 'we would see', 'you all would see', 'they would see'],
    presentSubjunctive: ['(that) I see', '(that) you see', '(that) he/she see', '(that) we see', '(that) you all see', '(that) they see'],
  },
  decir: {
    present: ['I say / tell', 'you say / tell', 'he/she says / tells', 'we say / tell', 'you all say / tell', 'they say / tell'],
    preterite: ['I said / told', 'you said / told', 'he/she said / told', 'we said / told', 'you all said / told', 'they said / told'],
    future: ['I will say / tell', 'you will say / tell', 'he/she will say / tell', 'we will say / tell', 'you all will say / tell', 'they will say / tell'],
    conditional: ['I would say / tell', 'you would say / tell', 'he/she would say / tell', 'we would say / tell', 'you all would say / tell', 'they would say / tell'],
    presentSubjunctive: ['(that) I say / tell', '(that) you say / tell', '(that) he/she say / tell', '(that) we say / tell', '(that) you all say / tell', '(that) they say / tell'],
  },
  salir: {
    present: ['I leave / go out', 'you leave / go out', 'he/she leaves / goes out', 'we leave / go out', 'you all leave / go out', 'they leave / go out'],
    preterite: ['I left / went out', 'you left / went out', 'he/she left / went out', 'we left / went out', 'you all left / went out', 'they left / went out'],
    future: ['I will leave / go out', 'you will leave / go out', 'he/she will leave / go out', 'we will leave / go out', 'you all will leave / go out', 'they will leave / go out'],
    conditional: ['I would leave / go out', 'you would leave / go out', 'he/she would leave / go out', 'we would leave / go out', 'you all would leave / go out', 'they would leave / go out'],
    presentSubjunctive: ['(that) I leave / go out', '(that) you leave / go out', '(that) he/she leave / go out', '(that) we leave / go out', '(that) you all leave / go out', '(that) they leave / go out'],
  },
  poner: {
    present: ['I put', 'you put', 'he/she puts', 'we put', 'you all put', 'they put'],
    preterite: ['I put', 'you put', 'he/she put', 'we put', 'you all put', 'they put'],
    future: ['I will put', 'you will put', 'he/she will put', 'we will put', 'you all will put', 'they will put'],
    conditional: ['I would put', 'you would put', 'he/she would put', 'we would put', 'you all would put', 'they would put'],
    presentSubjunctive: ['(that) I put', '(that) you put', '(that) he/she put', '(that) we put', '(that) you all put', '(that) they put'],
  },
  valer: {
    present: ['I am worth', 'you are worth', 'he/she is worth', 'we are worth', 'you all are worth', 'they are worth'],
    future: ['I will be worth', 'you will be worth', 'he/she will be worth', 'we will be worth', 'you all will be worth', 'they will be worth'],
    conditional: ['I would be worth', 'you would be worth', 'he/she would be worth', 'we would be worth', 'you all would be worth', 'they would be worth'],
    presentSubjunctive: ['(that) I be worth', '(that) you be worth', '(that) he/she be worth', '(that) we be worth', '(that) you all be worth', '(that) they be worth'],
  },
  pasar: {
    present: ['I pass / spend time', 'you pass / spend time', 'he/she passes / spends time', 'we pass / spend time', 'you all pass / spend time', 'they pass / spend time'],
  },
  trabajar: {
    present: ['I work', 'you work', 'he/she works', 'we work', 'you all work', 'they work'],
  },
  levantarse: {
    present: ['I get up', 'you get up', 'he/she gets up', 'we get up', 'you all get up', 'they get up'],
  },
  ducharse: {
    present: ['I shower', 'you shower', 'he/she showers', 'we shower', 'you all shower', 'they shower'],
  },
  vestirse: {
    present: ['I get dressed', 'you get dressed', 'he/she gets dressed', 'we get dressed', 'you all get dressed', 'they get dressed'],
  },
  acostarse: {
    present: ['I go to bed', 'you go to bed', 'he/she goes to bed', 'we go to bed', 'you all go to bed', 'they go to bed'],
  },
  despertarse: {
    present: ['I wake up', 'you wake up', 'he/she wakes up', 'we wake up', 'you all wake up', 'they wake up'],
  },
  llamarse: {
    present: ['I am called', 'you are called', 'he/she is called', 'we are called', 'you all are called', 'they are called'],
  },
  sentirse: {
    present: ['I feel', 'you feel', 'he/she feels', 'we feel', 'you all feel', 'they feel'],
  },
  quedarse: {
    present: ['I stay / remain', 'you stay / remain', 'he/she stays / remains', 'we stay / remain', 'you all stay / remain', 'they stay / remain'],
  },
};

function verbStem(english: string): string {
  return english
    .replace(/^to\s+/i, '')
    .split(/[/(/]/)[0]
    .trim();
}

function thirdPerson(stem: string): string {
  if (stem.endsWith('s') || stem.endsWith('x') || stem.endsWith('z') || stem.endsWith('ch') || stem.endsWith('sh')) {
    return `${stem}es`;
  }
  if (stem.endsWith('y') && !/[aeiou]y$/i.test(stem)) {
    return `${stem.slice(0, -1)}ies`;
  }
  return `${stem}s`;
}

function buildGenericEnglish(tenseKey: TenseKey, verbEnglish: string, spainForms: string[]): string[] {
  const stem = verbStem(verbEnglish);

  return PERSON_LABELS.map((_, i) => {
    const subject = SUBJECTS[i];
    const base = stem;

    switch (tenseKey) {
      case 'present': {
        const verb = i === 2 ? thirdPerson(base) : base;
        return `${subject} ${verb}`;
      }
      case 'preterite':
        return `${subject} ${base} (past)`;
      case 'imperfect':
        return `${subject} used to ${base}`;
      case 'future':
        return `${subject} will ${base}`;
      case 'conditional':
        return `${subject} would ${base}`;
      case 'presentSubjunctive':
        return `(that) ${subject.toLowerCase()} ${base}`;
      default:
        return `${subject} ${base}`;
    }
  });
}

export function resolveEnglishForms(
  infinitive: string,
  verbEnglish: string,
  tenseKey: TenseKey,
  spainForms: string[],
  explicit?: string[],
): string[] {
  if (explicit?.length === 6) return explicit;

  const override = ENGLISH_OVERRIDES[infinitive.toLowerCase()]?.[tenseKey];
  if (override?.length === 6) return override;

  return buildGenericEnglish(tenseKey, verbEnglish, spainForms);
}
