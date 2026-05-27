export const toDisplayCase = (value) => {
  if (typeof value !== 'string') return value;

  const text = value.trim();
  if (!text) return value;

  const hasLetter = /[A-Za-z]/.test(text);
  const hasLowercase = /[a-z]/.test(text);
  const allCapsText = hasLetter && !hasLowercase;

  if (!allCapsText) return value;

  return text
    .toLowerCase()
    .replace(/\b[a-z]/g, (char) => char.toUpperCase());
};
