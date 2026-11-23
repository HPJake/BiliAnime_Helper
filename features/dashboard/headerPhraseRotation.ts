import { HEADER_PHRASES, type HeaderPhrase } from "./headerPhrases";

export const HEADER_PHRASE_INTERVAL_MS = 60_000;
export const HEADER_GREETING_DURATION_MS = 15_000;

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function createHeaderPhraseRotation(
  phrases: readonly HeaderPhrase[] = HEADER_PHRASES,
  random: () => number = Math.random
) {
  const greetings = phrases.filter((phrase) => phrase.category === "问候");
  if (greetings.length === 0) {
    throw new Error("标题文库至少需要一条问候语");
  }

  let current = greetings[Math.floor(random() * greetings.length)];
  let remaining = shuffle(phrases.filter((phrase) => phrase !== current), random);

  return {
    first: current,
    next(): HeaderPhrase {
      if (remaining.length === 0) {
        remaining = shuffle(phrases.filter((phrase) => phrase !== current), random);
      }
      current = remaining.pop() ?? current;
      return current;
    }
  };
}
