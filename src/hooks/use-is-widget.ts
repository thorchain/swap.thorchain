'use client'

import { usePathname } from 'next/navigation'

export const useIsWidget = () => usePathname().startsWith('/widget')
