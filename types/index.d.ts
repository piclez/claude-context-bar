export type ContextReading = { percent: number; tokens: number; window: number }

declare module 'claude-code' {
  interface PluginState {
    'context-bar': { reading: ContextReading | null }
  }
}
