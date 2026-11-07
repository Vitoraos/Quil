// src/routes/dev-ui.tsx
// Dev-only kitchen sink: every primitive in every state.
// Not shipped to production.

import * as React from 'react'
import {
  Button,
  IconButton,
  Card,
  SelectableCard,
  Input,
  Textarea,
  Segmented,
  Chip,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  StatusMessage,
  FeatherPen,
  PenLoader,
} from '../ui'

const PlusIcon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)
const TrashIcon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
)

export function DevUI(): React.ReactElement {
  const [radioValue, setRadioValue] = React.useState<'a' | 'b' | 'c' | null>(null)
  const [checkboxValues, setCheckboxValues] = React.useState<Set<string>>(new Set())
  const [_tabValue, setTabValue] = React.useState<string>('overview')
  const [loading, setLoading] = React.useState(false)

  return (
    <div style={{ padding: 'var(--quil-space-8)', maxWidth: 900 }}>
      <h1 style={{ fontSize: 'var(--quil-heading-1)', fontFamily: 'var(--quil-font-head)', color: 'var(--quil-text-100)', marginBottom: 'var(--quil-space-8)' }}>
        Dev UI — Kitchen Sink
      </h1>

      <section style={{ marginBottom: 'var(--quil-space-8)' }}>
        <h2 style={{ fontSize: 'var(--quil-heading-3)', fontFamily: 'var(--quil-font-head)', color: 'var(--quil-text-100)', marginBottom: 'var(--quil-space-4)' }}>
          Buttons
        </h2>
        <div style={{ display: 'flex', gap: 'var(--quil-space-3)', flexWrap: 'wrap' }}>
          <Button variant="primary">Primary</Button>
          <Button variant="primary" disabled>Primary disabled</Button>
          <Button variant="neutral">Neutral</Button>
          <Button variant="neutral" disabled>Neutral disabled</Button>
          <IconButton icon={<PlusIcon />} />
          <IconButton icon={<TrashIcon />} disabled />
        </div>
      </section>

      <section style={{ marginBottom: 'var(--quil-space-8)' }}>
        <h2 style={{ fontSize: 'var(--quil-heading-3)', fontFamily: 'var(--quil-font-head)', color: 'var(--quil-text-100)', marginBottom: 'var(--quil-space-4)' }}>
          Cards
        </h2>
        <div style={{ display: 'flex', gap: 'var(--quil-space-4)', flexWrap: 'wrap' }}>
          <Card padded style={{ width: 200 }}>
            <p style={{ color: 'var(--quil-text-70)', fontSize: 'var(--quil-text-sm)' }}>Default card</p>
          </Card>
          <Card padded style={{ width: 200, border: 'var(--quil-border-width) solid var(--quil-line)' }}>
            <p style={{ color: 'var(--quil-text-70)', fontSize: 'var(--quil-text-sm)' }}>Card with border</p>
          </Card>
        </div>
      </section>

      <section style={{ marginBottom: 'var(--quil-space-8)' }}>
        <h2 style={{ fontSize: 'var(--quil-heading-3)', fontFamily: 'var(--quil-font-head)', color: 'var(--quil-text-100)', marginBottom: 'var(--quil-space-4)' }}>
          Selectable cards
        </h2>
        <div style={{ display: 'flex', gap: 'var(--quil-space-3)', flexWrap: 'wrap' }}>
          <SelectableCard mode="radio" isSelected={radioValue === 'a'} onSelect={() => setRadioValue('a')} aria-checked={radioValue === 'a'}>
            Option A
          </SelectableCard>
          <SelectableCard mode="radio" isSelected={radioValue === 'b'} onSelect={() => setRadioValue('b')} aria-checked={radioValue === 'b'}>
            Option B
          </SelectableCard>
          <SelectableCard mode="radio" isDisabled aria-checked={false}>
            Disabled
          </SelectableCard>
          <SelectableCard mode="checkbox" isSelected={checkboxValues.has('x')} onSelect={() => setCheckboxValues(checkboxValues.has('x') ? new Set([...checkboxValues].filter((v) => v !== 'x')) : new Set([...checkboxValues, 'x']))} aria-checked={checkboxValues.has('x')}>
            Checked option
          </SelectableCard>
        </div>
      </section>

      <section style={{ marginBottom: 'var(--quil-space-8)' }}>
        <h2 style={{ fontSize: 'var(--quil-heading-3)', fontFamily: 'var(--quil-font-head)', color: 'var(--quil-text-100)', marginBottom: 'var(--quil-space-4)' }}>
          Inputs
        </h2>
        <div style={{ display: 'flex', gap: 'var(--quil-space-4)', flexWrap: 'wrap' }}>
          <Input placeholder="Email" />
          <Input placeholder="Disabled" disabled />
          <Input error="Invalid email address" placeholder="With error" />
          <Textarea placeholder="Notes..." rows={3} />
        </div>
      </section>

      <section style={{ marginBottom: 'var(--quil-space-8)' }}>
        <h2 style={{ fontSize: 'var(--quil-heading-3)', fontFamily: 'var(--quil-font-head)', color: 'var(--quil-text-100)', marginBottom: 'var(--quil-space-4)' }}>
          Segmented control
        </h2>
        <Segmented
          items={[
            { value: 'instance', label: 'Instance' },
            { value: 'page', label: 'Page' },
            { value: 'global', label: 'Global' },
          ]}
          value="page"
          onChange={(v) => console.log(v)}
        />
      </section>

      <section style={{ marginBottom: 'var(--quil-space-8)' }}>
        <h2 style={{ fontSize: 'var(--quil-heading-3)', fontFamily: 'var(--quil-font-head)', color: 'var(--quil-text-100)', marginBottom: 'var(--quil-space-4)' }}>
          Chips & Badges
        </h2>
        <div style={{ display: 'flex', gap: 'var(--quil-space-2)', flexWrap: 'wrap' }}>
          <Chip>Default</Chip>
          <Chip variant="accent">Accent</Chip>
          <Chip variant="success">Success</Chip>
          <Chip variant="error">Error</Chip>
          <Badge variant="default">Default</Badge>
          <Badge variant="accent">Accent</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="error">Error</Badge>
        </div>
      </section>

      <section style={{ marginBottom: 'var(--quil-space-8)' }}>
        <h2 style={{ fontSize: 'var(--quil-heading-3)', fontFamily: 'var(--quil-font-head)', color: 'var(--quil-text-100)', marginBottom: 'var(--quil-space-4)' }}>
          Tabs
        </h2>
        <Tabs defaultValue="overview" onValueChange={setTabValue}>          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="canvas">Canvas</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="quil-tabs-content">
            <p>Overview content</p>
          </TabsContent>
          <TabsContent value="canvas" className="quil-tabs-content">
            <p>Canvas content</p>
          </TabsContent>
          <TabsContent value="settings" className="quil-tabs-content">
            <p>Settings content</p>
          </TabsContent>
        </Tabs>
      </section>

      <section style={{ marginBottom: 'var(--quil-space-8)' }}>
        <h2 style={{ fontSize: 'var(--quil-heading-3)', fontFamily: 'var(--quil-font-head)', color: 'var(--quil-text-100)', marginBottom: 'var(--quil-space-4)' }}>
          Pen components
        </h2>
        <div style={{ display: 'flex', gap: 'var(--quil-space-6)', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--quil-space-2)' }}>
            <FeatherPen size={48} />
            <span style={{ fontSize: 'var(--quil-text-xs)', color: 'var(--quil-text-70)' }}>FeatherPen (static)</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--quil-space-2)' }}>
            <PenLoader size={48} loading={loading} />
            <Button variant="primary" onClick={() => setLoading((l) => !l)}>
              {loading ? 'Stop loading' : 'Start loading'}
            </Button>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 'var(--quil-space-8)' }}>
        <h2 style={{ fontSize: 'var(--quil-heading-3)', fontFamily: 'var(--quil-font-head)', color: 'var(--quil-text-100)', marginBottom: 'var(--quil-space-4)' }}>
          Status messages
        </h2>
        <div style={{ display: 'flex', gap: 'var(--quil-space-4)', flexWrap: 'wrap' }}>
          <StatusMessage variant="default" message="Saved" />
          <StatusMessage variant="success" message="Changes saved successfully" />
          <StatusMessage variant="error" message="Save failed. Try again." />
          <StatusMessage variant="warning" message="Unsaved changes" />
        </div>
      </section>

      <section style={{ marginBottom: 'var(--quil-space-8)' }}>
        <h2 style={{ fontSize: 'var(--quil-heading-3)', fontFamily: 'var(--quil-font-head)', color: 'var(--quil-text-100)', marginBottom: 'var(--quil-space-4)' }}>
          Contrast check (text intensity levels)
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--quil-space-2)' }}>
          <div style={{ color: 'var(--quil-text-100)', fontSize: 'var(--quil-heading-1)' }}>H1 — text-100</div>
          <div style={{ color: 'var(--quil-text-95)', fontSize: 'var(--quil-heading-2)' }}>H2 — text-95</div>
          <div style={{ color: 'var(--quil-text-90)', fontSize: 'var(--quil-heading-3)' }}>H3 — text-90</div>
          <div style={{ color: 'var(--quil-text-85)', fontSize: 'var(--quil-heading-4)' }}>H4 — text-85</div>
          <div style={{ color: 'var(--quil-text-80)', fontSize: 'var(--quil-text-base)' }}>Body — text-80</div>
          <div style={{ color: 'var(--quil-text-75)', fontSize: 'var(--quil-text-sm)' }}>Small — text-75</div>
          <div style={{ color: 'var(--quil-text-70)', fontSize: 'var(--quil-text-xs)' }}>Caption — text-70</div>
        </div>
      </section>
    </div>
  )
}
