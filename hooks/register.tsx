import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { ContextReading } from '../types'

// Narrow: the line is shared with the engine's own hint and its pills.
const WIDTH = 14
const WARN = 60
const URGENT = 80

const reading = atom({ plugin: 'context-bar', key: 'reading' } as const, null)

const COLOR = { calm: '#7bd88f', warn: '#f2c35b', urgent: '#ff7b7b' } as const

export type Level = keyof typeof COLOR

export function levelOf(percent: number): Level {
  if (percent > URGENT) return 'urgent'
  if (percent >= WARN) return 'warn'
  return 'calm'
}

export function adviceFor(level: Level): string | null {
  if (level === 'urgent') return '→ /compact now'
  if (level === 'warn') return '→ /compact'
  return null
}

/** Filled cells, rounded so only a truly empty window shows none and only a full one shows all. */
export function barOf(percent: number, width: number = WIDTH): { filled: string; rest: string } {
  const clamped = Math.min(Math.max(percent, 0), 100)
  let filled = Math.round((clamped / 100) * width)
  if (filled === 0 && clamped > 0) filled = 1
  if (filled === width && clamped < 100) filled = width - 1
  return { filled: '█'.repeat(filled), rest: '░'.repeat(width - filled) }
}

async function sample($: EngineInterface): Promise<void> {
  try {
    const { context } = await $.session.usage()
    // Undefined until the live window's first API response: a new or just-compacted
    // session has nothing to show, and 0% would be a lie rather than a blank.
    if (context.percent === undefined) {
      await update($, reading, () => null)
      return
    }
    const next: ContextReading = {
      percent: context.percent,
      tokens: context.tokens ?? 0,
      window: context.window,
    }
    await update($, reading, () => next)
  } catch {
    await update($, reading, () => null)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await sample($)
    return started
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    // Only the main thread's turns move the session window; a subagent's do not.
    if (!e.agentId) await sample($)
    return done
  })

  on('session.compact', async ($, e, next) => {
    const done = await next(e)
    await update($, reading, () => null)
    return done
  })

  // The hint line, redrawn: the engine's own text is re-emitted as it arrives
  // (never rebuilt here, so its pills and mode notices cannot drift out of sync)
  // and the bar is appended in colour, which `tail` could not carry — it is
  // always drawn dim.
  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    const now = await read($, reading)
    if (now === null) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const level = levelOf(now.percent)
    const color = COLOR[level]
    const { filled, rest } = barOf(now.percent)
    const advice = adviceFor(level)

    return (
      <Box>
        <Text dimColor>{e.props.hint}</Text>
        <Text dimColor>{'   ctx '}</Text>
        <Text color={color}>{filled}</Text>
        <Text dimColor>{rest}</Text>
        <Text color={color}>{` ${String(now.percent).padStart(3)}%`}</Text>
        {advice ? <Text color={color}>{`  ${advice}`}</Text> : null}
      </Box>
    )
  })
}
