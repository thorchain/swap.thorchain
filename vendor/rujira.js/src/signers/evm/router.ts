import { ContractTransaction, Interface, Overrides } from "ethers";
import abi from "./eth-router-abi.json";

// Define the contract interface
export interface Router {
  /**
   * Calls the `depositWithExpiry` function on the contract.
   *
   * @param vault - The address of the payable vault.
   * @param asset - The address of the asset.
   * @param amount - The amount to deposit.
   * @param memo - A memo string for the transaction.
   * @param expiration - The expiration time as a Unix timestamp.
   * @param overrides - Optional transaction overrides, including `value` for the payable amount.
   *
   * @returns A promise that resolves to a `ContractTransaction`.
   */
  depositWithExpiry(
    vault: string, // address payable
    asset: string, // address
    amount: bigint, // uint256
    memo: string, // string
    expiration: bigint, // uint256
    overrides?: Overrides & { value?: bigint } // Overrides, with `value` for sending ether
  ): ContractTransaction;
}

export const evmRouter = (router: string): Router => {
  const iface = new Interface(abi);

  return {
    depositWithExpiry(vault, asset, amount, memo, expiration, _overrides) {
      const data = iface.encodeFunctionData("depositWithExpiry", [
        vault,
        asset,
        amount,
        memo,
        expiration,
      ]);

      return {
        to: router,
        data,
        value: amount,
      };
    },
  };
};
