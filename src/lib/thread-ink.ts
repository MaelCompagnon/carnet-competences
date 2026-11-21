// The end of the thread on the one-page: the string ties a knot, then writes a word, as one
// continuous line ("merci" in French, "thanks" in English), then the rest of the sentence
// appears in handwriting (content/<lang>/10-une-page.md). The paths are drawn by hand on a
// small grid (baseline at y 70, x-height at y 42) and scaled here, at build time, into pixels,
// so that the stroke keeps the width of the thread.

type Path = string;

/** The knot, hanging from the point where the thread arrives (40, 0), and running on to the word. */
const KNOT: Path =
  'M40 0 C40 40 34 70 40 108 C44 136 16 142 15 124 C14 106 46 102 51 120 C56 140 28 146 27 128 C26 114 42 112 47 132 C52 152 58 184 72 190';

/** One continuous stroke per word, plus the marks drawn after it (the dot of the i, the bar of the t). */
const WORDS: Record<string, { stroke: Path; marks: Path; width: number }> = {
  merci: {
    stroke:
      'M0 70 C6 70 10 52 12 42 C13 52 13 62 13 70 C13 52 18 38 24 40 C28 41 27 58 27 70 C27 52 32 38 38 40 C42 41 41 58 42 68 C43 72 48 70 52 64 C56 60 64 54 64 47 C64 41 56 40 54 47 C52 55 55 70 62 70 C67 70 70 66 73 62 C75 56 76 48 77 42 C79 44 83 45 86 43 C86 52 85 62 87 70 C89 70 92 60 95 50 C97 44 104 41 106 46 C103 43 97 45 95 53 C94 63 99 71 106 69 C110 67 113 63 116 58 C118 53 119 47 120 42 C120 52 120 64 123 70 C126 71 130 68 133 64',
    marks: 'M119.6 31 C121 29.6 122.6 31.2 121.4 32.6 C120.2 34 118.4 32.4 119.6 31',
    width: 133,
  },
  thanks: {
    stroke:
      'M0 70 C6 68 12 40 16 20 C17 40 16 60 18 70 C20 72 26 64 28 60 C32 46 36 24 34 16 C32 10 26 16 27 30 C28 44 28 60 28 70 C28 56 32 42 38 42 C43 42 42 58 43 68 C44 72 49 70 52 64 C56 56 60 44 66 44 C60 40 52 48 53 60 C54 70 62 70 66 60 C66 54 67 48 67 42 C67 54 66 64 69 70 C71 72 75 68 78 62 C80 56 81 48 82 42 C82 52 82 62 82 70 C82 52 87 40 93 42 C97 43 96 58 97 68 C98 72 103 70 106 64 C110 52 114 26 112 16 C110 10 104 16 105 30 C106 44 106 60 106 70 C106 60 112 46 118 46 C122 46 120 54 112 56 C116 58 118 66 122 70 C125 72 128 68 131 63 C133 58 135 50 137 44 C139 50 143 57 141 64 C139 71 131 71 129 67',
    marks: 'M8 34 C14 33 20 32 26 32',
    width: 143,
  },
};

export const INK_WORDS = Object.keys(WORDS);

/** Scale then shift a path made of absolute M, C and L commands only. */
function place(d: Path, scale: number, dx: number, dy: number): Path {
  let i = 0;
  return d.replace(/-?\d+(\.\d+)?/g, (n) => {
    const v = Number(n) * scale + (i++ % 2 === 0 ? dx : dy);
    return v.toFixed(1);
  });
}

const WORD_SCALE = 1.8;
/** Where the word starts, in knot units (the knot ends on it). */
const WORD_AT = { x: 72, y: 190 - 70 * WORD_SCALE };

/**
 * The knot and the word, in pixels, with the thread arriving at (x0, 0). `width` and `height`
 * are the size of the drawing, for its SVG.
 */
export function threadInk(word: string, x0: number) {
  const w = WORDS[word];
  if (!w) throw new Error(`[content] The thread can only write ${INK_WORDS.join(' or ')}, not "${word}"`);
  const dx = x0 - 40;
  return {
    knot: place(KNOT, 1, dx, 0),
    word: place(w.stroke, WORD_SCALE, WORD_AT.x + dx, WORD_AT.y),
    marks: place(w.marks, WORD_SCALE, WORD_AT.x + dx, WORD_AT.y),
    /** Left end of the word (on a phone, the handwriting goes under it). */
    start: WORD_AT.x + dx,
    /** Right end of the word, and its baseline: the handwritten end of the sentence goes there. */
    end: { x: WORD_AT.x + dx + w.width * WORD_SCALE, y: WORD_AT.y + 70 * WORD_SCALE },
    width: Math.ceil(WORD_AT.x + dx + w.width * WORD_SCALE + 8),
    height: Math.ceil(WORD_AT.y + 74 * WORD_SCALE),
  };
}
