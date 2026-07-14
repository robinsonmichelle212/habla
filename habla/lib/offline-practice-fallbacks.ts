import { getWeekDefinition } from '@/lib/grammar-curriculum';
import type { QuickFireQuestion } from '@/lib/claude';

function q(
  id: string,
  type: QuickFireQuestion['type'],
  prompt: string,
  expectedAnswer: string,
  acceptableAnswers?: string[],
): QuickFireQuestion {
  return {
    id,
    type,
    prompt,
    expectedAnswer,
    acceptableAnswers: acceptableAnswers ?? [expectedAnswer],
  };
}

/** Curated offline drills for curriculum weeks 21–30. */
function getExtendedWeekDrillQuestions(week: number): QuickFireQuestion[] | null {
  if (week >= 21 && week <= 22) {
    return [
      q(`offline-${week}-g1`, 'conjugate', 'What is the gerund of HABLAR?', 'hablando'),
      q(`offline-${week}-g2`, 'fill_blank', 'Complete: Estoy ___ (comer)', 'comiendo'),
      q(`offline-${week}-g3`, 'conjugate', 'What is the gerund of IR?', 'yendo'),
      q(`offline-${week}-g4`, 'conjugate', 'What is the gerund of LEER?', 'leyendo'),
      q(`offline-${week}-g5`, 'conjugate', 'What is the gerund of DECIR?', 'diciendo'),
      q(`offline-${week}-g6`, 'fill_blank', 'Complete: Sigo ___ (aprender)', 'aprendiendo'),
      q(`offline-${week}-g7`, 'fill_blank', 'Complete: Continúa ___ (llover)', 'lloviendo', [
        'lloviendo',
      ]),
      q(`offline-${week}-g8`, 'fill_blank', 'Complete: Llevo tres horas ___ (estudiar)', 'estudiando'),
      q(`offline-${week}-g9`, 'quick_translate', 'Translate: He left running', 'Salió corriendo', [
        'Salió corriendo',
        'Salio corriendo',
      ]),
      q(`offline-${week}-g10`, 'conjugate', 'What is the gerund of PODER?', 'pudiendo'),
    ];
  }

  if (week >= 23 && week <= 24) {
    return [
      q(`offline-${week}-p1`, 'conjugate', 'What is the past participle of HACER?', 'hecho'),
      q(`offline-${week}-p2`, 'fill_blank', 'Complete: He ___ (ver) esa película', 'visto'),
      q(
        `offline-${week}-p3`,
        'correct_mistake',
        'Is this correct? La puerta está abierto',
        'No — abierta (must agree with feminine noun)',
        [
          'No — abierta (must agree with feminine noun)',
          'No — abierta',
          'abierta',
          'No, abierta',
          'No',
        ],
      ),
      q(`offline-${week}-p4`, 'conjugate', 'What is the past participle of ESCRIBIR?', 'escrito'),
      q(`offline-${week}-p5`, 'conjugate', 'What is the past participle of ABRIR?', 'abierto'),
      q(`offline-${week}-p6`, 'conjugate', 'What is the past participle of DECIR?', 'dicho'),
      q(`offline-${week}-p7`, 'conjugate', 'What is the past participle of PONER?', 'puesto'),
      q(`offline-${week}-p8`, 'conjugate', 'What is the past participle of VOLVER?', 'vuelto'),
      q(`offline-${week}-p9`, 'conjugate', 'What is the past participle of ROMPER?', 'roto'),
      q(`offline-${week}-p10`, 'fill_blank', 'Complete: Hemos ___ (hacer) la tarea', 'hecho'),
    ];
  }

  if (week >= 25 && week <= 26) {
    return [
      q(`offline-${week}-pf1`, 'quick_translate', 'Translate: I have eaten', 'He comido', [
        'He comido',
      ]),
      q(`offline-${week}-pf2`, 'fill_blank', 'Complete: ¿___ (tú/ver) esa serie?', '¿Has visto?', [
        '¿Has visto?',
        'Has visto',
        'has visto',
        '¿Has visto',
      ]),
      q(`offline-${week}-pf3`, 'choose_tense', 'Spain or Argentina? ¿Has comido?', 'Spain', [
        'Spain',
        'España',
        'spain',
      ]),
      q(
        `offline-${week}-pf4`,
        'quick_translate',
        'Translate: I had eaten when he arrived',
        'Había comido cuando llegó',
        ['Había comido cuando llegó', 'Habia comido cuando llego'],
      ),
      q(`offline-${week}-pf5`, 'fill_blank', 'Complete: Ya ___ (ellos/salir)', 'habían salido', [
        'habían salido',
        'habian salido',
      ]),
      q(
        `offline-${week}-pf6`,
        'quick_translate',
        'Translate: By tomorrow I will have finished',
        'Para mañana habré terminado',
        ['Para mañana habré terminado', 'Para manana habre terminado'],
      ),
      q(`offline-${week}-pf7`, 'fill_blank', 'Complete: Habré ___ (terminar)', 'terminado'),
      q(`offline-${week}-pf8`, 'choose_tense', 'Spain or Argentina? ¿Comiste?', 'Argentina', [
        'Argentina',
        'argentina',
      ]),
      q(`offline-${week}-pf9`, 'fill_blank', 'Complete: ¿Has ___ (ver) esa película?', 'visto'),
      q(`offline-${week}-pf10`, 'fill_blank', 'Haber forms (yo present perfect): ___ comido', 'He', [
        'He',
        'he',
      ]),
    ];
  }

  if (week === 27) {
    return [
      q(`offline-27-pr1`, 'fill_blank', 'Fill in: Voy ___ Madrid', 'a'),
      q(`offline-27-pr2`, 'fill_blank', 'Fill in: Estoy ___ casa', 'en'),
      q(`offline-27-pr3`, 'fill_blank', 'Fill in: Soy ___ Londres', 'de'),
      q(`offline-27-pr4`, 'fill_blank', 'Fill in: Llamo ___ María', 'a'),
      q(`offline-27-pr5`, 'fill_blank', 'Fill in: Empiezo ___ trabajar', 'a'),
      q(`offline-27-pr6`, 'fill_blank', 'Fill in: Una mesa ___ madera', 'de'),
      q(`offline-27-pr7`, 'fill_blank', 'Fill in: Escribo ___ bolígrafo', 'con'),
      q(`offline-27-pr8`, 'fill_blank', 'Fill in: Un libro ___ España', 'sobre'),
      q(`offline-27-pr9`, 'fill_blank', 'Fill in: ___ mañana', 'Hasta', ['Hasta', 'hasta']),
      q(`offline-27-pr10`, 'fill_blank', 'Fill in: ___ hace tres años', 'Desde', ['Desde', 'desde']),
    ];
  }

  if (week === 28) {
    return [
      q(`offline-28-c1`, 'fill_blank', 'Fill in: ___ de la casa (in front of)', 'delante', [
        'delante',
        'delante de',
      ]),
      q(`offline-28-c2`, 'fill_blank', 'Fill in: ___ de comer (after)', 'después', [
        'después',
        'despues',
        'después de',
      ]),
      q(`offline-28-c3`, 'fill_blank', 'Fill in: ___ de la mesa (on top of)', 'encima', [
        'encima',
        'encima de',
      ]),
      q(`offline-28-c4`, 'fill_blank', 'Fill in: ___ de la lluvia (despite)', 'a pesar', [
        'a pesar',
        'a pesar de',
      ]),
      q(`offline-28-c5`, 'fill_blank', 'Fill in: ___ de café (instead of)', 'en vez', [
        'en vez',
        'en vez de',
      ]),
      q(`offline-28-c6`, 'fill_blank', 'Fill in: ___ de la estación (near)', 'cerca', [
        'cerca',
        'cerca de',
      ]),
      q(`offline-28-c7`, 'fill_blank', 'Fill in: ___ a ti (thanks to)', 'gracias', [
        'gracias',
        'gracias a',
      ]),
      q(`offline-28-c8`, 'fill_blank', 'Fill in: ___ a la estación (next to)', 'junto', [
        'junto',
        'junto a',
      ]),
      q(
        `offline-28-c9`,
        'correct_mistake',
        'Which is correct: delante de OR en frente de?',
        'delante de',
        ['delante de', 'delante'],
      ),
      q(`offline-28-c10`, 'fill_blank', 'Fill in: ___ de salir (before)', 'antes', [
        'antes',
        'antes de',
      ]),
    ];
  }

  if (week === 29) {
    return [
      q(`offline-29-v1`, 'fill_blank', 'Fill in: Sueño ___ viajar', 'con'),
      q(`offline-29-v2`, 'fill_blank', 'Fill in: Pienso ___ ti', 'en'),
      q(`offline-29-v3`, 'fill_blank', 'Fill in: Me enamoré ___ España', 'de'),
      q(
        `offline-29-v4`,
        'correct_mistake',
        'Which is correct: casarse con OR casarse a?',
        'con',
        ['con', 'casarse con'],
      ),
      q(`offline-29-v5`, 'fill_blank', 'Fill in: Depende ___ ti', 'de'),
      q(`offline-29-v6`, 'fill_blank', 'Fill in: Me olvidé ___ llamar', 'de'),
      q(`offline-29-v7`, 'fill_blank', 'Fill in: Me acuerdo ___ ti', 'de'),
      q(`offline-29-v8`, 'fill_blank', 'Fill in: Quedé ___ María', 'con'),
      q(`offline-29-v9`, 'fill_blank', 'Fill in: Tardé ___ entender', 'en'),
      q(`offline-29-v10`, 'fill_blank', 'Fill in: El problema consiste ___ …', 'en'),
    ];
  }

  if (week === 30) {
    return [
      q(`offline-30-i1`, 'conjugate', 'Give the tú command for IR', 've'),
      q(`offline-30-i2`, 'conjugate', 'Give the tú command for HACER', 'haz'),
      q(`offline-30-i3`, 'conjugate', 'Make negative: Habla', 'No hables', [
        'No hables',
        'no hables',
      ]),
      q(`offline-30-i4`, 'fill_blank', 'Attach pronoun: Dime + lo', 'Dímelo', [
        'Dímelo',
        'Dímelo!',
        '¡Dímelo!',
        'Dimelo',
      ]),
      q(`offline-30-i5`, 'conjugate', 'Give the tú command for DECIR', 'di'),
      q(`offline-30-i6`, 'conjugate', 'Give the tú command for VENIR', 'ven'),
      q(`offline-30-i7`, 'conjugate', 'Make negative: Ve', 'No vayas', ['No vayas', 'no vayas']),
      q(`offline-30-i8`, 'fill_blank', 'Negative with pronouns: No + me lo + digas', 'No me lo digas', [
        'No me lo digas',
        '¡No me lo digas!',
      ]),
      q(`offline-30-i9`, 'conjugate', 'Give the tú command for PONER', 'pon'),
      q(`offline-30-i10`, 'conjugate', 'Give the vosotros command for HABLAR', 'hablad'),
    ];
  }

  return null;
}

/** Pre-written fallback drill questions per grammar week (10 each). */
export function getOfflineGrammarDrillQuestions(week: number): QuickFireQuestion[] {
  const curated = getExtendedWeekDrillQuestions(week);
  if (curated) return curated.slice(0, 10);

  const def = getWeekDefinition(week);
  const verbs = def.focusVerbs.slice(0, 5);
  const questions: QuickFireQuestion[] = [];

  verbs.forEach((verb, index) => {
    questions.push({
      id: `offline-${week}-${index}-1`,
      type: 'fill_blank',
      prompt: `Completa: Yo _____ (${verb}) todos los días.`,
      expectedAnswer: verb,
      acceptableAnswers: [verb],
    });
  });

  while (questions.length < 10) {
    const n = questions.length + 1;
    questions.push({
      id: `offline-${week}-extra-${n}`,
      type: 'quick_translate',
      prompt: `Traduce al español: "I practise ${def.topic} every week."`,
      expectedAnswer: `Practico ${def.topicSpanish} cada semana.`,
      acceptableAnswers: [`Practico ${def.topicSpanish} cada semana`],
    });
  }

  return questions.slice(0, 10);
}
