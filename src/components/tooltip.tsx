import { ReactNode } from 'react'
import { Tooltip as BaseTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Icon } from '@/components/icons'

export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={150}>
      <BaseTooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          {content}
        </TooltipContent>
      </BaseTooltip>
    </TooltipProvider>
  )
}

export function InfoTooltip({ children }: { children: ReactNode }) {
  return (
    <Tooltip content={children}>
      <Icon name="info" className="text-thor-gray inline-block size-4 shrink-0" />
    </Tooltip>
  )
}
