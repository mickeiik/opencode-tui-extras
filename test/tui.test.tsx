/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { existsSync } from "node:fs"
import { rm } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { MouseButton, RGBA } from "@opentui/core"
import { testRender } from "@opentui/solid"
import type { Context } from "@opencode/plugin/tui/context"
import type { JSX } from "solid-js"
import { setup } from "../src/setup"

type Claim = { prepend?: string; append?: string; render: (input: { sessionID?: string }) => JSX.Element }

function fake(input?: {
  directory?: string
  sessions?: Record<string, { parentID?: string } | undefined>
}) {
  const color = RGBA.fromInts(200, 200, 200)
  const claims: Claim[] = []
  const toasts: Array<{ title?: string; message: string; variant?: string }> = []
  const dispatched: string[] = []
  const context = {
    options: {},
    location: { directory: input?.directory },
    theme: { text: { base: color, muted: color } },
    ui: {
      toast: { show: (toast: (typeof toasts)[number]) => void toasts.push(toast) },
      slot: (claim: Claim) => {
        claims.push(claim)
        return () => {}
      },
    },
    keymap: {
      dispatch: (id: string) => void dispatched.push(id),
    },
    data: {
      session: { get: (id: string) => input?.sessions?.[id] },
    },
  } as unknown as Context
  return { context, claims, toasts, dispatched }
}

async function waitFor(check: () => boolean, timeout = 1000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (check()) return true
    await Bun.sleep(25)
  }
  return check()
}

test("setup registers one claim per enabled feature and stays silent when nothing is enabled", () => {
  const enabled = fake()
  setup(enabled.context, { openWith: [{ command: "codium", title: "Open with VSCodium" }], sidebarToggle: true })
  expect(enabled.claims.length).toBe(2)
  expect(enabled.claims.some((claim) => claim.prepend === "sidebar.footer")).toBe(true)
  expect(enabled.claims.some((claim) => claim.append === "prompt.footer")).toBe(true)
  expect(enabled.toasts).toEqual([])

  const idle = fake()
  setup(idle.context, {})
  expect(idle.claims.length).toBe(0)
  expect(idle.toasts).toEqual([])
})

test("unknown options warn once and register nothing", () => {
  const f = fake()
  setup(f.context, { openwith: [] })
  expect(f.toasts.length).toBe(1)
  expect(f.toasts[0]!.title).toBe("opencode-tui-extras")
  expect(f.toasts[0]!.variant).toBe("warning")
  expect(f.toasts[0]!.message).toContain("openwith")
  expect(f.toasts[0]!.message).toContain("cli.json")
  expect(f.claims.length).toBe(0)
})

test("openWith renders a row and a left click launches the command", async () => {
  const directory = join(tmpdir(), `tui-extras-${randomUUID()}`)
  const f = fake({ directory })
  setup(f.context, { openWith: [{ command: "mkdir", title: "Make folder" }] })
  const claim = f.claims.find((item) => item.prepend === "sidebar.footer")!
  const app = await testRender(() => claim.render({ sessionID: "session" }), { width: 40, height: 4 })

  try {
    await app.renderOnce()
    expect(app.captureCharFrame()).toContain("Make folder")

    await app.mockMouse.click(1, 0)
    expect(await waitFor(() => existsSync(directory))).toBe(true)
  } finally {
    app.renderer.destroy()
    await rm(directory, { recursive: true, force: true })
  }
})

test("openWith ignores a right click (no launch, no toast)", async () => {
  const directory = join(tmpdir(), `tui-extras-${randomUUID()}`)
  const f = fake({ directory })
  setup(f.context, { openWith: [{ command: "mkdir", title: "Make folder" }] })
  const claim = f.claims.find((item) => item.prepend === "sidebar.footer")!
  const app = await testRender(() => claim.render({ sessionID: "session" }), { width: 40, height: 4 })

  try {
    await app.renderOnce()
    await app.mockMouse.click(1, 0, MouseButton.RIGHT)
    expect(f.toasts).toEqual([])
    expect(existsSync(directory)).toBe(false)
  } finally {
    app.renderer.destroy()
    await rm(directory, { recursive: true, force: true })
  }
})

test("openWith reports a launch failure as an error toast", async () => {
  const f = fake({ directory: join(tmpdir(), `tui-extras-${randomUUID()}`) })
  setup(f.context, { openWith: [{ command: "definitely-not-a-real-binary-xyz", title: "Nope" }] })
  const claim = f.claims.find((item) => item.prepend === "sidebar.footer")!
  const app = await testRender(() => claim.render({ sessionID: "session" }), { width: 40, height: 4 })

  try {
    await app.renderOnce()
    await app.mockMouse.click(1, 0)
    expect(await waitFor(() => f.toasts.length > 0)).toBe(true)
    expect(f.toasts[0]!.variant).toBe("error")
    expect(f.toasts[0]!.title).toBe("Nope")
    expect(f.toasts[0]!.message).toContain("definitely-not-a-real-binary-xyz")
  } finally {
    app.renderer.destroy()
  }
})

test("sidebar toggle renders the icon and dispatches on click", async () => {
  const f = fake({ sessions: { session: {} } })
  setup(f.context, { sidebarToggle: true })
  const claim = f.claims.find((item) => item.append === "prompt.footer")!
  const app = await testRender(() => claim.render({ sessionID: "session" }), { width: 40, height: 2 })

  try {
    await app.renderOnce()
    expect(app.captureCharFrame()).toContain("◨")

    await app.mockMouse.click(1, 0)
    expect(f.dispatched).toEqual(["session.sidebar.toggle"])
  } finally {
    app.renderer.destroy()
  }
})

test("sidebar toggle ignores a right click", async () => {
  const f = fake({ sessions: { session: {} } })
  setup(f.context, { sidebarToggle: true })
  const claim = f.claims.find((item) => item.append === "prompt.footer")!
  const app = await testRender(() => claim.render({ sessionID: "session" }), { width: 40, height: 2 })

  try {
    await app.renderOnce()
    await app.mockMouse.click(1, 0, MouseButton.RIGHT)
    expect(f.dispatched).toEqual([])
  } finally {
    app.renderer.destroy()
  }
})

test("sidebar toggle renders nothing without a root session", async () => {
  const f = fake({ sessions: { plain: {}, child: { parentID: "plain" } } })
  setup(f.context, { sidebarToggle: true })
  const claim = f.claims.find((item) => item.append === "prompt.footer")!

  const unknown = await testRender(() => claim.render({ sessionID: "ghost" }), { width: 40, height: 1 })
  const child = await testRender(() => claim.render({ sessionID: "child" }), { width: 40, height: 1 })
  const none = await testRender(() => claim.render({}), { width: 40, height: 1 })

  try {
    await unknown.renderOnce()
    await child.renderOnce()
    await none.renderOnce()
    expect(unknown.captureCharFrame()).not.toContain("◨")
    expect(child.captureCharFrame()).not.toContain("◨")
    expect(none.captureCharFrame()).not.toContain("◨")
  } finally {
    unknown.renderer.destroy()
    child.renderer.destroy()
    none.renderer.destroy()
  }
})

test("disabled features register no claims", () => {
  const empty = fake()
  setup(empty.context, { openWith: [] })
  expect(empty.claims.length).toBe(0)

  const off = fake()
  setup(off.context, { sidebarToggle: false })
  expect(off.claims.length).toBe(0)
})
