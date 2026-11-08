/** Frases para quando as duas notas são reveladas. */

type Verdict = { emoji: string; title: string; detail: string | null };

/** Escolha estável: o mesmo date sempre mostra a mesma variação. */
function pick<T>(options: T[], seed: string): T {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return options[h % options.length];
}

export function compareScores(args: {
  mine: number;
  partner: number;
  partnerName: string;
  seed: string;
}): Verdict {
  const { mine, partner, partnerName, seed } = args;
  const diff = Math.abs(mine - partner);
  const pts = (n: number) => `${n} ${n === 1 ? "ponto" : "pontos"}`;
  const whoMore = mine > partner ? "Você gostou mais" : `${partnerName} gostou mais`;

  if (mine === 10 && partner === 10)
    return { emoji: "🏆", title: "Nota máxima dos dois!", detail: "Esse date entrou para a história." };
  if (mine <= 3 && partner <= 3)
    return {
      emoji: "😅",
      title: pick(["Pelo menos vocês concordam…", "Unânime: não foi dessa vez"], seed),
      detail: "Esse lugar não merece uma segunda chance.",
    };
  if (diff === 0)
    return {
      emoji: "🎯",
      title: pick(["Mesma nota! Sintonia total", "Notas idênticas. Almas gêmeas?", "Concordância perfeita"], seed),
      detail: null,
    };
  if (diff === 1)
    return {
      emoji: "💞",
      title: pick(["Quase iguais!", "Vocês concordaram", "Bem sintonizados"], seed),
      detail: `${whoMore}, por ${pts(1)}.`,
    };
  if (diff <= 3)
    return {
      emoji: "🤏",
      title: pick(["Opiniões parecidas, com ressalvas", "Quase lá", "Concordaram… mais ou menos"], seed),
      detail: `${whoMore}: ${pts(diff)} de diferença.`,
    };
  if (diff <= 5)
    return {
      emoji: "👀",
      title: pick(["Opa, discordância!", "Isso rende conversa", "Hmm, visões diferentes"], seed),
      detail: `${whoMore}: ${pts(diff)} de diferença.`,
    };
  return {
    emoji: "😂",
    title: pick(["Vocês foram ao mesmo date?", "Discordância épica!", "Precisamos conversar…"], seed),
    detail: `${whoMore}: ${pts(diff)} de diferença.`,
  };
}
