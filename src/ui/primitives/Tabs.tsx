// src/ui/primitives/Tabs.tsx
// Page tabs using Radix Tabs for accessible focus management.

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'

type TabsProps = React.ComponentPropsWithRef<typeof TabsPrimitive.Root> & {
  className?: string
  onValueChange?: (value: string) => void
}
type TabsListProps = React.ComponentPropsWithRef<typeof TabsPrimitive.List> & {
  className?: string
}
type TabsTriggerProps = React.ComponentPropsWithRef<typeof TabsPrimitive.Trigger> & {
  className?: string
  children?: React.ReactNode
}
type TabsContentProps = React.ComponentPropsWithRef<typeof TabsPrimitive.Content> & {
  className?: string
  children?: React.ReactNode
}

export function Tabs({ className, ...props }: TabsProps): React.ReactElement {
  return <TabsPrimitive.Root className={className} {...props} />
}

export function TabsList({ className, ...props }: TabsListProps): React.ReactElement {
  return (
    <TabsPrimitive.List
      className={className}
      style={{
        display: 'flex',
        borderBottom: `1px solid var(--quil-line)`,
        gap: 'var(--quil-space-1)',
        paddingBottom: 'var(--quil-space-1)',
      } as React.CSSProperties}
      {...props}
    />
  )
}

export function TabsTrigger({ className, children, ...props }: TabsTriggerProps): React.ReactElement {
  return (
    <TabsPrimitive.Trigger
      className={className}
      style={{
        padding: `var(--quil-space-2) var(--quil-space-3)`,
        borderRadius: 'var(--quil-radius-sm)',
        border: '0',
        background: 'transparent',
        color: 'var(--quil-text-70)',
        fontSize: 'var(--quil-text-sm)',
        fontWeight: 500,
        fontFamily: 'var(--quil-font-ui)',
        cursor: 'pointer',
        transition: 'color var(--quil-duration-press), background-color var(--quil-duration-press)',
      } as React.CSSProperties}
      {...props}
    >
      {children}
    </TabsPrimitive.Trigger>
  )
}

export function TabsContent({ className, children, ...props }: TabsContentProps): React.ReactElement {
  return (
    <TabsPrimitive.Content
      className={className}
      style={{
        paddingTop: 'var(--quil-space-3)',
      } as React.CSSProperties}
      {...props}
    >
      {children}
    </TabsPrimitive.Content>
  )
}
