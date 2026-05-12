'use client'

import { useTheme } from 'next-themes'
import { Icon } from '@/components/icons'
import { ThemeButton } from '@/components/theme-button'

export const ThemeSwitchButton = () => {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <ThemeButton
      variant="circleSmallOutline"
      onClick={() => {
        setTheme(isDark ? 'light' : 'dark')
      }}
      suppressHydrationWarning
    >
      <span suppressHydrationWarning>{isDark ? <Icon name="dark-mode" /> : <Icon name="light-mode" />}</span>
    </ThemeButton>
  )
}
