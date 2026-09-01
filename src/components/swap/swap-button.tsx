import { useState } from 'react'
import { Chain, EVMChain } from '@tcswap/core'
import { QuoteResponseRoute } from '@tcswap/helpers/api'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { AnimatedButton } from '@/components/animated-button'
import { chainLabel } from '@/components/connect-wallet/config'
import { ConnectWallet } from '@/components/connect-wallet/connect-wallet'
import { useDialog } from '@/components/global-dialog'
import { InstantSwapDialog } from '@/components/swap/instant-swap-dialog'
import { SwapDialog } from '@/components/swap/swap-dialog'
import { useBalance } from '@/hooks/use-balance'
import { useIsMemolessHalted, useMimir } from '@/hooks/use-mimir'
import { useQuote } from '@/hooks/use-quote'
import { useSimulation } from '@/hooks/use-simulation'
import { useAssetFrom, useAssetTo, useSwap } from '@/hooks/use-swap'
import { useExternalWalletMode, useSelectedAccount, useSetExternalWalletMode } from '@/hooks/use-wallets'
import { readableError } from '@/lib/errors'
import { isMayaProvider, isTaprootAddress, waitForAllowance } from '@/lib/swap-helpers'
import { getUSwap } from '@/lib/wallets'
import { useIsLimitSwap, useLimitSwapBuyAmount } from '@/store/limit-swap-store'

interface SwapButtonProps {
  instantSwapSupported: boolean
  instantSwapAvailable: boolean
}

interface ButtonState {
  text: string
  spinner: boolean
  accent: boolean
  onClick?: () => void
}

export const SwapButton = ({ instantSwapSupported, instantSwapAvailable }: SwapButtonProps) => {
  const t = useTranslations('swap')
  const tWallet = useTranslations('wallet')
  const assetFrom = useAssetFrom()
  const assetTo = useAssetTo()
  const uSwap = getUSwap()
  const selectedAccount = useSelectedAccount()
  const isLimitSwap = useIsLimitSwap()
  const limitSwapBuyAmount = useLimitSwapBuyAmount()
  const externalWalletMode = useExternalWalletMode()
  const isMemolessHalted = useIsMemolessHalted()
  const setExternalWalletMode = useSetExternalWalletMode()
  const { valueFrom } = useSwap()
  const { quote, isLoading: isQuoting, refetch: refetchQuote } = useQuote()
  const { isLoading: isSimulating, approveData } = useSimulation()
  const { balance, isLoading: isBalanceLoading } = useBalance()
  const { mimir } = useMimir()
  const isMayaChain = isMayaProvider(quote?.providers[0])
  const isLimitSwapDisabled = mimir['ENABLEADVSWAPQUEUE'] === 2 || isMayaChain

  const [isApproving, setIsApproving] = useState(false)

  const { openDialog } = useDialog()

  const onSwap = (quote: QuoteResponseRoute) => {
    openDialog(SwapDialog, { provider: quote.providers[0] })
  }

  const onInstantSwap = (quote: QuoteResponseRoute) => {
    openDialog(InstantSwapDialog, { provider: quote.providers[0] })
  }

  const onApprove = async () => {
    if (!approveData || !selectedAccount) return

    const wallet = uSwap.getWallet<EVMChain>(selectedAccount.provider, selectedAccount.network as EVMChain)
    if (!wallet) return

    const { contract, spender, amount } = approveData
    const from = selectedAccount.address
    const target = { assetAddress: contract, spenderAddress: spender }

    setIsApproving(true)

    const toastId = toast.loading(t('toast.approvalTransaction'))

    try {
      // USDT and other non-standard ERC-20s revert on approve() while a leftover non-zero allowance
      // is still set, so it has to be cleared - and mined - before the new allowance can be signed.
      const allowance = await wallet.approvedAmount({ ...target, from }).catch(() => 0n)

      if (allowance > 0n) {
        toast.loading(t('toast.resettingApproval'), { id: toastId })
        // '0' as a string on purpose: the SDK falls back to an unlimited approval for a falsy amount.
        await wallet.approve({ ...target, amount: '0' })
        const cleared = await waitForAllowance(async () => (await wallet.approvedAmount({ ...target, from })) === 0n)
        if (!cleared) throw new Error(t('toast.approvalNotConfirmed'))
        toast.loading(t('toast.approvalTransaction'), { id: toastId })
      }

      await wallet.approve({ ...target, amount })
      const approved = await waitForAllowance(() => wallet.isApproved({ ...target, from, amount }))
      if (!approved) throw new Error(t('toast.approvalNotConfirmed'))

      toast.success(t('toast.success'), { id: toastId })
    } catch (err) {
      toast.error(readableError(err, t('toast.errorSubmitting')), { id: toastId })
    } finally {
      setIsApproving(false)
      refetchQuote()
    }
  }

  const getState = (): ButtonState => {
    if (isLimitSwap && isLimitSwapDisabled) {
      return { text: isMayaChain ? t('button.limitNotSupported') : t('button.temporarilyUnavailable'), spinner: false, accent: false }
    }

    if (!assetFrom || !assetTo) return { text: '', spinner: true, accent: false }

    if (valueFrom.eqValue(0)) return { text: t('button.enterAmount'), spinner: false, accent: false }

    if (isQuoting || isSimulating) return { text: t('button.quoting'), spinner: true, accent: false }

    // A halt is called out by the banner under the button, so every no-quote case reads the same here.
    if (!quote) return { text: t('button.noValidQuotes'), spinner: false, accent: false }

    if (isLimitSwap && limitSwapBuyAmount === '0') {
      return { text: t('button.enterLimitPrice'), spinner: false, accent: false }
    }

    if (!selectedAccount) {
      if (instantSwapSupported) {
        const label = isLimitSwap ? t('button.enterLimitOrder') : t('button.swap')
        if (!instantSwapAvailable) {
          return { text: label, spinner: false, accent: false }
        }

        return { text: label, spinner: false, accent: true, onClick: () => onInstantSwap(quote) }
      } else {
        return {
          text: t('button.connectWallet', { chain: chainLabel(assetFrom.chain) }),
          spinner: false,
          accent: false,
          onClick: () => {
            if (externalWalletMode) {
              if (!isMemolessHalted) toast.warning(tWallet('externalWalletAssetUnsupported'))
              setExternalWalletMode(false)
            }
            openDialog(ConnectWallet, { chain: assetFrom.chain })
          }
        }
      }
    }

    if (isMayaChain && selectedAccount.network === Chain.Bitcoin && isTaprootAddress(selectedAccount.address)) {
      return { text: t('button.taprootNotSupported'), spinner: false, accent: false }
    }

    if (isBalanceLoading || !balance || balance.spendable.lt(valueFrom)) {
      return {
        text: t('button.insufficientBalance'),
        spinner: false,
        accent: false
      }
    }

    if (approveData) {
      return {
        text: t('button.approve', { ticker: assetFrom.ticker }),
        spinner: isApproving,
        accent: false,
        onClick: isApproving ? undefined : onApprove
      }
    }

    return {
      text: isLimitSwap ? t('button.enterLimitOrder') : t('button.swap'),
      spinner: false,
      accent: true,
      onClick: () => onSwap(quote)
    }
  }

  const state = getState()

  return (
    <AnimatedButton
      aria-label={state.text || t('button.enterAmount')}
      colorType={state.accent ? 'accent' : 'default'}
      className="w-full"
      onClick={state.onClick}
      disabled={!state.onClick}
      loading={state.spinner}
    >
      {state.text}
    </AnimatedButton>
  )
}
