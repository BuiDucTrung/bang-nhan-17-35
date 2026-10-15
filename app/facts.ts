export type Table = 17 | 35;
export type Fact = [Table, number];

export const TABLES: Table[] = [17, 35];
export const MAX_N = 20;

export const factKey = (a: Table, n: number) => `${a}x${n}`;
