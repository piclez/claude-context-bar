import { expect, test } from 'claude-code/testing'
import type { On, RenderElement } from 'claude-code'

const SURFACES = ['terminal', 'desktop'] as const
// Stands in for whatever the engine draws there: '? for shortcuts', the mode pills.
const HINT = '? for shortcuts   \u23f5\u23f5 bypass permissions on'

/** The engine's floor: nothing sits beneath the plugin unless the test puts it there. */
function engine(on: On, percent: number | undefined): void {
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: { tokens: percent === undefined ? undefined : percent * 2000, window: 200000, percent },
      rateLimits: [],
    },
  }))
  // The band is the plugin's to draw; the floor answers with an empty one, so a
  // test that expects no band asserts on this rather than on a refusal.
  on('ui.render', () => ({ type: 'Box', children: [] }))
  on('session.start', () => ({ cwd: '/tmp' }))
  on('turn.complete', () => ({ text: '' }))
}

/** Every Text string in the drawing, in order, so a test reads the band as shown. */
function texts(node: RenderElement): string[] {
  const out: string[] = []
  const walk = (n: unknown): void => {
    if (n === null || n === undefined || typeof n === 'boolean') return
    if (typeof n === 'string' || typeof n === 'number') return void out.push(String(n))
    if (Array.isArray(n)) return void n.forEach(walk)
    const el = n as { children?: unknown }
    if (el.children !== undefined) walk(el.children)
  }
  walk(node)
  return out
}

async function bandAt($: Parameters<Parameters<typeof test>[1]>[0], on: On, percent: number | undefined, surface: typeof SURFACES[number]) {
  engine(on, percent)
  await $.session.start({ cwd: '/tmp', surface: null, isInteractive: true })
  const ui = await $.ui.mount({
    plugin: 'context-bar',
    surface,
    component: 'PromptHint',
    props: { isDraft: false, isWorking: false, hint: HINT },
  })
  return ui
}

for (const surface of SURFACES) {
  test(`draws the bar and the percentage on ${surface}`, async ($, on) => {
    const ui = await bandAt($, on, 42, surface)
    const shown = texts(await ui.drawn()).join('')

    expect(shown).toContain('ctx')
    expect(shown).toContain('42%')
    expect(shown).toContain('█')
    expect(shown).toContain('░')
  })

  test(`stays quiet below the warn threshold on ${surface}`, async ($, on) => {
    const ui = await bandAt($, on, 59, surface)

    expect(texts(await ui.drawn()).join('')).not.toContain('/compact')
  })

  test(`recommends /compact from 60 percent on ${surface}`, async ($, on) => {
    const ui = await bandAt($, on, 60, surface)
    const shown = texts(await ui.drawn()).join('')

    expect(shown).toContain('→ /compact')
    expect(shown).not.toContain('compact now')
  })

  test(`urges /compact above 80 percent on ${surface}`, async ($, on) => {
    const ui = await bandAt($, on, 88, surface)

    expect(texts(await ui.drawn()).join('')).toContain('→ /compact now')
  })

  test(`draws nothing before the window has a reading on ${surface}`, async ($, on) => {
    const ui = await bandAt($, on, undefined, surface)
    const shown = texts(await ui.drawn()).join('')

    expect(shown).not.toContain('ctx')
    expect(shown).not.toContain('%')
  })

  test(`keeps the engine's own hint line on ${surface}`, async ($, on) => {
    const ui = await bandAt($, on, 72, surface)
    const shown = texts(await ui.drawn()).join('')

    expect(shown).toContain(HINT)
    expect(shown.indexOf(HINT)).toBeLessThan(shown.indexOf('ctx'))
  })
}

test('a subagent turn does not resample the session window', async ($, on) => {
  let calls = 0
  on('session.usage', () => {
    calls += 1
    return { value: { startedAt: 0, context: { tokens: 84000, window: 200000, percent: 42 }, rateLimits: [] } }
  })
  on('session.start', () => ({ cwd: '/tmp' }))
  on('turn.complete', () => ({ text: '' }))
  await $.session.start({ cwd: '/tmp', surface: null, isInteractive: true })
  const afterStart = calls

  await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't1', agentId: 'sub-1', reason: 'end_turn' })

  expect(calls).toBe(afterStart)
})
