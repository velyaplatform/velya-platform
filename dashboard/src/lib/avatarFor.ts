import type { Gender } from "./agentPersona";

const MASCULINE_CHARACTERS = ["Male1", "Male2", "Male3", "Male4"] as const;
const FEMININE_CHARACTERS = [
  "Female1",
  "Female2",
  "Female3",
  "Female4",
  "Female5",
  "Female6",
] as const;

type Character =
  | (typeof MASCULINE_CHARACTERS)[number]
  | (typeof FEMININE_CHARACTERS)[number]
  | "CEO";

function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function avatarFor(agentId: string, gender: Gender): Character {
  if (agentId === "executive/ceo") {
    // CEO: sprite custom — pele branca + barba + topete + terno azul-marinho.
    return "CEO";
  }
  const pool = gender === "m" ? MASCULINE_CHARACTERS : FEMININE_CHARACTERS;
  return pool[hashString(agentId) % pool.length];
}

export function blinkFrame(character: Character): string {
  return `/assets/avatars/${character}_blink.png`;
}

export function waveFrames(character: Character): string[] {
  const hasNumbered = ["Female1", "Female2", "Male1", "Male2", "CEO"];
  if (hasNumbered.includes(character)) {
    return [
      `/assets/avatars/${character}_1wave.png`,
      `/assets/avatars/${character}_2wave.png`,
    ];
  }
  return [`/assets/avatars/${character}_wave.png`];
}
