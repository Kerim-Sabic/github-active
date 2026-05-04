import { createHash } from "node:crypto";

export type SeededRandom = {
  next: () => number;
  pick: <T>(items: readonly T[]) => T;
  integer: (min: number, max: number) => number;
};

export function createSeededRandom(seed: string): SeededRandom {
  let state = seedToState(seed);

  function next(): number {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  }

  return {
    next,
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error("Cannot pick from an empty list.");
      return items[Math.floor(next() * items.length)] ?? items[0];
    },
    integer(min: number, max: number): number {
      return Math.floor(next() * (max - min + 1)) + min;
    }
  };
}

function seedToState(seed: string): number {
  const digest = createHash("sha256").update(seed).digest();
  return digest.readUInt32BE(0);
}
