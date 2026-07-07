'use client'

import { useTheme } from 'next-themes'
import { Icon } from '@/components/icons'
import { GenericButton } from '@/components/generic-button'

export const ThemeSwitchButton = () => {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <GenericButton
      size="medium"
      aria-label="Toggle theme"
      icon={
        // Both icons render and CSS picks one — a theme-dependent branch here would break hydration
        <>
          <Icon name="light-mode" className="dark:hidden" />
          <Icon name="dark-mode" className="hidden dark:block" />
        </>
      }
      onClick={() => {
        setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
      }}
    />
  )
}
