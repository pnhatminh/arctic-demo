import type { Transaction } from "@mysten/sui/transactions";

export type MoveCallConstructor = (tx: Transaction, id: string) => void;
