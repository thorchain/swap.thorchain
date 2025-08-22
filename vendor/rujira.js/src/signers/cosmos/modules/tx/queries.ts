import { isMultisigThresholdPubkey, Pubkey } from "../../amino";
import { encodePubkey } from "../../proto-signing";
import { SignMode } from "../../types/cosmos/tx/signing/v1beta1/signing";
import {
  GetTxRequest,
  GetTxResponse,
  ServiceClientImpl,
  SimulateRequest,
  SimulateResponse,
} from "../../types/cosmos/tx/v1beta1/service";
import { AuthInfo, Fee, Tx, TxBody } from "../../types/cosmos/tx/v1beta1/tx";
import { Any } from "../../types/google/protobuf/any";

import { createProtobufRpcClient, QueryClient } from "../../queryclient";

export interface TxExtension {
  readonly tx: {
    getTx: (txId: string) => Promise<GetTxResponse>;
    simulate: (
      messages: readonly Any[],
      memo: string | undefined,
      signer: Pubkey,
      sequence: number
    ) => Promise<SimulateResponse>;
    // Add here with tests:
    // - broadcastTx
    // - getTxsEvent
  };
}

export function setupTxExtension(base: QueryClient): TxExtension {
  // Use this service to get easy typed access to query methods
  // This cannot be used for proof verification
  const rpc = createProtobufRpcClient(base);
  const queryService = new ServiceClientImpl(rpc);

  return {
    tx: {
      getTx: async (txId: string) => {
        const request: GetTxRequest = {
          hash: txId,
        };
        const response = await queryService.GetTx(request);
        return response;
      },
      simulate: async (
        messages: readonly Any[],
        memo: string | undefined,
        signer: Pubkey,
        sequence: number
      ) => {
        const publicKey = encodePubkey(signer);
        const info = {
          single: { mode: SignMode.SIGN_MODE_UNSPECIFIED },
        };
        const modeInfo = isMultisigThresholdPubkey(signer)
          ? { multi: { mode_infos: signer.value.pubkeys.map(() => info) } }
          : info;

        const tx = Tx.fromPartial({
          authInfo: AuthInfo.fromPartial({
            fee: Fee.fromPartial({}),
            signerInfos: [
              {
                publicKey,
                sequence: BigInt(sequence),
                modeInfo,
              },
            ],
          }),
          body: TxBody.fromPartial({
            messages: Array.from(messages),
            memo: memo,
          }),
          signatures: [new Uint8Array()],
        });
        const request = SimulateRequest.fromPartial({
          txBytes: Tx.encode(tx).finish(),
        });
        const response = await queryService.Simulate(request);
        return response;
      },
    },
  };
}
