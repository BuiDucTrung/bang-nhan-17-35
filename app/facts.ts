export type Table = 17 | 35;
export type Fact = [Table, number];

export const TABLES: Table[] = [17, 35];
export const MAX_N = 20;

/** Cách tách nhẩm cho từng phép, ví dụ 17×8 = 10×8 + 7×8 */
export function splitText(a: Table, n: number): string {
  return a === 17
    ? `10×${n} + 7×${n} = ${10 * n} + ${7 * n}`
    : `30×${n} + 5×${n} = ${30 * n} + ${5 * n}`;
}

export const factKey = (a: Table, n: number) => `${a}x${n}`;
