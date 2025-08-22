import { createProtobufRpcClient, QueryClient } from "../../queryclient";
import { QueryClientImpl } from "../../types/thorchain/types/query";
import {
  QueryEip712TypedDataRequest,
  QueryEip712TypedDataResponse,
} from "../../types/thorchain/types/query_eip712";

export interface ThorchainExtension {
  readonly thorchain: {
    getEip712TypedData: (
      signBytes: Uint8Array
    ) => Promise<QueryEip712TypedDataResponse>;
  };
}

export function setupThorchainExtension(base: QueryClient): ThorchainExtension {
  const rpc = createProtobufRpcClient(base);
  const queryService = new QueryClientImpl(rpc);

  return {
    thorchain: {
      getEip712TypedData: async (signBytes: Uint8Array) => {
        const request: QueryEip712TypedDataRequest = {
          signBytes,
        };
        const response = await queryService.Eip712TypedData(request);
        return response;
      },
    },
  };
}
