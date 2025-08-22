import { Asset } from "../asset";
import { MsgDeposit } from "./deposit";
import { Msg } from "./msg";

export class MsgSwap extends MsgDeposit implements Msg {
  constructor(
    asset: Asset,
    amount: bigint,
    /** As retrieved from a ThorchainQuote response */
    private memo: string
  ) {
    super(asset, amount);
  }

  toMemo(): string {
    return this.memo;
  }
}
