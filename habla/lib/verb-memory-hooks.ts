/** Pronunciation / memory hooks for irregular verbs in Phase 1 cards. */
export const VERB_MEMORY_HOOKS: Record<string, string> = {
  ser: 'SEH-r — ser is “to be” permanently, like your essence',
  estar: 'es-TAHR — think “state” for temporary estar',
  tener: 'ten-DREH — ten like ten fingers, tendré like tendre love',
  ir: 'eer — ir sounds like “ear” going somewhere',
  hacer: 'ah-SEHR — har- stem for future: haré sounds like “ah, ray!”',
  poder: 'poh-DEHR — pod- stem: podré = you CAN (poder)',
  querer: 'keh-REHR — querr- stem: querré = what you WANT',
  saber: 'sah-BEHR — sabr- stem: sabré = what you will KNOW',
  dar: 'dahr — irregular dar → daré, like “dare” to give',
  venir: 'veh-NEER — vendr- stem: vendré = you will COME',
  decir: 'deh-SEER — dir- stem: diré = you will SAY',
  salir: 'sah-LEER — saldr- stem: saldré = you will LEAVE',
  poner: 'poh-NEHR — pondr- stem: pondré = you will PUT',
  valer: 'vah-LEHR — valdr- stem: valdrá = it will be WORTH',
  ver: 'vehr — veía in imperfect, irregular sight verb',
  haber: 'ah-BEHR — hub- in preterite, helper “there is/was”',
};

export function getVerbMemoryHook(infinitive: string): string | undefined {
  const key = infinitive.trim().toLowerCase().split(/[\s(/]/)[0];
  return VERB_MEMORY_HOOKS[key];
}

export function pickVerbExample(
  infinitive: string,
  examples: { spanish: string; english: string }[],
  yoForm?: string,
): { spanish: string; english: string } | null {
  const stem = infinitive.trim().toLowerCase().split(/[\s(/]/)[0];
  const yo = yoForm?.toLowerCase() ?? '';
  for (const ex of examples) {
    const lower = ex.spanish.toLowerCase();
    if (lower.includes(stem) || (yo && lower.includes(yo))) {
      return ex;
    }
  }
  return examples[0] ?? null;
}
