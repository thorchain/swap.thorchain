import {
  isJsonRpcErrorResponse,
  JsonRpcRequest,
  JsonRpcSuccessResponse,
  parseJsonRpcResponse,
} from "@cosmjs/json-rpc";

import { hasProtocol, RpcClient } from "./rpcclient";

export function filterBadStatus(res: any): any {
  if (res.status >= 400) {
    throw new Error(`Bad status on response: ${res.status}`);
  }
  return res;
}

export interface HttpEndpoint {
  /**
   * The URL of the HTTP endpoint.
   *
   * For POST APIs like Tendermint RPC in CosmJS,
   * this is without the method specific paths (e.g. https://cosmoshub-4--rpc--full.datahub.figment.io/)
   */
  readonly url: string;
  /**
   * HTTP headers that are sent with every request, such as authorization information.
   */
  readonly headers: Record<string, string>;
}

export class HttpClient implements RpcClient {
  protected readonly url: string;
  protected readonly headers: Record<string, string> | undefined;

  public constructor(endpoint: string | HttpEndpoint) {
    if (typeof endpoint === "string") {
      if (!hasProtocol(endpoint)) {
        throw new Error(
          "Endpoint URL is missing a protocol. Expected 'https://' or 'http://'."
        );
      }
      this.url = endpoint;
    } else {
      this.url = endpoint.url;
      this.headers = endpoint.headers;
    }
  }

  public disconnect(): void {
    // nothing to be done
  }

  public async execute(
    request: JsonRpcRequest
  ): Promise<JsonRpcSuccessResponse> {
    const settings = {
      method: "POST",
      body: request ? JSON.stringify(request) : undefined,
      headers: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        "Content-Type": "application/json",
        ...this.headers,
      },
    };
    const json = await fetch(this.url, settings)
      .then(filterBadStatus)
      .then((res: any) => res.json());

    const response = parseJsonRpcResponse(json);
    if (isJsonRpcErrorResponse(response)) {
      throw new Error(JSON.stringify(response.error));
    }
    return response;
  }
}
