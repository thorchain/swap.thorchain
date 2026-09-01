// Resolving what someone typed into a recipient field as a THORName / MAYAName.
// The chain codes a name registers its aliases under ("BTC", "ETH", "GAIA", …)
// are the same strings as the `Chain` enum, so they compare directly.

export interface NameAlias {
  chain: string
  address: string
}

export interface NameRecord {
  name: string
  owner?: string
  aliases?: NameAlias[] | null
}

// THORNode and Mayanode both cap a name at 30 characters of [a-zA-Z0-9+_-], so
// anything longer, or with other characters, can only ever be an address.
const NAME_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789+_-'
const MAX_NAME_LENGTH = 30

/** Whether the input could be a registered name rather than an address. */
export const isNameLike = (value: string): boolean => {
  const name = value.trim().toLowerCase()
  return name.length > 0 && name.length <= MAX_NAME_LENGTH && [...name].every(char => NAME_CHARS.includes(char))
}

/**
 * The address a name points at on `chain`, if it registered one. A name with no
 * alias on its own chain falls back to its owner — the address that registered
 * it — which is what the THORName manager shows too.
 */
export const nameAddressForChain = (record: NameRecord | null | undefined, chain: string, nativeChain: string): string | undefined => {
  if (!record) return undefined

  const alias = (record.aliases ?? []).find(alias => alias.chain === chain)
  return alias?.address ?? (chain === nativeChain ? record.owner : undefined)
}
