import { Psbt } from "bitcoinjs-lib";
import { TransactionRequest } from "ethers";
import { InboundAddress } from "../accounts";
import { Asset } from "../asset";
import { IncorrectNetworkError } from "../errors";
import { Network } from "../network";
import { EncodeObject } from "../signers/cosmos/proto-signing";
import { MsgSend } from "../signers/cosmos/types/cosmos/bank/v1beta1/tx";
import { MsgDeposit } from "./deposit";
import { Msg } from "./msg";

export class MsgSecureDeposit extends MsgDeposit implements Msg {
  constructor(
    asset: Asset,
    amount: bigint,
    private targetAddress: string
  ) {
    super(asset, amount);
  }

  toMemo(): string {
    const parts = [`secure+`, this.targetAddress];
    return parts.join(":");
  }
}

export class MsgSecureWithdraw extends MsgDeposit implements Msg {
  constructor(
    asset: Asset,
    amount: bigint,
    private targetAddress: string
  ) {
    super(asset, amount);
  }
  toTransactionRequest(): Promise<{ tx: TransactionRequest }> {
    throw new Error("toTransactionRequest not supported");
  }
  toPsbt(): Promise<{
    psbt: Psbt;
    fee: bigint;
    amount: bigint;
    memo: string;
    recipient: string;
  }> {
    throw new Error("toPsbt not supported");
  }

  async toEncodeObject(
    account: {
      network: Network;
      address: string;
    },
    inboundAddress?: InboundAddress
  ): Promise<{ msg: EncodeObject; memo: string }> {
    if (account.network !== Network.Thorchain) {
      throw new IncorrectNetworkError(account.network, this.asset.chain);
    }
    if (this.asset.type !== "SECURED") {
      throw new Error("Only Secured Assets can be withdrawn");
    }
    return {
      msg: {
        typeUrl: MsgSend.typeUrl,
        value: {
          ...this.sendValue(account.address, inboundAddress),
          toAddress: inboundAddress?.address,
        },
      },
      memo: this.toMemo(),
    };
  }

  toMemo(): string {
    const parts = [`secure-`, this.targetAddress];
    return parts.join(":");
  }
}
