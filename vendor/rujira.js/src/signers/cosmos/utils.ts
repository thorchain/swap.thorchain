import * as k from "@keplr-wallet/types";
import Long from "long";
import {
  DirectSignResponse,
  EncodeObject,
  OfflineDirectSigner,
  OfflineSigner,
} from "./proto-signing";
import { Event } from "./rpc/comet38";
import { MsgData } from "./types/cosmos/base/abci/v1beta1/abci";
import { SignDoc } from "./types/cosmos/tx/v1beta1/tx";

export class TimeoutError extends Error {
  public readonly txId: string;

  public constructor(message: string, txId: string) {
    super(message);
    this.txId = txId;
  }
}

export interface BlockHeader {
  readonly version: {
    readonly block: string;
    readonly app: string;
  };
  readonly height: number;
  readonly chainId: string;
  /** An RFC 3339 time string like e.g. '2020-02-15T10:39:10.4696305Z' */
  readonly time: string;
}

export interface Block {
  /** The ID is a hash of the block header (uppercase hex) */
  readonly id: string;
  readonly header: BlockHeader;
  /** Array of raw transactions */
  readonly txs: readonly Uint8Array[];
}

/** A transaction that is indexed as part of the transaction history */
export interface IndexedTx {
  readonly height: number;
  /** The position of the transaction within the block. This is a 0-based index. */
  readonly txIndex: number;
  /** Transaction hash (might be used as transaction ID). Guaranteed to be non-empty upper-case hex */
  readonly hash: string;
  /** Transaction execution error code. 0 on success. */
  readonly code: number;
  readonly events: readonly Event[];
  /**
   * A string-based log document.
   *
   * This currently seems to merge attributes of multiple events into one event per type
   * (https://github.com/tendermint/tendermint/issues/9595). You might want to use the `events`
   * field instead.
   *
   * @deprecated This field is not filled anymore in Cosmos SDK 0.50+ (https://github.com/cosmos/cosmos-sdk/pull/15845).
   * Please consider using `events` instead.
   */
  readonly rawLog: string;
  /**
   * Raw transaction bytes stored in Tendermint.
   *
   * If you hash this, you get the transaction hash (= transaction ID):
   *
   * ```js
   * import { sha256 } from "@cosmjs/crypto";
   * import { toHex } from "@cosmjs/encoding";
   *
   * const transactionId = toHex(sha256(indexTx.tx)).toUpperCase();
   * ```
   *
   * Use `decodeTxRaw` from @cosmjs/proto-signing to decode this.
   */
  readonly tx: Uint8Array;
  /**
   * The message responses of the [TxMsgData](https://github.com/cosmos/cosmos-sdk/blob/v0.46.3/proto/cosmos/base/abci/v1beta1/abci.proto#L128-L140)
   * as `Any`s.
   * This field is an empty list for chains running Cosmos SDK < 0.46.
   */
  readonly msgResponses: Array<{
    readonly typeUrl: string;
    readonly value: Uint8Array;
  }>;
  readonly gasUsed: bigint;
  readonly gasWanted: bigint;
}

export interface SequenceResponse {
  readonly accountNumber: number;
  readonly sequence: number;
}

/**
 * The response after successfully broadcasting a transaction.
 * Success or failure refer to the execution result.
 */
export interface DeliverTxResponse {
  readonly height: number;
  /** The position of the transaction within the block. This is a 0-based index. */
  readonly txIndex: number;
  /** Error code. The transaction suceeded if and only if code is 0. */
  readonly code: number;
  readonly transactionHash: string;
  readonly events: readonly Event[];
  /**
   * A string-based log document.
   *
   * This currently seems to merge attributes of multiple events into one event per type
   * (https://github.com/tendermint/tendermint/issues/9595). You might want to use the `events`
   * field instead.
   *
   * @deprecated This field is not filled anymore in Cosmos SDK 0.50+ (https://github.com/cosmos/cosmos-sdk/pull/15845).
   * Please consider using `events` instead.
   */
  readonly rawLog?: string;
  /** @deprecated Use `msgResponses` instead. */
  readonly data?: readonly MsgData[];
  /**
   * The message responses of the [TxMsgData](https://github.com/cosmos/cosmos-sdk/blob/v0.46.3/proto/cosmos/base/abci/v1beta1/abci.proto#L128-L140)
   * as `Any`s.
   * This field is an empty list for chains running Cosmos SDK < 0.46.
   */
  readonly msgResponses: Array<{
    readonly typeUrl: string;
    readonly value: Uint8Array;
  }>;
  readonly gasUsed: bigint;
  readonly gasWanted: bigint;
}

export function isDeliverTxFailure(result: DeliverTxResponse): boolean {
  return !!result.code;
}

export function isDeliverTxSuccess(result: DeliverTxResponse): boolean {
  return !isDeliverTxFailure(result);
}

/**
 * Ensures the given result is a success. Throws a detailed error message otherwise.
 */
export function assertIsDeliverTxSuccess(result: DeliverTxResponse): void {
  if (isDeliverTxFailure(result)) {
    throw new Error(
      `Error when broadcasting tx ${result.transactionHash} at height ${result.height}. Code: ${result.code}; Raw log: ${result.rawLog}`
    );
  }
}

/**
 * Ensures the given result is a failure. Throws a detailed error message otherwise.
 */
export function assertIsDeliverTxFailure(result: DeliverTxResponse): void {
  if (isDeliverTxSuccess(result)) {
    throw new Error(
      `Transaction ${result.transactionHash} did not fail at height ${result.height}. Code: ${result.code}; Raw log: ${result.rawLog}`
    );
  }
}

/**
 * An error when broadcasting the transaction. This contains the CheckTx errors
 * from the blockchain. Once a transaction is included in a block no BroadcastTxError
 * is thrown, even if the execution fails (DeliverTx errors).
 */
export class BroadcastTxError extends Error {
  public readonly code: number;
  public readonly codespace: string;
  public readonly log: string | undefined;

  public constructor(code: number, codespace: string, log: string | undefined) {
    super(
      `Broadcasting transaction failed with code ${code} (codespace: ${codespace}). Log: ${log}`
    );
    this.code = code;
    this.codespace = codespace;
    this.log = log;
  }
}

export const castSigner = (
  old: k.OfflineAminoSigner | k.OfflineDirectSigner
): OfflineSigner => ("signAmino" in old ? old : castDirectSigner(old));

const castDirectSigner = (old: k.OfflineDirectSigner): OfflineDirectSigner => ({
  ...old,
  signDirect: async (
    signerAddress: string,
    signDoc: SignDoc
  ): Promise<DirectSignResponse> => {
    const res = await old.signDirect(signerAddress, {
      ...signDoc,
      accountNumber: Long.fromNumber(Number(signDoc.accountNumber)),
    });
    return {
      ...res,
      signed: {
        ...res.signed,
        accountNumber: BigInt(res.signed.accountNumber.toString()),
      },
    };
  },
});

export const sign = (_msgs: EncodeObject[]) => {};

export function assert(condition: any, msg?: string): asserts condition {
  if (!condition) {
    throw new Error(msg || "condition is not truthy");
  }
}

export function assertDefined<T>(
  value: T | undefined,
  msg?: string
): asserts value is T {
  if (value === undefined) {
    throw new Error(msg ?? "value is undefined");
  }
}

export function assertDefinedAndNotNull<T>(
  value: T | undefined | null,
  msg?: string
): asserts value is T {
  if (value === undefined || value === null) {
    throw new Error(msg ?? "value is undefined or null");
  }
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Compares the content of two arrays-like objects for equality.
 *
 * Equality is defined as having equal length and element values, where element equality means `===` returning `true`.
 *
 * This allows you to compare the content of a Buffer, Uint8Array or number[], ignoring the specific type.
 * As a consequence, this returns different results than Jasmine's `toEqual`, which ensures elements have the same type.
 */
export function arrayContentEquals<T extends string | number | boolean>(
  a: ArrayLike<T>,
  b: ArrayLike<T>
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Checks if `a` starts with the contents of `b`.
 *
 * This requires equality of the element values, where element equality means `===` returning `true`.
 *
 * This allows you to compare the content of a Buffer, Uint8Array or number[], ignoring the specific type.
 * As a consequence, this returns different results than Jasmine's `toEqual`, which ensures elements have the same type.
 */
export function arrayContentStartsWith<T extends string | number | boolean>(
  a: ArrayLike<T>,
  b: ArrayLike<T>
): boolean {
  if (a.length < b.length) return false;
  for (let i = 0; i < b.length; ++i) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
