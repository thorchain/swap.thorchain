import { Network } from "./network";

export interface Asset<T extends string = string> {
  type: T;
  chain: Network;
  asset: string;
  metadata: {
    decimals: number;
    symbol: string;
  };
  variants?: {
    layer1?: Asset<T>;
    secured?: Asset<T>;
    native?: { denom: string };
  } | null;
}

export const assetPairFilter =
  (query?: string) =>
  (a: {
    assetBase: { metadata: { symbol: string } };
    assetQuote: { metadata: { symbol: string } };
  }): boolean => {
    if (!query) return true;

    const parts = query.split(/[\s-\/]/);

    if (parts.length === 1)
      return (
        checkMatch(parts[0], a.assetBase.metadata.symbol) ||
        checkMatch(parts[0], a.assetQuote.metadata.symbol)
      );
    return (
      checkMatch(parts[0], a.assetBase.metadata.symbol) &&
      checkMatch(parts[1], a.assetQuote.metadata.symbol)
    );
  };

const checkMatch = (query: string, target: string): boolean => {
  if (!query) return true;
  if (query === "*") return true;
  return target.toLowerCase().includes(query.toLowerCase());
};
