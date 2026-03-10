// Basic Hangul characters (consonants and vowels)
export const HANGUL_CHARS = [
  "ㄱ",
  "ㄴ",
  "ㄷ",
  "ㄹ",
  "ㅁ",
  "ㅂ",
  "ㅅ",
  "ㅇ",
  "ㅈ",
  "ㅊ",
  "ㅋ",
  "ㅌ",
  "ㅍ",
  "ㅎ",
  "ㅏ",
  "ㅑ",
  "ㅓ",
  "ㅕ",
  "ㅗ",
  "ㅛ",
  "ㅜ",
  "ㅠ",
  "ㅡ",
  "ㅣ",
];

// Helper function to check if a character is Hangul
export function isHangul(char: string): boolean {
  return /[\u3131-\u314E\u314F-\u3163\uAC00-\uD7A3]/.test(char);
}
