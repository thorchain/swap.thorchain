'use client'

import { create } from 'zustand'
import { WalletConnectDialog } from '@/components/wallet-connect/wallet-connect-dialog'

const dialogs = {
  'connect-wallet': WalletConnectDialog
}

type DialogName = keyof typeof dialogs

interface DialogStore {
  isOpen: boolean
  dialogName: DialogName | null
  dialogProps?: any
  openDialog: (name: DialogName, props?: any) => void
  closeDialog: () => void
}

export const useDialog = create<DialogStore>(set => ({
  isOpen: false,
  dialogName: null,
  dialogProps: {},
  openDialog: (name, props = {}) => {
    set({ isOpen: true, dialogName: name, dialogProps: props })
  },
  closeDialog: () => {
    set({ isOpen: false, dialogName: null, dialogProps: {} })
  }
}))

export const GlobalDialog = () => {
  const { isOpen, dialogName, dialogProps, closeDialog } = useDialog()

  if (!isOpen || !dialogName) {
    return null
  }

  const DialogComponent = dialogs[dialogName]

  if (!DialogComponent) {
    return null
  }

  return <DialogComponent open={isOpen} onOpenChange={closeDialog} {...dialogProps} />
}
