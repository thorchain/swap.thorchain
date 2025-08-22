import { Asset } from "../asset";
import { MsgDeposit } from "./deposit";
import { Msg } from "./msg";

export class MsgAddLiquidity extends MsgDeposit implements Msg {
  constructor(
    asset: Asset,
    amount: bigint,
    private pool: Asset,
    private address: string,
    private options?: {
      affiliate?: { id: string; bp: bigint };
    }
  ) {
    super(asset, amount);
  }

  toMemo(): string {
    const { affiliate } = this.options || {};
    const parts = [
      `+`,
      this.pool.asset,
      this.address,
      affiliate?.id || "",
      affiliate?.bp.toString() || "",
    ];
    return parts.join(":");
  }
}

export class MsgWithdrawLiquidity extends MsgDeposit implements Msg {
  constructor(
    asset: Asset,
    amount: bigint,
    private pool: Asset,
    private bps: bigint
  ) {
    super(asset, amount);
  }

  toMemo(): string {
    const parts = [`-`, this.pool.asset, this.bps];
    return parts.join(":");
  }
}
