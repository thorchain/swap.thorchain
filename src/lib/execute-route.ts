import { AssetValue, Chain, FeeOption } from '@tcswap/core'
import { QuoteResponseRoute, SignableTx } from '@tcswap/helpers/api'
import { getUSwap } from '@/lib/wallets'
import { WalletAccount } from '@/store/wallets-store'

// Sends the funds of a committed route from a connected wallet and resolves with the inbound
// transaction's hash. The aggregator says how in the route's one `execution` block (API_V3.md,
// section 6), and exactly one of its three methods applies:
//   thorchain_deposit  - THORChain, Maya: a deposit to the vault with the memo bound to it, which the
//                        SDK's protocol plugin builds from the route's flat fields;
//   transfer           - NEAR, Houdini: an ordinary transfer to the order's deposit address;
//   signed_transaction - the DEXes and bridges: the server's transaction, signed and broadcast as it is.
export const executeRoute = async (route: QuoteResponseRoute, account: WalletAccount): Promise<string> => {
  const uSwap = getUSwap()
  const execution = route.execution

  if (!execution || execution.method === 'thorchain_deposit') {
    return uSwap.swap({ route, feeOptionKey: FeeOption.Fast })
  }

  if (execution.method === 'transfer') {
    if (!execution.depositAddress) throw new Error('The order has no deposit address')

    const assetValue = await AssetValue.from({ asset: route.sellAsset, value: execution.amount ?? route.sellAmount, asyncTokenLookup: true })
    const isStellar = assetValue.chain === Chain.Stellar
    const isTag = execution.attachment?.type === 'destination_tag'

    // A destination tag is a field of its own on the transaction. Stellar's toolbox has one (a memo
    // id); the others attach a memo as free text, which on XRP would arrive untagged and could not be
    // matched to the order.
    if (isTag && !isStellar) {
      throw new Error('This deposit needs a destination tag, which a connected wallet cannot attach here. Send it from an external wallet instead')
    }

    // `uSwap.transfer` picks whichever wallet connected the chain last; the deposit is the selected account's.
    const wallet = uSwap.getWallet(account.provider, assetValue.chain as Chain) as { transfer?: (params: unknown) => Promise<string> } | undefined
    if (!wallet?.transfer) throw new Error('Wallet not connected')

    return wallet.transfer({
      assetValue,
      recipient: execution.depositAddress,
      feeOptionKey: FeeOption.Fast,
      ...(execution.attachment && (isTag ? { memoId: execution.attachment.value } : { memo: execution.attachment.value }))
    })
  }

  // The array holds one transaction today; each is submitted in turn and the last hash is the swap's.
  let hash = ''
  for (const tx of execution.transactions ?? []) hash = await sendTransaction(route, tx, account)
  if (!hash) throw new Error('The route has no transaction to sign')

  return hash
}

// Switches on the transaction's `kind`, never on the chain: it is what says how to decode and sign.
const sendTransaction = async (route: QuoteResponseRoute, tx: SignableTx, account: WalletAccount): Promise<string> => {
  const uSwap = getUSwap()

  // The SDK's EVM and Solana plugins do exactly this with a route's `tx`: an EVM call sent from the
  // wallet (any allowance was granted before the swap was confirmed), a Solana message deserialized
  // as a VersionedTransaction, signed and broadcast. Naming the plugin skips its lookup by provider,
  // which only knows the providers the SDK shipped with.
  if (tx.kind === 'evm') {
    const evmTx = { from: tx.from, to: tx.to, data: tx.data, value: tx.value ?? '0x0' }
    return uSwap.swap({ route: { ...route, tx: evmTx }, pluginName: 'evm', feeOptionKey: FeeOption.Fast })
  }

  if (tx.kind === 'solana' && tx.message) {
    return uSwap.swap({ route: { ...route, tx: tx.message }, pluginName: 'solana' })
  }

  // A created-transaction envelope: sign its txID, then broadcast it to a full node.
  if (tx.kind === 'tron' && tx.tx) {
    const wallet = uSwap.getWallet(account.provider, Chain.Tron) as unknown as
      | {
          signTransaction: (tx: unknown) => Promise<unknown>
          tronWeb?: { trx?: { sendRawTransaction?: (tx: unknown) => Promise<TronBroadcast> } }
        }
      | undefined
    // Checked before anything is signed: the cast above is not something the compiler can vouch for.
    const trx = wallet?.tronWeb?.trx
    if (!wallet || !trx?.sendRawTransaction) throw new Error('Wallet not connected')

    const signed = await wallet.signTransaction(tx.tx)

    // A node that refuses a transaction does not fail the call: it answers `{ code, txid, message }`
    // with the id of the transaction it refused, and only `result: true` means it was accepted. The
    // toolbox's `broadcastTransaction` hands back the id alone, so the node is asked through the
    // toolbox's own TronWeb, which every Tron connector carries.
    const answer = await trx.sendRawTransaction(signed)
    const txid = answer.txid ?? answer.transaction?.txID
    if (answer.result !== true || !txid) {
      const reason = tronMessage(answer.message) || answer.code
      throw new Error(reason ? `${TRON_REJECTED} (${reason})` : TRON_REJECTED)
    }

    return txid
  }

  // A base64 transaction envelope, signed as it is.
  if (tx.kind === 'stellar' && tx.xdr) {
    const wallet = uSwap.getWallet(account.provider, Chain.Stellar) as { signAndBroadcastTransaction?: (xdr: string) => Promise<string> } | undefined
    if (!wallet?.signAndBroadcastTransaction) throw new Error('Wallet not connected')

    return wallet.signAndBroadcastTransaction(tx.xdr)
  }

  throw new Error(`Signing a ${tx.kind} transaction is not supported here yet`)
}

type TronBroadcast = { result?: boolean; txid?: string; transaction?: { txID?: string }; code?: string; message?: string }

const TRON_REJECTED = 'The Tron network rejected the transaction. Check your TRX balance for energy and bandwidth, then try again'

// A node's refusal reason arrives hex-encoded.
const tronMessage = (message?: string) => {
  if (!message) return ''
  const isHex = message.length % 2 === 0 && [...message].every(c => '0123456789abcdefABCDEF'.includes(c))
  if (!isHex) return message
  try {
    return new TextDecoder().decode(Uint8Array.from(message.match(/../g) ?? [], byte => parseInt(byte, 16)))
  } catch {
    return message
  }
}

// Whether a route's transaction can be signed by a wallet connected here, judged before a preview
// exists: a signed_transaction is built for its sell chain, and only these kinds have a signer.
// A token sold on Tron needs an allowance first, and the approve flow before the swap is EVM-only.
export const canSignOn = (chain: Chain, isEvm: boolean, needsApproval: boolean): boolean =>
  isEvm || chain === Chain.Solana || chain === Chain.Stellar || (chain === Chain.Tron && !needsApproval)
