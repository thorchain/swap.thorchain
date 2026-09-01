import { Chain } from '@tcswap/core'
import { useMayaName } from '@/hooks/thorname/use-mayaname'
import { useThorName } from '@/hooks/thorname/use-thorname'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { isNameLike, nameAddressForChain } from '@/lib/name-resolution'

interface ResolvedName {
  /** The address the name has registered for `chain`, once it is known. */
  address?: string
  /** A name is being looked up right now. */
  isResolving: boolean
}

/** Looks `input` up as a THORName / MAYAName and resolves it to an address on `chain`. */
export const useResolvedName = (input: string, chain: Chain): ResolvedName => {
  const candidate = isNameLike(input) ? input.trim().toLowerCase() : ''
  const name = useDebouncedValue(candidate, 500)
  // Ignore a debounced value the input has already moved on from.
  const names = name.length > 0 && name === candidate ? [name] : []

  const thor = useThorName(names)
  const maya = useMayaName(names)

  return {
    address: nameAddressForChain(thor.thorNames[0], chain, Chain.THORChain) ?? nameAddressForChain(maya.mayaNames[0], chain, Chain.Maya),
    isResolving: candidate.length > 0 && (name !== candidate || thor.isLoading || maya.isLoading)
  }
}
