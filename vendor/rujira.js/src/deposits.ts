import { Network } from "./network";

export interface DepositProvider {
  useDeposits: () => PendingDeposit[];
}

export interface PendingDeposit {
  hash: string;
  timestamp: Date;
  status: "pending" | "succeeded" | "refunded" | "failed";
  message?: string;
  network: Network;
  coin: {
    amount: bigint;
    symbol: string;
  };
  // observedTxIn?: string;
}
