"use client";

/**
 * Gera a imagem 1080×1920 (formato stories) de um date, no próprio aparelho.
 */
import { compareScores } from "./compare";
import { categoryInfo } from "./categories";
import { formatDate, formatScore } from "./format";
import type { DateItem } from "./types";

const W = 1080;
const H = 1920;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Família de fonte real que o next/font gerou (ex.: "__Fraunces_abc"). */
function fontFamily(cssVar: string, fallback: string) {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
  return v ? `${v}, ${fallback}` : fallback;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const cut = lines.slice(0, maxLines);
    cut[maxLines - 1] = `${cut[maxLines - 1].replace(/\s+\S*$/, "")}…`;
    return cut;
  }
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export async function renderShareCard(opts: {
  date: DateItem;
  coverUrl?: string;
  myName: string;
  partnerName: string;
}): Promise<Blob> {
  const { date, coverUrl, myName, partnerName } = opts;
  await document.fonts?.ready;
  const serif = fontFamily("--font-fraunces", "Georgia, serif");
  const sans = fontFamily("--font-inter", "system-ui, sans-serif");

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // fundo: gradiente da categoria (aparece se a foto não carregar)
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#e0796b");
  g.addColorStop(0.55, "#8c2f39");
  g.addColorStop(1, "#2b1d1a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  if (coverUrl) {
    try {
      const img = await loadImage(coverUrl);
      const scale = Math.max(W / img.width, H / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    } catch {
      /* sem foto: fica o gradiente */
    }
  }

  // escurece embaixo para o texto
  const shade = ctx.createLinearGradient(0, H * 0.3, 0, H);
  shade.addColorStop(0, "rgba(0,0,0,0)");
  shade.addColorStop(0.55, "rgba(0,0,0,0.55)");
  shade.addColorStop(1, "rgba(0,0,0,0.88)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);
  const top = ctx.createLinearGradient(0, 0, 0, 260);
  top.addColorStop(0, "rgba(0,0,0,0.45)");
  top.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, 260);

  // marca
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 46px ${serif}`;
  ctx.textBaseline = "top";
  ctx.fillText("♥ Date Rate", 80, 96);

  const pad = 80;
  let y = H - 140;
  ctx.textBaseline = "alphabetic";

  // notas
  const scores: [string, number | null][] = [
    [myName, date.my_score],
    [partnerName, date.partner_score],
  ];
  const shown = scores.filter(([, v]) => v != null);
  if (shown.length) {
    const boxW = (W - pad * 2 - 30) / 2;
    shown.forEach(([name, v], i) => {
      const x = pad + i * (boxW + 30);
      ctx.fillStyle = "rgba(255,255,255,0.14)";
      roundRect(ctx, x, y - 230, boxW, 230, 36);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.font = `500 38px ${sans}`;
      ctx.fillText(name, x + 40, y - 160);
      ctx.fillStyle = "#ffffff";
      ctx.font = `700 110px ${serif}`;
      ctx.fillText(String(v), x + 40, y - 40);
      const numW = ctx.measureText(String(v)).width;
      ctx.font = `500 40px ${sans}`;
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillText("/10", x + 48 + numW, y - 44);
    });
    y -= 290;
  }

  // veredito
  if (date.my_score != null && date.partner_score != null && date.couple_avg != null) {
    const v = compareScores({ mine: date.my_score, partner: date.partner_score, partnerName, seed: date.id });
    ctx.fillStyle = "#ffffff";
    ctx.font = `600 50px ${serif}`;
    ctx.fillText(`${v.emoji}  ${v.title}`, pad, y);
    ctx.font = `600 40px ${sans}`;
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(`Média do casal: ${formatScore(date.couple_avg)}`, pad, y + 62);
    y -= 120;
  }

  // frase
  if (date.quote) {
    ctx.font = `italic 500 44px ${serif}`;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    const lines = wrap(ctx, `“${date.quote}”`, W - pad * 2, 3);
    lines.reverse().forEach((l, i) => ctx.fillText(l, pad, y - i * 58));
    y -= lines.length * 58 + 40;
  }

  // data e tipo
  ctx.font = `500 40px ${sans}`;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(`${formatDate(date.date_on)} · ${categoryInfo(date.category).label}`, pad, y);
  y -= 70;

  // nome do lugar
  ctx.font = `700 112px ${serif}`;
  ctx.fillStyle = "#ffffff";
  const title = wrap(ctx, date.place_name, W - pad * 2, 3);
  title.reverse().forEach((l, i) => ctx.fillText(l, pad, y - i * 118));

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/png"),
  );
}

/** Abre o compartilhamento do celular (stories, WhatsApp…) ou baixa a imagem. */
export async function shareImage(blob: Blob, name: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([blob], `${name}.png`, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "downloaded";
}
