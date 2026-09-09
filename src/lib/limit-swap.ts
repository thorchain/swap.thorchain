import { intervalToDuration } from 'date-fns'

// Matches SECONDS_PER_BLOCK in send-memo-helpers; kept local so this module stays dependency-free.
const SECONDS_PER_BLOCK = 6

export const BLOCKS_PER_MINUTE = 60 / SECONDS_PER_BLOCK
export const BLOCKS_PER_HOUR = BLOCKS_PER_MINUTE * 60
export const BLOCKS_PER_DAY = BLOCKS_PER_HOUR * 24
export const BLOCKS_PER_3_DAYS = BLOCKS_PER_DAY * 3

// How often an open order and a pending refund are re-read from THORNode.
export const ORDER_POLL_MS = 15_000

// THORChain expires a limit order at `initial_block_height + interval`, where the interval comes
// from the memo and is capped by the STREAMINGLIMITSWAPMAXAGE mimir. Three days is the chain
// default and the fallback when mimir has not loaded yet.
export const DEFAULT_LIMIT_SWAP_MAX_AGE = BLOCKS_PER_3_DAYS

const blocksToMs = (blocks: number) => (blocks / BLOCKS_PER_MINUTE) * 60 * 1000

export const blocksToDate = (blocks: number) => new Date(Date.now() + blocksToMs(blocks))

export const blocksToDuration = (blocks: number) => intervalToDuration({ start: 0, end: blocksToMs(blocks) })

export const formatBlockDuration = (blocks: number) => {
  const { days = 0, hours = 0, minutes = 0 } = blocksToDuration(blocks)
  return [days && `${days}d`, hours && `${hours}h`, minutes && `${minutes}m`].filter(Boolean).join(' ') || '0m'
}
