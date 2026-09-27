# opencode-tui-extras

Two opt-in extras for the [OpenCode](https://opencode.ai) CLI (TUI):

- **openWith** — one or more clickable rows in the session sidebar footer, above the working directory path. Clicking a row launches its command with the session's working directory as the only argument.
- **sidebarToggle** — a clickable `◨` icon in the prompt footer, a mouse affordance for the built-in `<leader>b` binding (it does not show sidebar state).

**Everything is off until you enable it in `cli.json`.** The plugin loads but registers nothing and shows nothing when no options are configured.

## Install

Clone into OpenCode's global plugins directory (or symlink it there):

```sh
git clone https://github.com/mickeiik/opencode-tui-extras.git ~/.config/opencode/plugins/tui-extras
```

Restart OpenCode once. After that, feature toggles apply live when `cli.json` changes — no restart.

## Configuration (required)

Without a `cli.json` entry there are no options, so nothing renders. Add the plugin to `~/.config/opencode/cli.json`:

```jsonc
{
  "$schema": "https://opencode.ai/v2/cli.json",
  "plugins": [
    {
      "package": "./plugins/tui-extras",
      "options": {
        "openWith": [
          { "command": "codium", "title": "Open with VSCodium" },
          { "command": "zed", "title": "Open with Zed" }
        ],
        "sidebarToggle": true
      }
    }
  ]
}
```

## Options

| Option | Default | Description |
| --- | --- | --- |
| `openWith` | disabled | Array of `{ command, title? }`. Each entry renders one sidebar row; clicking it runs `command <working directory>`. `title` defaults to `command`. An empty array, or an array with no valid entry, disables the feature. Malformed entries (non-object, missing or non-string `command`) are skipped. |
| `sidebarToggle` | disabled | `true` renders the sidebar toggle button in the prompt footer. `false` or absent disables it. |

Unknown option keys produce one warning toast listing them, e.g. `Unknown options: openwith — configure features in cli.json`. Option keys are case-sensitive.

Any editor or tool with a CLI (`code`, `zed`, `cursor`, `xdg-open`, ...) works with `openWith`.

## Notes

- `sidebarToggle` duplicates the built-in `<leader>b` keybinding; it only adds a mouse target. It is hidden for subagent sessions, where the sidebar cannot show.
- The built-in "Working directory" menu (Copy path / Open folder / Workspaces) is not extensible through the plugin API, so `openWith` adds its own rows above the directory path instead of a menu entry.
- Installing the package through `cli.json` as a git dependency resolves and downloads, but the host CLI cannot load JSX plugins from `node_modules`: they are compiled outside OpenTUI's Solid transform and the generated JSX runtime import does not resolve. Local plugins, as installed above, are transformed correctly.
- To remove the plugin, delete `~/.config/opencode/plugins/tui-extras` and its `cli.json` entry.

## Development

```sh
bun install
bun test
bun run check
```

`tui.tsx` is the entry point; the features live in `src/` and are unit-tested with `@opentui/solid`'s `testRender`.
