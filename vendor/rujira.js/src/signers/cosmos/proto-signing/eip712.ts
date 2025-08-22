import { fromBech32, toBech32 } from "@cosmjs/encoding";
import { ecrecover, fromRPCSig } from "@ethereumjs/util";
import { Point } from "@noble/secp256k1";
import { Buffer } from "buffer";
import { Eip1193Provider } from "ethers";
import { hashTypedData } from "viem";
import {
  AminoSignResponse,
  OfflineAminoSigner,
  serializeSignDoc,
  StdSignDoc,
} from "../amino";
import { encodeEthSecp256k1Pubkey } from "../amino/encoding";
import {
  setupThorchainExtension,
  ThorchainExtension,
} from "../modules/thorchain/queries";
import { QueryClient } from "../queryclient";
import { Comet38Client } from "../rpc/comet38";
import { AccountData } from "./signer";

const dummy = Uint8Array.from([
  0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

// N.B Amino signer interface as the directSigner typedData construction code path in thornode 3.9.0 is broken
export class Eip712Signer implements OfflineAminoSigner {
  private queryClient: QueryClient & ThorchainExtension;
  constructor(
    private evmProvider: Eip1193Provider,
    private prefix: string,
    rpc: string
  ) {
    const cometClient = Comet38Client.connect(rpc);
    this.queryClient = QueryClient.withExtensions(
      cometClient,
      setupThorchainExtension
    );
  }
  async getAccounts(): Promise<readonly AccountData[]> {
    const authorizedAccounts: string[] = await this.evmProvider.request({
      method: "eth_accounts",
    });

    const accounts: string[] = authorizedAccounts.length
      ? authorizedAccounts
      : await this.evmProvider.request({ method: "eth_requestAccounts" });

    return accounts.map((address) => {
      return {
        address: toBech32(
          this.prefix,
          Buffer.from(address.replace(/^0x/, ""), "hex")
        ),
        algo: "secp256k1",
        // Dummy pubkey if we don't have one already
        pubkey: dummy,
      };
    });
  }
  async signAmino(
    signerAddress: string,
    signDoc: StdSignDoc
  ): Promise<AminoSignResponse> {
    const { typedData } = await this.queryClient.thorchain.getEip712TypedData(
      serializeSignDoc(signDoc)
    );
    const evmAddress =
      "0x" + Buffer.from(fromBech32(signerAddress).data).toString("hex");
    const request = {
      method: "eth_signTypedData_v4",
      params: [evmAddress, typedData],
    };
    const signature = await this.evmProvider.request(request);
    const hash = hashTypedData(JSON.parse(typedData));
    const sig = signature.slice(2);
    const { v, r, s } = fromRPCSig(signature);
    const recovered = ecrecover(Buffer.from(hash.slice(2), "hex"), v, r, s);
    const compressedPubkey = Point.fromHex(
      Uint8Array.from([0x04, ...recovered])
    ).toRawBytes(true);

    return {
      signed: signDoc,
      signature: {
        pub_key: encodeEthSecp256k1Pubkey(compressedPubkey),
        signature: Buffer.from(sig, "hex").toString("base64"),
      },
    };
  }
}
