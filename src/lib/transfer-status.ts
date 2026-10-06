import { Chain, EVMChain, EVMChains, UTXOChain, UTXOChains } from '@tcswap/core'
import { getRPCUrl } from '@tcswap/helpers'
import { BLOCKCHAIR_CHAINS } from '@/lib/blockchair'
import { blockchairProxyUrl, getUSwap } from '@/lib/wallets'

// The aggregator's /track only follows swaps, so a plain wallet send is confirmed against its chain.
// 'pending' covers both "in the mempool" and "not seen yet".
export type TransferStatus = 'pending' | 'completed' | 'failed' | 'unsupported'

// Only the Cosmos chains this lookup was verified against; the others may have no RPC configured.
const TENDERMINT_CHAINS: Chain[] = [Chain.Cosmos, Chain.THORChain, Chain.Maya]

// The SDK's XRPL endpoint is a websocket; this is the same cluster's JSON-RPC.
const XRPL_RPC_URL = 'https://xrplcluster.com/'

// How long a send may go unseen before history gives up. Low-fee UTXO and EVM transactions can wait
// for days; elsewhere transactions expire quickly (Solana blockhash, Tron expiration, XRPL LastLedgerSequence).
const HOUR_MS = 60 * 60 * 1000

export const transferDropWindow = (chain: Chain) => {
  if (UTXOChains.includes(chain as UTXOChain)) return 72 * HOUR_MS
  if (EVMChains.includes(chain as EVMChain)) return 24 * HOUR_MS
  return HOUR_MS
}

const rpcBase = async (chain: Chain) => {
  const url = await getRPCUrl(chain)
  return url.endsWith('/') ? url.slice(0, -1) : url
}

const postJson = async (url: string, body: unknown) => {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`${url} answered ${res.status}`)
  return res.json()
}

async function evmStatus(chain: EVMChain, hash: string): Promise<TransferStatus> {
  const { result, error } = await postJson(await rpcBase(chain), { jsonrpc: '2.0', id: 1, method: 'eth_getTransactionReceipt', params: [hash] })
  if (error) throw new Error(error.message)
  if (!result) return 'pending'
  return result.status === '0x1' ? 'completed' : 'failed'
}

async function utxoStatus(slug: string, hash: string): Promise<TransferStatus> {
  const res = await fetch(`${blockchairProxyUrl()}/${slug}/dashboards/transaction/${encodeURIComponent(hash)}`)
  if (!res.ok) throw new Error(`Blockchair answered ${res.status}`)
  const { data } = await res.json()
  // Unknown hashes come back as an empty `data`; a mempool transaction has block_id -1.
  const blockId = data?.[hash]?.transaction?.block_id
  return typeof blockId === 'number' && blockId > 0 ? 'completed' : 'pending'
}

// Tendermint RPC: a hash the node has not indexed is an error whose data says "not found".
async function tendermintStatus(chain: Chain, hash: string): Promise<TransferStatus> {
  const rpc = await rpcBase(chain)
  const res = await fetch(`${rpc}/tx?hash=0x${hash.startsWith('0x') ? hash.slice(2) : hash}`)
  const { result, error } = await res.json()
  if (error) {
    if (String(error.data).includes('not found')) return 'pending'
    throw new Error(error.data ?? error.message)
  }
  if (!result?.tx_result) throw new Error(`${chain} RPC returned no result for ${hash}`)
  // Protobuf JSON may omit a zero-valued field, so a missing code is code 0: success.
  return (result.tx_result.code ?? 0) === 0 ? 'completed' : 'failed'
}

// An unconfirmed transaction is `{}`. A TRC-20 call carries its outcome in `receipt.result`; a plain
// TRX transfer has none, and only a failed one sets the top-level `result`.
async function tronStatus(hash: string): Promise<TransferStatus> {
  const info = await postJson(`${await rpcBase(Chain.Tron)}/wallet/gettransactioninfobyid`, { value: hash })
  if (!info?.blockNumber) return 'pending'
  if (info.result === 'FAILED') return 'failed'
  const receiptResult = info.receipt?.result
  return !receiptResult || receiptResult === 'SUCCESS' ? 'completed' : 'failed'
}

async function solanaStatus(hash: string): Promise<TransferStatus> {
  const { result, error } = await postJson(await rpcBase(Chain.Solana), {
    jsonrpc: '2.0',
    id: 1,
    method: 'getSignatureStatuses',
    params: [[hash], { searchTransactionHistory: true }]
  })
  if (error) throw new Error(error.message)
  const status = result?.value?.[0]
  if (!status) return 'pending'
  if (status.err) return 'failed'
  return status.confirmationStatus === 'finalized' || status.confirmationStatus === 'confirmed' ? 'completed' : 'pending'
}

// Only a validated ledger is final; any result other than tesSUCCESS (tec*) still burned the fee.
async function rippleStatus(hash: string): Promise<TransferStatus> {
  const { result } = await postJson(XRPL_RPC_URL, { method: 'tx', params: [{ transaction: hash }] })
  if (result?.error === 'txnNotFound') return 'pending'
  if (result?.error) throw new Error(result.error_message ?? result.error)
  if (!result?.validated) return 'pending'
  return result.meta?.TransactionResult === 'tesSUCCESS' ? 'completed' : 'failed'
}

const statusLookup = (chain: Chain): ((hash: string) => Promise<TransferStatus>) | undefined => {
  if (EVMChains.includes(chain as EVMChain)) return hash => evmStatus(chain as EVMChain, hash)
  const blockchairSlug = BLOCKCHAIR_CHAINS[chain as UTXOChain]
  if (blockchairSlug) return hash => utxoStatus(blockchairSlug, hash)
  if (TENDERMINT_CHAINS.includes(chain)) return hash => tendermintStatus(chain, hash)
  if (chain === Chain.Tron) return tronStatus
  if (chain === Chain.Solana) return solanaStatus
  if (chain === Chain.Ripple) return rippleStatus
  return undefined
}

export const canTrackTransfer = (chain: Chain) => !!statusLookup(chain)

export async function getTransferStatus(chain: Chain, hash: string): Promise<TransferStatus> {
  const lookup = statusLookup(chain)
  if (!lookup) return 'unsupported'
  // The SDK config is what points getRPCUrl at our Solana proxy rather than the public node.
  getUSwap()
  return lookup(hash)
}
