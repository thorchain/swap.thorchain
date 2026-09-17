// The PRIVATE tab's state lives in the limit-swap store, next to the mode it is exclusive with,
// so each setter can clear the other. Re-exported here under the name the private-tab code uses.
export { useIsPrivateSwap, useSetIsPrivateSwap } from '@/store/limit-swap-store'
