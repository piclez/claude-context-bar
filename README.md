# context-bar

A Claude Code mod that shows how full the context window is, as a colored bar on the prompt hint line.

```
ctx ██████░░░░░░░░  43%
```

| Context used | Color | Hint |
| --- | --- | --- |
| under 60% | green | none |
| 60% to 80% | yellow | `→ /compact` |
| over 80% | red | `→ /compact now` |

The bar is blank in a new or just-compacted session, until the first API response. It follows the main
thread only; subagent turns do not move it.

## Install

At the prompt of a terminal session:

```
/plugin install context-bar --marketplace piclez/claude-context-bar
```

From a shell:

```
claude plugin install context-bar --marketplace piclez/claude-context-bar
```

Answer `y` to add the marketplace, then pick a scope.

## Develop

```
claude --plugin-dir /path/to/context-bar
claude plugin test /path/to/context-bar
```
