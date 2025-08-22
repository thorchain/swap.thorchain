import cashaddr from "cashaddrjs";
import { address, networks, payments, Psbt } from "bitcoinjs-lib";
import { Buffer } from "buffer";
import { Network } from "../../network";

// Byte sizes for fee calculations
const INPUT_BYTES = 148n;
const OUTPUT_BYTES = 34n;
const OP_RETURN_BASE_BYTES = 10n; // Base bytes for an OP_RETURN output (excluding data)
const DEFAULT_SATS_PER_BYTE = 1n;

export interface Utxo {
  index: number;
  hash: string;
  value: bigint;
}

const cashAddressToLockingBytecode = (address: string): Uint8Array => {
  const { type, hash } = cashaddr.decode(`bitcoincash:${address}`);

  if (type === "P2PKH") {
    // P2PKH: OP_DUP OP_HASH160 <20-byte hash> OP_EQUALVERIFY OP_CHECKSIG
    // 0x76 0xa9 0x14 <hash> 0x88 0xac
    return new Uint8Array([
      0x76, 0xa9, 0x14,
      ...hash,
      0x88, 0xac
    ]);
  } else if (type === "P2SH") {
    // P2SH: OP_HASH160 <20-byte hash> OP_EQUAL
    // 0xa9 0x14 <hash> 0x87
    return new Uint8Array([
      0xa9, 0x14,
      ...hash,
      0x87
    ]);
  } else {
    throw new Error(`Unsupported address type: ${type}`);
  }
};

const toOutputScript = (account: { address: string; network: Network }) => {
  switch (account.network) {
    case Network.Bitcoin:
      return address.toOutputScript(account.address, networks.bitcoin);
    case Network.BitcoinCash:
      return cashAddressToLockingBytecode(account.address);
    case Network.Dogecoin:
      return address.toOutputScript(account.address, {
        messagePrefix: "\x19Dogecoin Signed Message:\n",
        bech32: "",
        bip32: { public: 0x02facafd, private: 0x02fac398 },
        pubKeyHash: 0x1e,
        scriptHash: 0x16,
        wif: 0x9e,
      });
    case Network.Litecoin:
      return address.toOutputScript(account.address, {
        messagePrefix: "\x19Litecoin Signed Message:\n",
        bech32: "ltc",
        bip32: {
          public: 0x019da462,
          private: 0x019d9cfe,
        },
        pubKeyHash: 0x30,
        scriptHash: 0x32,
        wif: 0xb0,
      });

    default:
      throw new Error(`toOutputScript not supported for ${account.network}`);
  }
};

export class PsbtFactory {
  public async buildPbst(
    account: { address: string; network: Network },
    utxos: Utxo[],
    amount: bigint,
    recipient: string,
    satsperbyte: bigint = DEFAULT_SATS_PER_BYTE,
    memo?: string
  ): Promise<{ psbt: Psbt; fee: bigint; amount: bigint }> {
    const psbt = new Psbt();
    const available = utxos.reduce((a, v) => a + v.value, 0n);
    const inputFee = BigInt(INPUT_BYTES) * satsperbyte;
    const outputFee = BigInt(OUTPUT_BYTES) * satsperbyte;

    // Calculate OP_RETURN output fee if memo exists
    let memoFee = 0n;
    const memoBuffer = memo ? Buffer.from(memo, "utf8") : null;
    const memoScript =
      memoBuffer && payments.embed({ data: [memoBuffer] }).output;

    if (memoScript) {
      // Calculate the OP_RETURN fee based on base size plus memo length
      const memoBytes = OP_RETURN_BASE_BYTES + BigInt(memoBuffer.length);
      memoFee = memoBytes * satsperbyte;
      psbt.addOutput({ value: 0n, script: memoScript });
    }

    // The fee that's required if we're sending everything (ie no need for a `change` output)
    const fullFee = BigInt(utxos.length) * inputFee + memoFee + outputFee;
    // If we can't even pay for the fee, error
    if (available <= fullFee) throw new Error("Insufficient Funds for fee");
    // Otherwise, the fee out of the send amount if there isn't enough remaining
    if (available <= amount + fullFee) {
      psbt.addInputs(
        utxos.map((x) => ({
          index: x.index,
          hash: x.hash,
          witnessUtxo: {
            script: toOutputScript(account),
            value: x.value,
          },
        }))
      );
      psbt.addOutput({
        script: toOutputScript({
          address: recipient,
          network: account.network,
        }),
        value: available - fullFee,
      });

      return { psbt, fee: fullFee, amount: available - fullFee };
    } else {
      // We have more than we need, we'll need a change output
      let fee = outputFee * 2n + memoFee;

      let totalInput = 0n;
      for (const utxo of utxos) {
        psbt.addInput({
          index: utxo.index,
          hash: utxo.hash,
          witnessUtxo: {
            script: toOutputScript(account),
            value: utxo.value,
          },
        });
        totalInput += utxo.value;
        fee += inputFee;
        if (totalInput >= amount + fee) break;
      }

      psbt.addOutputs([
        {
          value: amount,
          script: toOutputScript({
            address: recipient,
            network: account.network,
          }),
        },
        { script: toOutputScript(account), value: totalInput - amount - fee },
      ]);

      return { psbt, fee, amount };
    }
  }
}
