export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
export const lerp  = (a: number, b: number, t: number) => a + (b - a) * t;
