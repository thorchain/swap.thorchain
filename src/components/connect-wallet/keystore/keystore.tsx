'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { WalletParams } from '@/components/connect-wallet/config'
import { CreateWallet } from '@/components/connect-wallet/keystore/create-wallet'
import { ImportKeystore } from '@/components/connect-wallet/keystore/import-keystore'
import { ImportPhrase } from '@/components/connect-wallet/keystore/import-phrase'
import { GenericButton } from '@/components/generic-button'

export const Keystore = ({ onConnect }: { wallet: WalletParams; onConnect: () => void }) => {
  const t = useTranslations('wallet')
  const [walletType, setWalletType] = useState<'create' | 'import_keystore' | 'import_phrase' | null>(null)

  const onBack = () => setWalletType(null)

  if (walletType === 'create') {
    return <CreateWallet onBack={onBack} onConnect={onConnect} />
  }

  if (walletType === 'import_keystore') {
    return <ImportKeystore onBack={onBack} onConnect={onConnect} />
  }

  if (walletType === 'import_phrase') {
    return <ImportPhrase onBack={onBack} onConnect={onConnect} />
  }

  return (
    <div className="mb-8 flex flex-1 flex-col items-center justify-center gap-3 px-8 md:mb-0 md:px-16">
      <GenericButton colorType="3" size="large" className="w-full" onClick={() => setWalletType('import_keystore')}>
        {t('openKeystore')}
      </GenericButton>
      <GenericButton size="large" className="w-full" onClick={() => setWalletType('create')}>
        {t('createNewWallet')}
      </GenericButton>
      <GenericButton size="large" className="w-full" onClick={() => setWalletType('import_phrase')}>
        {t('importSeedPhrase')}
      </GenericButton>
    </div>
  )
}
