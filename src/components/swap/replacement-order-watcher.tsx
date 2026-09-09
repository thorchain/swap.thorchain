'use client'

import { useEffect } from 'react'
import { useDialog } from '@/components/global-dialog'
import { SwapDialog } from '@/components/swap/swap-dialog'
import { useWatchReplacementOrder } from '@/hooks/use-watch-replacement-order'
import { useMarkReplacementConsumed, useReplacementOrder, useSeedReplacementForm } from '@/store/replacement-order-store'

// Second half of a "change the expiration": the order has been cancelled, and as soon as its deposit
// is back this puts the replacement straight in front of the user - no card, no extra screen. It
// fires once; closing the confirm screen without placing drops the replacement for good.
export const ReplacementOrderWatcher = () => {
  const { openDialog } = useDialog()
  const replacement = useReplacementOrder()
  const markConsumed = useMarkReplacementConsumed()
  const seedForm = useSeedReplacementForm()

  useWatchReplacementOrder()

  useEffect(() => {
    // While the Modify dialog is open it places the replacement itself, in place.
    if (!replacement?.refunded || replacement.consumed || replacement.inDialog) return

    seedForm(replacement)
    markConsumed()
    openDialog(SwapDialog, { provider: replacement.provider })
  }, [replacement, markConsumed, openDialog, seedForm])

  return null
}
