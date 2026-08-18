export const WIDGET_MESSAGE_SOURCE = 'thorchain-widget'

export type WidgetTheme = 'light' | 'dark' | 'system'

export const parseWidgetTheme = (value: string | string[] | undefined): WidgetTheme | undefined =>
  value === 'light' || value === 'dark' || value === 'system' ? value : undefined

// Runs after next-themes' own inline script and before the first paint, so an embed on a dark
// site never flashes the light theme while React hydrates.
export const widgetThemeScript = (theme: WidgetTheme) => `(function(t){try{
var m=t==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t
var e=document.documentElement
e.classList.toggle('dark',m==='dark')
e.style.colorScheme=m
localStorage.setItem('theme',t)
}catch(e){}})(${JSON.stringify(theme)})`
