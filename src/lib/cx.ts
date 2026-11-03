/** Join class names, skipping false and undefined. */
export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');
