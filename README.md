# ghostty-aura

A theme-agnostic Claude Code plugin that dynamically tints your Ghostty terminal based on what Claude is doing. Works with any Ghostty theme — no bundled colors, no theme switching.

## How it works

```
Session start → query your current colors via OSC → blend tints at runtime → per-tab isolation
```

On session start, the plugin queries your terminal's current background, foreground, and cursor colors. These become the "base" palette. When state changes occur, tint colors are blended into your base using HSL color math — preserving your theme's lightness while shifting hue and saturation.

Each Claude Code session captures its own TTY, so multiple tabs maintain independent color states.

### States

| State | Trigger | Tint | Behavior |
|-------|---------|------|----------|
| **connected** | Session starts | Green | Animated fade, returns to base after 1.5s |
| **working** | Tool use | Blue | Animated ping-pong |
| **needs_input** | Permission request | Amber | Instant snap, holds until resolved |
| **completed** | Claude stops | Gold | Animated fade, returns to base after 2s |
| **error** | Tool error | Red | Instant snap |
| **base** | Idle | — | Your original theme colors |

## Install

### As a Claude Code plugin (recommended)

```bash
git clone https://github.com/aparente/ghostty-aura.git
```

Add to `~/.claude/settings.json`:

```json
{
  "plugins": ["path/to/ghostty-aura"]
}
```

The `hooks/hooks.json` registers all hooks automatically via `${CLAUDE_PLUGIN_ROOT}`.

### First run

On first session start, a default config is created at `~/.claude/aura-config.json`. To customize interactively:

```bash
cd ghostty-aura
node lib/setup.js
```

## Configuration

Edit `~/.claude/aura-config.json`. No absolute colors — only tints and intensity. Actual colors are computed at runtime from your queried base.

```json
{
  "states": {
    "connected":   { "tint": "#4ade80", "intensity": 0.15, "transition": "animate", "auto_to": "base", "auto_ms": 1500 },
    "working":     { "tint": "#38bdf8", "intensity": 0.2,  "transition": "animate" },
    "needs_input": { "tint": "#fbbf24", "intensity": 0.25, "transition": "instant" },
    "completed":   { "tint": "#facc15", "intensity": 0.15, "transition": "animate", "auto_to": "base", "auto_ms": 2000 },
    "error":       { "tint": "#f87171", "intensity": 0.3,  "transition": "instant" }
  },
  "animation": { "steps": 8, "step_ms": 120 }
}
```

- **`tint`** — color to blend toward
- **`intensity`** — 0..1, how far to shift from base
- **`transition`** — `"animate"` (smooth fade) or `"instant"` (snap)
- **`auto_to`** / **`auto_ms`** — auto-return to another state after delay

## Manual testing

```bash
# Create a fake base file for testing
echo '{"bg":"#1a1b26","fg":"#c0caf5","cursor":"#c0caf5"}' > /tmp/aura-base-test.json

# Test blending
node lib/color.js blend "#1a1b26" "#38bdf8" 0.2
```

## Requirements

- [Ghostty](https://ghostty.org) terminal (OSC 10/11/12 support)
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) with hooks/plugins support
- Node.js >= 18
- `jq` for JSON parsing

## How per-tab isolation works

When `SessionStart` fires, the hook captures the session's TTY path (e.g., `/dev/ttys003`) and saves it to `/tmp/aura-tty-{session_id}`. It also queries the terminal's current colors and saves them to `/tmp/aura-base-{session_id}.json`. Subsequent hooks look up these files to target the correct TTY with the correct base palette.
