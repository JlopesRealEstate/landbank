/**
 * RAMPA SEMÁFORO PARA CURVAS DE NÍVEL
 * ------------------------------------------------------------------
 * Degradê verde → amarelo → laranja → vermelho conforme a cota sobe, para
 * leitura imediata do relevo sobre imagem de satélite (baixo = verde;
 * alto = vermelho). Funciona no mapa, na legenda e no PDF.
 */

type Stop = { at: number; color: [number, number, number] };

const RAMP: Stop[] = [
  { at: 0.0, color: [22, 163, 74] }, // verde
  { at: 0.25, color: [101, 190, 46] }, // verde-limão
  { at: 0.45, color: [250, 204, 21] }, // amarelo
  { at: 0.65, color: [249, 146, 22] }, // laranja
  { at: 0.82, color: [239, 68, 68] }, // vermelho
  { at: 1.0, color: [153, 27, 27] }, // vermelho escuro
];

export function elevationColor(elevation: number, min: number, max: number): string {
  const span = max - min || 1;
  const t = Math.max(0, Math.min(1, (elevation - min) / span));
  for (let index = 1; index < RAMP.length; index += 1) {
    const previous = RAMP[index - 1];
    const current = RAMP[index];
    if (t <= current.at) {
      const local = (t - previous.at) / (current.at - previous.at || 1);
      const blend = previous.color.map((channel, channelIndex) =>
        Math.round(channel + (current.color[channelIndex] - channel) * local),
      );
      return `rgb(${blend[0]},${blend[1]},${blend[2]})`;
    }
  }
  const last = RAMP[RAMP.length - 1].color;
  return `rgb(${last[0]},${last[1]},${last[2]})`;
}

/** Cor da restrição (destaque verde-limão). */
export const RESTRICTION_COLOR = "#84cc16";
export const RESTRICTION_COLOR_DARK = "#4d7c0f";

/** CSS linear-gradient para a legenda do degradê. */
export function contourGradientCss(): string {
  return `linear-gradient(90deg, ${RAMP.map((stop) => `${elevationColor(
    stop.at * 100,
    0,
    100,
  )} ${Math.round(stop.at * 100)}%`).join(", ")})`;
}

export const CONTOUR_RAMP_STOPS = RAMP.map((stop) => ({ at: stop.at, color: `rgb(${stop.color.join(",")})` }));
