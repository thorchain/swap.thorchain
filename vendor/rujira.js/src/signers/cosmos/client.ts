import { fromBase64, toHex } from "@cosmjs/encoding";
import { Int53, Uint53 } from "@cosmjs/math";
import { Account, accountFromAny, AccountParser } from "./accounts";
import {
  AminoConverters,
  AminoTypes,
  makeSignDoc as makeSignDocAmino,
  Pubkey,
  StdFee,
} from "./amino";
import { encodeSecp256k1Pubkey } from './amino';
import { calculateFee, GasPrice } from "./fee";
import { AuthExtension, setupAuthExtension } from "./modules/auth/queries";
import { createBankAminoConverters } from "./modules/bank/aminomessages";
import { createIbcAminoConverters } from "./modules/ibc/aminomessages";
import { setupTxExtension, TxExtension } from "./modules/tx/queries";
import { createWasmAminoConverters } from "./modules/wasm/aminomessages";
import {
  EncodeObject,
  encodePubkey,
  GeneratedType,
  isOfflineDirectSigner,
  makeAuthInfoBytes,
  makeSignDoc,
  OfflineSigner,
  Registry,
  TxBodyEncodeObject,
} from "./proto-signing";
import { QueryClient } from "./queryclient";
import { Comet38Client } from "./rpc/comet38";
import { MsgSend } from "./types/cosmos/bank/v1beta1/tx";
import { TxMsgData } from "./types/cosmos/base/abci/v1beta1/abci";
import { Coin } from "./types/cosmos/base/v1beta1/coin";
import { SignMode } from "./types/cosmos/tx/signing/v1beta1/signing";
import { TxRaw } from "./types/cosmos/tx/v1beta1/tx";
import {
  MsgExecuteContract,
  MsgInstantiateContract,
  MsgMigrateContract,
  MsgStoreCode,
} from "./types/cosmwasm/wasm/v1/tx";
import { MsgTransfer } from "./types/ibc/applications/transfer/v1/tx";
import { MsgDeposit } from "./types/thorchain/types/msg_deposit";
import {
  assert,
  assertDefined,
  BroadcastTxError,
  DeliverTxResponse,
  IndexedTx,
  SequenceResponse,
  sleep,
  TimeoutError,
} from "./utils";

export const defaultRegistryTypes: ReadonlyArray<[string, GeneratedType]> = [
  ["/cosmos.base.v1beta1.Coin", Coin],
  ["/cosmos.bank.v1beta1.MsgSend", MsgSend],
  ["/ibc.applications.transfer.v1.MsgTransfer", MsgTransfer],
  ["/cosmwasm.wasm.v1.MsgStoreCode", MsgStoreCode],
  ["/cosmwasm.wasm.v1.MsgInstantiateContract", MsgInstantiateContract],
  ["/cosmwasm.wasm.v1.MsgExecuteContract", MsgExecuteContract],
  ["/cosmwasm.wasm.v1.MsgMigrateContract", MsgMigrateContract],
  ["/types.MsgDeposit", MsgDeposit],
];

/**
 * Signing information for a single signer that is not included in the transaction.
 *
 * @see https://github.com/cosmos/cosmos-sdk/blob/v0.42.2/x/auth/signing/sign_mode_handler.go#L23-L37
 */
export interface SignerData {
  readonly accountNumber: number;
  readonly sequence: number;
  readonly chainId: string;
}

/** Use for testing only */
export interface PrivateCosmosClient {
  readonly registry: Registry;
}

export interface CosmosClientOptions {
  readonly accountParser?: AccountParser;
  readonly pubkeyEncoder?: (pubkey: Uint8Array) => Pubkey;
  readonly registry?: Registry;
  readonly aminoTypes?: AminoTypes;
  readonly broadcastTimeoutMs?: number;
  readonly broadcastPollIntervalMs?: number;
  readonly gasPrice?: GasPrice;
}

export function createDefaultAminoConverters(): AminoConverters {
  return {
    ...createBankAminoConverters(),
    ...createIbcAminoConverters(),
    ...createWasmAminoConverters(),
  };
}

type ExtendedQueryClient = QueryClient & AuthExtension & TxExtension;

export class CosmosClient {
  private readonly cometClient: Comet38Client | undefined;
  private readonly queryClient: ExtendedQueryClient | undefined;
  private chainId: string | undefined;
  private readonly accountParser: AccountParser;
  private readonly pubkeyEncoder: (pubkey: Uint8Array) => Pubkey;

  public readonly registry: Registry;
  public readonly broadcastTimeoutMs: number | undefined;
  public readonly broadcastPollIntervalMs: number | undefined;

  private readonly signer: OfflineSigner;
  private readonly aminoTypes: AminoTypes;
  private readonly gasPrice: GasPrice | undefined;

  /**
   * Creates an instance by connecting to the given Tendermint RPC endpoint.
   *
   * For now this uses the Tendermint 0.34 client. If you need Tendermint 0.37
   * support, see `createWithSigner`.
   */
  public static async connectWithSigner(
    endpoint: string,
    signer: OfflineSigner,
    options: CosmosClientOptions = {}
  ): Promise<CosmosClient> {
    const tmClient = await Comet38Client.connect(endpoint);
    return CosmosClient.createWithSigner(tmClient, signer, options);
  }

  /**
   * Creates an instance from a manually created Tendermint client.
   * Use this to use `Tendermint37Client` instead of `Comet38Client`.
   */
  public static createWithSigner(
    cmClient: Comet38Client,
    signer: OfflineSigner,
    options: CosmosClientOptions = {}
  ): CosmosClient {
    return new CosmosClient(cmClient, signer, options);
  }

  /**
   * Creates a client in offline mode.
   *
   * This should only be used in niche cases where you know exactly what you're doing,
   * e.g. when building an offline signing application.
   *
   * When you try to use online functionality with such a signer, an
   * exception will be raised.
   */
  public static offline(
    signer: OfflineSigner,
    options: CosmosClientOptions = {}
  ): CosmosClient {
    return new CosmosClient(undefined, signer, options);
  }

  protected constructor(
    cmClient: Comet38Client | undefined,
    signer: OfflineSigner,
    options: CosmosClientOptions
  ) {
    if (cmClient) {
      this.cometClient = cmClient;
      this.queryClient = QueryClient.withExtensions(
        cmClient,
        setupAuthExtension,
        setupTxExtension
      );
    }
    const {
      accountParser = accountFromAny,
      pubkeyEncoder = encodeSecp256k1Pubkey,
    } = options;
    this.accountParser = accountParser;
    this.pubkeyEncoder = pubkeyEncoder;

    const {
      registry = new Registry(defaultRegistryTypes),
      aminoTypes = new AminoTypes(createDefaultAminoConverters()),
    } = options;
    this.registry = registry;
    this.aminoTypes = aminoTypes;
    this.signer = signer;
    this.broadcastTimeoutMs = options.broadcastTimeoutMs;
    this.broadcastPollIntervalMs = options.broadcastPollIntervalMs;
    this.gasPrice = options.gasPrice;
  }

  public async simulate(
    signerAddress: string,
    messages: readonly EncodeObject[],
    memo: string | undefined
  ): Promise<number> {
    const anyMsgs = messages.map((m) => this.registry.encodeAsAny(m));

    const accountFromSigner = (await this.signer.getAccounts()).find(
      (account) => account.address === signerAddress
    );
    if (!accountFromSigner) {
      throw new Error("Failed to retrieve account from signer");
    }
    const pubkey = this.pubkeyEncoder(accountFromSigner.pubkey);
    const { sequence } = await this.getSequence(signerAddress);
    const { gasInfo } = await this.forceGetQueryClient().tx.simulate(
      anyMsgs,
      memo,
      pubkey,
      sequence
    );
    assertDefined(gasInfo);
    return Uint53.fromString(gasInfo.gasUsed.toString()).toNumber();
  }

  public async signAndBroadcast(
    signerAddress: string,
    messages: readonly EncodeObject[],
    fee: StdFee | "auto" | number,
    memo = ""
  ): Promise<DeliverTxResponse> {
    let usedFee: StdFee;
    if (fee == "auto" || typeof fee === "number") {
      assertDefined(
        this.gasPrice,
        "Gas price must be set in the client options when auto gas is used."
      );
      const gasEstimation = await this.simulate(signerAddress, messages, memo);
      const multiplier = typeof fee === "number" ? fee : 1.3;
      usedFee = calculateFee(
        Math.round(gasEstimation * multiplier),
        this.gasPrice
      );
    } else {
      usedFee = fee;
    }
    const txRaw = await this.sign(signerAddress, messages, usedFee, memo);
    const txBytes = TxRaw.encode(txRaw).finish();
    return this.broadcastTx(
      txBytes,
      this.broadcastTimeoutMs,
      this.broadcastPollIntervalMs
    );
  }

  /**
   * Gets account number and sequence from the API, creates a sign doc,
   * creates a single signature and assembles the signed transaction.
   *
   * The sign mode (SIGN_MODE_DIRECT or SIGN_MODE_LEGACY_AMINO_JSON) is determined by this client's signer.
   *
   * You can pass signer data (account number, sequence and chain ID) explicitly instead of querying them
   * from the chain. This is needed when signing for a multisig account, but it also allows for offline signing
   * (See the CosmosClient.offline constructor).
   */
  public async sign(
    signerAddress: string,
    messages: readonly EncodeObject[],
    fee: StdFee,
    memo: string,
    explicitSignerData?: SignerData
  ): Promise<TxRaw> {
    let signerData: SignerData;
    if (explicitSignerData) {
      signerData = explicitSignerData;
    } else {
      const { accountNumber, sequence } = await this.getSequence(signerAddress);
      const chainId = await this.getChainId();
      signerData = {
        accountNumber: accountNumber,
        sequence: sequence,
        chainId: chainId,
      };
    }

    return isOfflineDirectSigner(this.signer)
      ? this.signDirect(signerAddress, messages, fee, memo, signerData)
      : this.signAmino(signerAddress, messages, fee, memo, signerData);
  }

  private async signAmino(
    signerAddress: string,
    messages: readonly EncodeObject[],
    fee: StdFee,
    memo: string,
    { accountNumber, sequence, chainId }: SignerData
  ): Promise<TxRaw> {
    assert(!isOfflineDirectSigner(this.signer));
    const accountFromSigner = (await this.signer.getAccounts()).find(
      (account) => account.address === signerAddress
    );
    if (!accountFromSigner) {
      throw new Error("Failed to retrieve account from signer");
    }
    const signMode = SignMode.SIGN_MODE_LEGACY_AMINO_JSON;
    const msgs = messages.map((msg) => this.aminoTypes.toAmino(msg));
    const signDoc = makeSignDocAmino(
      msgs,
      fee,
      chainId,
      memo,
      accountNumber,
      sequence
    );
    const { signature, signed } = await this.signer.signAmino(
      signerAddress,
      signDoc
    );
    const signedTxBody = {
      messages: signed.msgs.map((msg) => this.aminoTypes.fromAmino(msg)),
      memo: signed.memo,
    };
    const signedTxBodyEncodeObject: TxBodyEncodeObject = {
      typeUrl: "/cosmos.tx.v1beta1.TxBody",
      value: signedTxBody,
    };
    const signedTxBodyBytes = this.registry.encode(signedTxBodyEncodeObject);
    const signedGasLimit = Int53.fromString(signed.fee.gas).toNumber();
    const signedSequence = Int53.fromString(signed.sequence).toNumber();
    const signedPubkey = encodePubkey(signature.pub_key);
    const signedAuthInfoBytes = makeAuthInfoBytes(
      [{ pubkey: signedPubkey, sequence: signedSequence }],
      signed.fee.amount,
      signedGasLimit,
      signed.fee.granter,
      signed.fee.payer,
      signMode
    );
    return TxRaw.fromPartial({
      bodyBytes: signedTxBodyBytes,
      authInfoBytes: signedAuthInfoBytes,
      signatures: [fromBase64(signature.signature)],
    });
  }

  private async signDirect(
    signerAddress: string,
    messages: readonly EncodeObject[],
    fee: StdFee,
    memo: string,
    { accountNumber, sequence, chainId }: SignerData
  ): Promise<TxRaw> {
    assert(isOfflineDirectSigner(this.signer));
    const accountFromSigner = (await this.signer.getAccounts()).find(
      (account) => account.address === signerAddress
    );
    if (!accountFromSigner) {
      throw new Error("Failed to retrieve account from signer");
    }
    const pubkey = encodePubkey(this.pubkeyEncoder(accountFromSigner.pubkey));
    const txBodyEncodeObject: TxBodyEncodeObject = {
      typeUrl: "/cosmos.tx.v1beta1.TxBody",
      value: {
        messages: messages,
        memo: memo,
      },
    };
    const txBodyBytes = this.registry.encode(txBodyEncodeObject);
    const gasLimit = Int53.fromString(fee.gas).toNumber();
    const authInfoBytes = makeAuthInfoBytes(
      [{ pubkey, sequence }],
      fee.amount,
      gasLimit,
      fee.granter,
      fee.payer
    );
    const signDoc = makeSignDoc(
      txBodyBytes,
      authInfoBytes,
      chainId,
      accountNumber
    );
    const { signature, signed } = await this.signer.signDirect(
      signerAddress,
      signDoc
    );
    return TxRaw.fromPartial({
      bodyBytes: signed.bodyBytes,
      authInfoBytes: signed.authInfoBytes,
      signatures: [fromBase64(signature.signature)],
    });
  }

  /**
   * Broadcasts a signed transaction to the network and monitors its inclusion in a block.
   *
   * If broadcasting is rejected by the node for some reason (e.g. because of a CheckTx failure),
   * an error is thrown.
   *
   * If the transaction is not included in a block before the provided timeout, this errors with a `TimeoutError`.
   *
   * If the transaction is included in a block, a `DeliverTxResponse` is returned. The caller then
   * usually needs to check for execution success or failure.
   */
  public async broadcastTx(
    tx: Uint8Array,
    timeoutMs = 60_000,
    pollIntervalMs = 3_000
  ): Promise<DeliverTxResponse> {
    let timedOut = false;
    const txPollTimeout = setTimeout(() => {
      timedOut = true;
    }, timeoutMs);

    const pollForTx = async (txId: string): Promise<DeliverTxResponse> => {
      if (timedOut) {
        throw new TimeoutError(
          `Transaction with ID ${txId} was submitted but was not yet found on the chain. You might want to check later. There was a wait of ${
            timeoutMs / 1000
          } seconds.`,
          txId
        );
      }
      await sleep(pollIntervalMs);
      const result = await this.getTx(txId);
      return result
        ? {
            code: result.code,
            height: result.height,
            txIndex: result.txIndex,
            events: result.events,
            rawLog: result.rawLog,
            transactionHash: txId,
            msgResponses: result.msgResponses,
            gasUsed: result.gasUsed,
            gasWanted: result.gasWanted,
          }
        : pollForTx(txId);
    };

    const transactionId = await this.broadcastTxSync(tx);

    return new Promise((resolve, reject) =>
      pollForTx(transactionId).then(
        (value) => {
          clearTimeout(txPollTimeout);
          resolve(value);
        },
        (error) => {
          clearTimeout(txPollTimeout);
          reject(error);
        }
      )
    );
  }

  /**
   * Broadcasts a signed transaction to the network without monitoring it.
   *
   * If broadcasting is rejected by the node for some reason (e.g. because of a CheckTx failure),
   * an error is thrown.
   *
   * If the transaction is broadcasted, a `string` containing the hash of the transaction is returned. The caller then
   * usually needs to check if the transaction was included in a block and was successful.
   *
   * @returns Returns the hash of the transaction
   */
  public async broadcastTxSync(tx: Uint8Array): Promise<string> {
    const broadcasted = await this.forceGetCometClient().broadcastTxSync({
      tx,
    });

    if (broadcasted.code) {
      return Promise.reject(
        new BroadcastTxError(
          broadcasted.code,
          broadcasted.codespace ?? "",
          broadcasted.log
        )
      );
    }

    const transactionId = toHex(broadcasted.hash).toUpperCase();

    return transactionId;
  }

  public async getChainId(): Promise<string> {
    if (!this.chainId) {
      const response = await this.forceGetCometClient().status();
      const chainId = response.nodeInfo.network;
      if (!chainId) throw new Error("Chain ID must not be empty");
      this.chainId = chainId;
    }

    return this.chainId;
  }

  public async getHeight(): Promise<number> {
    const status = await this.forceGetCometClient().status();
    return status.syncInfo.latestBlockHeight;
  }

  public async getAccount(searchAddress: string): Promise<Account | null> {
    try {
      const account =
        await this.forceGetQueryClient().auth.account(searchAddress);
      return account ? this.accountParser(account) : null;
    } catch (error: any) {
      if (/rpc error: code = NotFound/i.test(error.toString())) {
        return null;
      }
      throw error;
    }
  }

  public async getSequence(address: string): Promise<SequenceResponse> {
    const account = await this.getAccount(address);
    if (!account) {
      throw new Error(
        `Account '${address}' does not exist on chain. Send some tokens there before trying to query sequence.`
      );
    }
    return {
      accountNumber: account.accountNumber,
      sequence: account.sequence,
    };
  }

  public async getTx(id: string): Promise<IndexedTx | null> {
    const results = await this.txsQuery(`tx.hash='${id}'`);
    return results[0] ?? null;
  }

  private async txsQuery(query: string): Promise<IndexedTx[]> {
    const results = await this.forceGetCometClient().txSearchAll({
      query: query,
    });
    return results.txs.map((tx): IndexedTx => {
      const txMsgData = TxMsgData.decode(tx.result.data ?? new Uint8Array());
      return {
        height: tx.height,
        txIndex: tx.index,
        hash: toHex(tx.hash).toUpperCase(),
        code: tx.result.code,
        events: tx.result.events,
        rawLog: tx.result.log || "",
        tx: tx.tx,
        msgResponses: txMsgData.msgResponses,
        gasUsed: tx.result.gasUsed,
        gasWanted: tx.result.gasWanted,
      };
    });
  }

  protected forceGetQueryClient(): ExtendedQueryClient {
    if (!this.queryClient) {
      throw new Error(
        "Query client not available. You cannot use online functionality in offline mode."
      );
    }
    return this.queryClient;
  }

  protected forceGetCometClient(): Comet38Client {
    if (!this.cometClient) {
      throw new Error(
        "Comet client not available. You cannot use online functionality in offline mode."
      );
    }
    return this.cometClient;
  }
}
