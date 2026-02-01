# ghostty-radiant

A Claude Code plugin that dynamically shifts your Ghostty terminal's colors based on what Claude is doing. Each tab maintains independent colors — run multiple Claude sessions side-by-side and each one reflects its own state.

## How it works

```
Claude Code hooks → shell scripts → OSC escape sequences → your Ghostty tab recolors
```

When Claude starts working, your terminal background subtly shifts to teal. When it needs your input, the background warms to amber. When it finishes, a gold flash fades back to the base theme. Errors snap to coral.

Each Claude Code session captures its own TTY path at startup. All color changes write OSC sequences to that specific TTY, so only the active session's tab changes — other tabs stay at their own state.

### States

| State | Trigger | Color | Behavior |
|-------|---------|-------|----------|
| **connected** | Session starts | Green tint | Flashes, fades to base after 1.5s |
| **working** | Tool use | Teal/blue | Animated ping-pong between two shades |
| **needs_input** | Permission request | Warm amber | Holds until resolved |
| **completed** | Claude stops | Gold tint | Fades to base after 2s |
| **error** | Tool error | Coral red | Instant snap |
| **base** | Idle | Dark blue-gray | Default resting state |

## Install

### 1. Clone the repo

```bash
git clone https://github.com/aparente/ghostty-radiant.git
cd ghostty-radiant
```

### 2. Run the install script

```bash
./scripts/install.sh
```

This copies the Ghostty theme to `~/.config/ghostty/themes/radiant` and the color config to `~/.claude/radiant-theme.json`.

### 3. Set the Ghostty theme

Add to your Ghostty config (`~/.config/ghostty/config`):

```
theme = radiant
```

### 4. Register hooks with Claude Code

Add to `~/.claude/settings.json` under `"hooks"`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/ghostty-radiant/scripts/session-start-hook.sh",
            "timeout": 5
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/ghostty-radiant/scripts/post-tool-hook.sh",
            "timeout": 5
          }
        ]
      }
    ],
    "PermissionRequest": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/ghostty-radiant/scripts/permission-hook.sh",
            "timeout": 5
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/ghostty-radiant/scripts/stop-hook.sh",
            "timeout": 5
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/ghostty-radiant/scripts/session-end-hook.sh",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

Replace `/path/to/ghostty-radiant` with the actual clone path.

If installed as a Claude Code plugin (via `hooks/hooks.json`), the `${CLAUDE_PLUGIN_ROOT}` variable handles this automatically.

## Manual testing

```bash
# Shift to working state
./scripts/set-theme-state.sh working

# Shift to needs_input
./scripts/set-theme-state.sh needs_input

# Restore original colors
./scripts/set-theme-state.sh restore
```

## Customization

Edit `~/.claude/radiant-theme.json` to change colors, transition modes, or timing. Each state supports:

- **`bg`**, **`fg`**, **`cursor`** — hex colors
- **`transition`** — `"instant"` or `"animate"`
- **`animation`** — `end_bg`, `steps`, `step_ms` for animated states
- **`auto_transition`** — `to` state and `after_ms` delay

## Requirements

- [Ghostty](https://ghostty.org) terminal (supports OSC 10/11/12)
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) with hooks support
- `jq` for JSON parsing
- `bc` for transition timing math

## How per-tab isolation works

When `SessionStart` fires, the hook captures the session's TTY path (e.g., `/dev/ttys003`) and writes it to `/tmp/radiant-tty-{session_id}`. Subsequent hooks look up this file to target the correct TTY. Since each Ghostty tab has its own PTY, writing OSC sequences to a specific TTY only affects that tab.
