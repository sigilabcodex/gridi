import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer, type ViteDevServer } from "vite";

type CdpMessage = { id?: number; method?: string; params?: unknown; result?: unknown; error?: { message: string } };
type DialogMode = "accept" | "dismiss";

const SETTINGS_FIXTURE = {
  version: 1,
  ui: { theme: "dark", controlStyle: "auto", customCss: "", reduceMotion: true, experimental: false, hideWelcome: true },
  audio: { masterGain: 1, limiterEnabled: false },
  data: { autosave: false },
  ux: { tooltips: false },
};

const COMMON_BROWSER_PATHS = [
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
];

let server: ViteDevServer;
let baseUrl = "";
let browserPath: string | null = null;
let page: BrowserPage | null = null;

describe("GRIDI browser smoke", () => {
  before(async () => {
    browserPath = await findBrowserExecutable();
    server = await createServer({ server: { host: "127.0.0.1", port: 0 }, logLevel: "error" });
    await server.listen();
    const address = server.httpServer?.address();
    assert(address && typeof address === "object", "Vite server did not expose a TCP port");
    baseUrl = `http://127.0.0.1:${address.port}/`;
  });

  after(async () => {
    await page?.close();
    await server?.close();
  });

  beforeEach(async () => {
    await page?.close();
    page = null;
    if (!browserPath) return;
    page = await BrowserPage.launch(browserPath, baseUrl);
  });

  it("loads the app and reflects single-module selection in the Actions menu", async (t) => {
    if (!page) return t.skip(missingBrowserMessage());
    const p = activePage();
    await p.waitForSelector(moduleSelector());
    assert((await moduleCount(p)) >= 2, "expected the default workspace modules to render");

    await p.click(moduleSelector(0));
    await p.waitForFunction(() => document.querySelectorAll('.moduleSurface[aria-selected="true"]').length === 1);
    assert.equal(await p.text("[data-testid='selection-actions-button'] .transportUtilitySummaryLabel"), "Actions · 1");
    assert.equal(await p.eval(`document.querySelector('[data-testid="selection-actions-button"]')?.disabled`), false);

    await p.click("[data-testid='selection-actions-button']");
    await p.waitForSelector("[data-testid='selection-actions-panel']:not(.hidden)");
    assert.equal(await p.eval(`buttonNamed('Copy Settings')?.disabled ?? true`), false);
    assert.equal(await p.eval(`buttonNamed('Paste Settings')?.disabled ?? true`), true);
    assert.equal(await p.eval(`buttonNamed('Duplicate')?.disabled ?? buttonNamed('Duplicate selection')?.disabled ?? true`), false);
    assert.equal(await p.eval(`buttonNamed('Delete')?.disabled ?? buttonNamed('Delete selection')?.disabled ?? true`), false);
    assert.equal(await p.eval(`buttonNamed('Copy selected')?.hidden ?? false`), true);
    assert.equal(await p.eval(`buttonNamed('Paste copied')?.hidden ?? false`), true);

    await p.key("Escape");
    await p.waitForFunction(() => document.querySelectorAll('.moduleSurface[aria-selected="true"]').length === 0);
    assert.equal(await p.eval(`document.querySelector('[data-testid="selection-actions-button"]')?.disabled`), true);
  });

  it("selects all modules with Ctrl+A and reflects the selection count", async (t) => {
    if (!page) return t.skip(missingBrowserMessage());
    const p = activePage();
    await p.waitForSelector(moduleSelector());
    const count = await moduleCount(p);
    await p.key("a", { ctrlKey: true });
    await p.waitForFunction((expected) => document.querySelectorAll('.moduleSurface[aria-selected="true"]').length === Number(expected), String(count));
    assert.equal(await p.text("[data-testid='selection-actions-button'] .transportUtilitySummaryLabel"), `Actions · ${count}`);
  });

  it("multi-selects modules, duplicates them, then deletes the duplicated selection with confirmation", async (t) => {
    if (!page) return t.skip(missingBrowserMessage());
    const p = activePage();
    await p.waitForSelector(moduleSelector());
    const initialCount = await moduleCount(p);

    await p.click(moduleSelector(0));
    await p.click(moduleSelector(1), { ctrlKey: true });
    await p.waitForFunction(() => document.querySelectorAll('.moduleSurface[aria-selected="true"]').length === 2);

    await runSelectionAction(p, "Duplicate selected");
    await p.waitForFunction((count) => document.querySelectorAll('.moduleSurface[data-module-id]').length === Number(count), String(initialCount + 2));
    assert.equal(await moduleCount(p), initialCount + 2);
    await p.waitForFunction(() => document.querySelectorAll('.moduleSurface[aria-selected="true"]').length === 2);

    p.nextDialog("accept");
    await runSelectionAction(p, "Delete selected");
    await p.waitForFunction((count) => document.querySelectorAll('.moduleSurface[data-module-id]').length === Number(count), String(initialCount));
    assert.equal(await moduleCount(p), initialCount);
    assert.equal(await selectedModuleCount(p), 0);
  });

  it("suppresses global copy/paste/delete/escape shortcuts while typing in Add Module search", async (t) => {
    if (!page) return t.skip(missingBrowserMessage());
    const p = activePage();
    await p.waitForSelector(moduleSelector());
    await p.click(moduleSelector(0));
    await p.waitForFunction(() => document.querySelectorAll('.moduleSurface[aria-selected="true"]').length === 1);
    const initialCount = await moduleCount(p);

    await p.click(".addModuleSlot");
    await p.waitForSelector(".addSlotSearchInput");
    await p.eval(`(() => {
      const input = document.querySelector('.addSlotSearchInput');
      input?.focus();
      if (input) {
        input.value = 'lfo';
        input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'lfo' }));
      }
    })()`);

    await p.key("c", { ctrlKey: true });
    await p.key("v", { ctrlKey: true });
    await p.key("c", { ctrlKey: true, shiftKey: true });
    await p.key("v", { ctrlKey: true, shiftKey: true });
    await p.key("a", { ctrlKey: true });
    await p.key("d", { ctrlKey: true });
    await p.key("Delete");
    await p.key("Escape");

    assert.equal(await moduleCount(p), initialCount, "typing shortcuts must not duplicate or delete modules");
    assert.equal(await selectedModuleCount(p), 1, "Escape in a populated search clears/owns the menu search before global selection clear");
  });

  it("filters Add Module quick search for LFO/control and Scope/visual results", async (t) => {
    if (!page) return t.skip(missingBrowserMessage());
    const p = activePage();
    await p.waitForSelector(".addModuleSlot");
    await p.click(".addModuleSlot");
    await p.waitForSelector(".addSlotSearchInput");

    await setAddModuleSearch(p, "lfo");
    await p.waitForFunction(() => document.body.textContent?.includes("LFO") === true);
    assert(await p.visibleTextIncludes("LFO"), "LFO subtype result should be visible");
    assert(await p.visibleTextIncludes("CTRL · Control"), "control family should be visible for LFO search");

    await setAddModuleSearch(p, "scope");
    await p.waitForFunction(() => document.body.textContent?.includes("Scope") === true);
    assert(await p.visibleTextIncludes("Scope"), "Scope subtype result should be visible");
    assert(await p.visibleTextIncludes("VIS · Visual"), "visual family should be visible for Scope search");

    await p.key("Escape");
  });

  it("inserts a factory module preset from Add Module search", async (t) => {
    if (!page) return t.skip(missingBrowserMessage());
    const p = activePage();
    await p.waitForSelector(".addModuleSlot");
    const initialCount = await moduleCount(p);

    await p.click(".addModuleSlot");
    await p.waitForSelector(".addSlotSearchInput");
    await setAddModuleSearch(p, "DRUM014");
    await p.waitForFunction(() => document.body.textContent?.includes("DRUM014 · Closed Hat") === true);
    await p.click("button:text('DRUM014 · Closed Hat')");

    await p.waitForFunction((count) => document.querySelectorAll('.moduleSurface[data-module-id]').length === Number(count), String(initialCount + 1));
    assert.equal(await moduleCount(p), initialCount + 1);
  });

  it("normalizes module headers and exposes compatible settings actions in global Actions", async (t) => {
    if (!page) return t.skip(missingBrowserMessage());
    const p = activePage();
    await p.waitForSelector(".triggerSurface");
    await p.waitForSelector(".drumSurface");
    await p.waitForSelector(".synthSurface");

    await p.click(".addModuleSlot");
    await p.click("button:text('CTRL · Control')");
    await p.click("button:text('Default Control')");
    await p.waitForSelector(".controlSurface");
    await p.click(".addModuleSlot");
    await p.click("button:text('VIS · Visual')");
    await p.click("button:text('Default Visual')");
    await p.waitForSelector(".visualSurface");

    const identity = await p.eval(`(() => ({
      drumPreset: Boolean(document.querySelector('.drumSurface .surfaceIdentity .modulePresetChip')),
      synthPreset: Boolean(document.querySelector('.synthSurface .surfaceIdentity .modulePresetChip')),
      drumSlotCount: document.querySelector('.drumSurface .surfaceIdentity')?.querySelectorAll('.moduleIdentitySlot').length,
      synthSlotCount: document.querySelector('.synthSurface .surfaceIdentity')?.querySelectorAll('.moduleIdentitySlot').length,
      drumLabel: document.querySelector('.drumSurface .moduleIdentitySlotLabel')?.textContent,
      drumValue: document.querySelector('.drumSurface .moduleIdentitySlotValue')?.textContent,
      synthLabel: document.querySelector('.synthSurface .moduleIdentitySlotLabel')?.textContent,
      synthValue: document.querySelector('.synthSurface .moduleIdentitySlotValue')?.textContent,
      genPreset: Boolean(document.querySelector('.triggerSurface .modulePresetChip')),
      genMode: Boolean(document.querySelector('.triggerSurface .surfaceIdentity .moduleIdentitySelector--gen')),
      genLabel: document.querySelector('.triggerSurface .moduleIdentitySlotLabel')?.textContent,
      genValue: document.querySelector('.triggerSurface .moduleIdentitySelector--gen .moduleIdentitySelectorValue')?.textContent,
      genSelectorCount: document.querySelector('.triggerSurface .surfaceIdentity')?.querySelectorAll('.moduleIdentitySlot').length,
      controlPreset: Boolean(document.querySelector('.controlSurface .modulePresetChip')),
      controlType: Boolean(document.querySelector('.controlSurface .surfaceIdentity .moduleIdentitySelector--control')),
      controlLabel: document.querySelector('.controlSurface .moduleIdentitySlotLabel')?.textContent,
      controlValue: document.querySelector('.controlSurface .moduleIdentitySelector--control .moduleIdentitySelectorValue')?.textContent,
      controlSelectorCount: document.querySelector('.controlSurface .surfaceIdentity')?.querySelectorAll('.moduleIdentitySlot').length,
      visualPreset: Boolean(document.querySelector('.visualSurface .modulePresetChip')),
      visualMode: Boolean(document.querySelector('.visualSurface .surfaceIdentity .moduleIdentitySelector--visual')),
      visualLabel: document.querySelector('.visualSurface .moduleIdentitySlotLabel')?.textContent,
      visualValue: document.querySelector('.visualSurface .moduleIdentitySelector--visual .moduleIdentitySelectorValue')?.textContent,
      visualSelectorCount: document.querySelector('.visualSurface .surfaceIdentity')?.querySelectorAll('.moduleIdentitySlot').length,
      perModuleActions: document.querySelectorAll('.moduleSettingsActionsButton').length,
      ellipsisActions: Array.from(document.querySelectorAll('.surfaceHeader button')).some((button) => button.textContent?.trim() === '⋯'),
    }))()`);
    const { drumLabel, drumValue, synthLabel, synthValue, genLabel, genValue, controlLabel, controlValue, visualLabel, visualValue, ...structure } = identity;
    assert.deepEqual(structure, {
      drumPreset: true,
      synthPreset: true,
      drumSlotCount: 1,
      synthSlotCount: 1,
      genPreset: false,
      genMode: true,
      genSelectorCount: 1,
      controlPreset: false,
      controlType: true,
      controlSelectorCount: 1,
      visualPreset: false,
      visualMode: true,
      visualSelectorCount: 1,
      perModuleActions: 0,
      ellipsisActions: false,
    });
    assert.deepEqual([drumLabel, synthLabel, genLabel, controlLabel, visualLabel], ["PRESET", "PRESET", "MODE", "TYPE", "MODE"]);
    assert.equal((drumValue ?? "").replace(/ \*$/, ""), "Deep Kick");
    assert.equal((synthValue ?? "").replace(/ \*$/, ""), "Rubber Bass");
    assert.match(genValue ?? "", /\S/, "GEN selector should show its current mode value");
    assert.equal(controlValue, "LFO");
    assert.equal(visualValue, "Scope");

    await p.click(".drumSurface .modulePresetChip");
    await p.waitForSelector(".modulePresetPanel");
    await p.key("Escape");
    await p.click(".synthSurface .modulePresetChip");
    await p.waitForSelector(".modulePresetPanel");
    await p.key("Escape");

    await p.click(".triggerSurface .moduleIdentitySelector--gen");
    await p.waitForSelector(".moduleIdentitySelectorPanel--gen");
    assert.equal(await p.eval(`document.querySelectorAll('.moduleIdentitySelectorPanel--gen .moduleIdentitySelectorOption').length`), 13);
    assert(Number(await p.eval(`document.querySelector('.moduleIdentitySelectorPanel--gen')?.getBoundingClientRect().height`)) <= 320, "GEN selector panel should have a bounded height");
    await p.click(".moduleIdentitySelectorPanel--gen button:text('Hybrid')");
    await p.waitForFunction(() => document.querySelector('.triggerSurface .moduleIdentitySelector--gen')?.getAttribute('data-value') === 'hybrid');

    await p.click(".controlSurface .moduleIdentitySelector--control");
    await p.click(".moduleIdentitySelectorPanel--control button:text('Drift')");
    await p.waitForFunction(() => document.querySelector('.controlSurface .moduleIdentitySelector--control')?.getAttribute('data-value') === 'drift');

    await p.click(".visualSurface .moduleIdentitySelector--visual");
    await p.click(".moduleIdentitySelectorPanel--visual button:text('Spectrum')");
    await p.waitForFunction(() => document.querySelector('.visualSurface .moduleIdentitySelector--visual')?.getAttribute('data-value') === 'spectrum');

    for (const [label, value] of [["Cellular Automata", "cellular-automata"], ["Genetic Algorithms", "genetic-algorithms"], ["Non-Euclidean", "non-euclidean"]]) {
      await p.click(".triggerSurface .moduleIdentitySelector--gen");
      await p.click(`.moduleIdentitySelectorPanel--gen button:text('${label}')`);
      await p.waitForFunction((expected) => document.querySelector('.triggerSurface .moduleIdentitySelector--gen')?.getAttribute('data-value') === expected, value);
      assert.equal(await p.eval(`document.querySelector('.triggerSurface .surfaceIdentity')?.querySelectorAll('.moduleIdentitySlot').length`), 1);
    }
    await p.click(".visualSurface .moduleIdentitySelector--visual");
    await p.click(".moduleIdentitySelectorPanel--visual button:text('Spectral Depth')");
    await p.waitForFunction(() => document.querySelector('.visualSurface .moduleIdentitySelector--visual')?.getAttribute('data-value') === 'spectral-depth');

    await p.click(".drumSurface .modulePresetChip");
    await p.waitForSelector(".modulePresetPanel");
    const loadedLongDrum = await p.eval(`(() => { const row = Array.from(document.querySelectorAll('.modulePresetPanel .modulePresetListRow')).find((item) => item.textContent?.includes('Distorted Perc')); if (!(row instanceof HTMLElement)) return false; row.click(); return true; })()`);
    assert.equal(loadedLongDrum, true);
    await p.waitForFunction(() => document.querySelector('.drumSurface .moduleIdentitySlotValue')?.textContent?.includes('Distorted Perc'));

    await p.click(".synthSurface .modulePresetChip");
    await p.waitForSelector(".modulePresetPanel");
    const loadedLongSynth = await p.eval(`(() => { const row = Array.from(document.querySelectorAll('.modulePresetPanel .modulePresetListRow')).find((item) => item.textContent?.includes('Wide Stereo Tone')); if (!(row instanceof HTMLElement)) return false; row.click(); return true; })()`);
    assert.equal(loadedLongSynth, true);
    await p.waitForFunction(() => document.querySelector('.synthSurface .moduleIdentitySlotValue')?.textContent?.includes('Wide Stereo Tone'));

    const slotGeometry = await p.eval(`(() => ['drumSurface', 'synthSurface', 'triggerSurface', 'controlSurface', 'visualSurface'].map((family) => { const surface = document.querySelector('.' + family); const slot = surface?.querySelector('.surfaceIdentity .moduleIdentitySlot'); const right = surface?.querySelector('.rightControls'); if (!slot || !right) return null; const slotRect = slot.getBoundingClientRect(); const style = getComputedStyle(slot); const label = slot.querySelector('.moduleIdentitySlotLabel'); const value = slot.querySelector('.moduleIdentitySlotValue'); return { height: slotRect.height, fits: slotRect.right <= right.getBoundingClientRect().left + 1, count: surface.querySelectorAll('.surfaceIdentity .moduleIdentitySlot').length, fullValueAccessible: (slot.getAttribute('aria-label') ?? '').includes(value?.textContent?.trim() ?? ''), metrics: { padding: style.padding, radius: style.borderRadius, fontSize: style.fontSize, fontWeight: style.fontWeight, gap: style.gap, align: style.alignItems, labelSize: label && getComputedStyle(label).fontSize, labelWeight: label && getComputedStyle(label).fontWeight, valueSize: value && getComputedStyle(value).fontSize, valueWeight: value && getComputedStyle(value).fontWeight } }; }))()`);
    assert(slotGeometry.every((item) => item?.height === 24 && item.fits && item.count === 1 && item.fullValueAccessible), "all five header identity slots should align, fit, and expose their full value");
    assert(slotGeometry.every((item) => JSON.stringify(item?.metrics) === JSON.stringify(slotGeometry[0]?.metrics)), "all five identity slots should share the same visual geometry");

    await p.click(".drumSurface");
    await p.click("[data-testid='selection-actions-button']");
    await p.waitForSelector("[data-testid='selection-actions-panel']:not(.hidden)");
    assert.equal(await p.eval(`buttonNamed('Paste Settings')?.disabled ?? false`), true);
    await p.click("button:text('Copy Settings')");
    await p.key("c", { ctrlKey: true, shiftKey: true });
    await p.click(".triggerSurface");
    await p.key("v", { ctrlKey: true, shiftKey: true });
    await p.click("[data-testid='selection-actions-button']");
    assert.equal(await p.eval(`buttonNamed('Paste Settings')?.disabled ?? true`), true, "incompatible GEN destination should disable settings paste");
    await p.key("Escape");
    const clickedOtherDrum = await p.eval(`(() => { const drums = document.querySelectorAll('.drumSurface'); if (!(drums[1] instanceof HTMLElement)) return false; drums[1].click(); return true; })()`);
    assert.equal(clickedOtherDrum, true, "default patch should provide a second drum destination");
    await p.click("[data-testid='selection-actions-button']");
    assert.equal(await p.eval(`buttonNamed('Paste Settings')?.disabled ?? true`), false);
    await p.click("button:text('Paste Settings')");
  });

  it("shows protected factory examples and guarded local-session batch deletion in Session Manager", async (t) => {
    if (!page) return t.skip(missingBrowserMessage());
    const p = activePage();
    await p.waitForSelector(moduleSelector());

    await openSessionManager(p);
    await p.waitForSelector("[data-testid='preset-manager-batch-actions']");
    assert(await p.visibleTextIncludes("factory example · protected"), "factory examples should be labelled protected");
    assert(await p.visibleTextIncludes("0 local selected"), "batch selection summary should start empty");
    assert.equal(await p.eval(`buttonNamed('Delete selected')?.disabled ?? false`), true);

    await p.click(".presetRow button:text('Duplicate')");
    await p.waitForFunction(() => !document.body.textContent?.includes('Preset Manager'));

    await openSessionManager(p);
    await p.waitForSelector(".presetRow input[type='checkbox']:not(:disabled)");
    await p.click(".presetRow input[type='checkbox']:not(:disabled)");
    await p.waitForFunction(() => document.body.textContent?.includes('1 local selected') === true);
    assert.equal(await p.eval(`buttonNamed('Delete selected')?.disabled ?? true`), false);

    p.nextDialog("dismiss");
    await p.click("button:text('Delete selected')");
    await p.waitForFunction(() => document.body.textContent?.includes('Preset Manager') === true);
    assert(await p.visibleTextIncludes("1 local selected"), "dismissing delete confirmation should preserve the selected local session");
  });
});

function missingBrowserMessage() {
  return "No Chromium-compatible browser found. Install Chromium/Chrome or set GRIDI_E2E_BROWSER.";
}

function activePage() {
  assert(page, "browser page was not initialized");
  return page;
}

function moduleSelector(index?: number) {
  return typeof index === "number" ? `module:${index}` : ".moduleSurface[data-module-id]";
}

async function moduleCount(p: BrowserPage) {
  return p.eval(`document.querySelectorAll('.moduleSurface[data-module-id]').length`);
}

async function selectedModuleCount(p: BrowserPage) {
  return p.eval(`document.querySelectorAll('.moduleSurface[aria-selected="true"]').length`);
}

async function runSelectionAction(p: BrowserPage, label: string) {
  await p.click("[data-testid='selection-actions-button']");
  await p.waitForSelector("[data-testid='selection-actions-panel']:not(.hidden)");
  await p.click(`button:text('${label}')`);
}

async function setAddModuleSearch(p: BrowserPage, value: string) {
  await p.eval(`(() => {
    const input = document.querySelector('.addSlotSearchInput');
    if (!input) throw new Error('Add Module search input not found');
    input.focus();
    input.value = ${JSON.stringify(value)};
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ${JSON.stringify(value)} }));
  })()`);
}

async function openSessionManager(p: BrowserPage) {
  await p.click("button[aria-label^='Open session patch actions']");
  await p.waitForSelector(".transportUtilityPanel:not(.hidden)");
  await p.click("button:text('Session manager…')");
  await p.waitForFunction(() => document.body.textContent?.includes('Preset Manager') === true);
}

async function findBrowserExecutable() {
  const candidates = [
    process.env.GRIDI_E2E_BROWSER,
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    process.env.CHROME_BIN,
    process.env.CHROMIUM_BIN,
    ...COMMON_BROWSER_PATHS,
  ].filter(Boolean) as string[];
  for (const candidate of candidates) {
    try {
      const { access } = await import("node:fs/promises");
      await access(candidate);
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

class BrowserPage {
  private proc: ChildProcessWithoutNullStreams;
  private profileDir: string;
  private ws: WebSocket;
  private nextId = 1;
  private pending = new Map<number, { resolve: (value: unknown) => void; reject: (reason?: unknown) => void }>();
  private pendingDialog: DialogMode = "accept";

  private constructor(proc: ChildProcessWithoutNullStreams, profileDir: string, ws: WebSocket) {
    this.proc = proc;
    this.profileDir = profileDir;
    this.ws = ws;
    ws.addEventListener("message", (event) => this.onMessage(event));
  }

  static async launch(browserExecutable: string, url: string) {
    const profileDir = await mkdtemp(join(tmpdir(), "gridi-e2e-"));
    const proc = spawn(browserExecutable, [
      ...(process.env.GRIDI_E2E_HEADLESS === "0" ? [] : ["--headless=new"]),
      "--remote-debugging-port=0",
      `--user-data-dir=${profileDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-sandbox",
      "about:blank",
    ]);
    const endpoint = await waitForDevToolsEndpoint(proc);
    const pageWs = await createPageTarget(endpoint, url);
    const ws = await openWebSocket(pageWs);
    const page = new BrowserPage(proc, profileDir, ws);
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    await page.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `localStorage.clear(); sessionStorage.clear(); localStorage.setItem('gridi.settings', ${JSON.stringify(JSON.stringify(SETTINGS_FIXTURE))});`,
    });
    await page.navigate(url);
    await page.installHelpers();
    await page.waitForFunction(() => document.readyState === "complete" && !!document.querySelector("#app"));
    return page;
  }

  async navigate(url: string) {
    await this.send("Page.navigate", { url });
    await this.waitForEvent("Page.loadEventFired", 15_000);
  }

  async installHelpers() {
    await this.eval(`(() => {
      globalThis.__gridiQuery = (selector) => {
        const moduleMatch = selector.match(/^module:(\d+)$/);
        if (moduleMatch) return document.querySelectorAll('.moduleSurface[data-module-id]').item(Number(moduleMatch[1]));
        const textMatch = selector.match(/^(.*):text\('(.+)'\)$/);
        if (textMatch) {
          const base = textMatch[1];
          const text = textMatch[2];
          return Array.from(document.querySelectorAll(base)).find((el) => el.textContent?.trim() === text) ?? null;
        }
        return document.querySelector(selector);
      };
      globalThis.__gridiE2eVisibleTextIncludes = (needle) => {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
          const el = node.parentElement;
          if (!el) continue;
          const style = getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') continue;
          if (node.textContent?.includes(needle)) return true;
        }
        return false;
      };
      globalThis.buttonNamed = (label) => Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.trim() === label) ?? null;
    })()`);
  }

  async eval(expression: string) {
    const response = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    const result = response as { result?: { value?: unknown }; exceptionDetails?: unknown };
    if (result.exceptionDetails) throw new Error(`Browser evaluation failed: ${JSON.stringify(result.exceptionDetails)}`);
    return result.result?.value as any;
  }

  async waitForFunction(fn: (...args: string[]) => unknown, ...args: string[]) {
    const source = `(${fn.toString()})(${args.map((arg) => JSON.stringify(arg)).join(",")})`;
    const deadline = Date.now() + 10_000;
    let lastError: unknown;
    while (Date.now() < deadline) {
      try {
        if (await this.eval(source)) return;
      } catch (error) {
        lastError = error;
      }
      await delay(50);
    }
    throw new Error(`Timed out waiting for browser condition${lastError ? `: ${String(lastError)}` : ""}`);
  }

  async waitForSelector(selector: string) {
    await this.waitForFunction((raw) => Boolean(globalThis.__gridiQuery(raw)), selector);
  }

  async click(selector: string, opts: { ctrlKey?: boolean; metaKey?: boolean } = {}) {
    const clicked = await this.eval(`(() => {
      const el = globalThis.__gridiQuery(${JSON.stringify(selector)});
      if (!el) return false;
      el.scrollIntoView({ block: 'center', inline: 'center' });
      const eventInit = { bubbles: true, cancelable: true, button: 0, ctrlKey: ${Boolean(opts.ctrlKey)}, metaKey: ${Boolean(opts.metaKey)} };
      el.dispatchEvent(new PointerEvent('pointerdown', eventInit));
      el.dispatchEvent(new PointerEvent('pointerup', eventInit));
      el.dispatchEvent(new MouseEvent('click', eventInit));
      return true;
    })()`);
    assert.equal(clicked, true, `could not click ${selector}`);
  }

  async key(key: string, opts: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean } = {}) {
    await this.eval(`(() => {
      const target = document.activeElement || document.body;
      const event = new KeyboardEvent('keydown', {
        key: ${JSON.stringify(key)},
        code: ${JSON.stringify(key.length === 1 ? `Key${key.toUpperCase()}` : key)},
        bubbles: true,
        cancelable: true,
        ctrlKey: ${Boolean(opts.ctrlKey)},
        metaKey: ${Boolean(opts.metaKey)},
        shiftKey: ${Boolean(opts.shiftKey)},
      });
      target.dispatchEvent(event);
    })()`);
  }

  async text(selector: string) {
    return this.eval(`(globalThis.__gridiQuery(${JSON.stringify(selector)})?.textContent ?? '').trim()`);
  }

  async visibleTextIncludes(needle: string) {
    return this.eval(`globalThis.__gridiE2eVisibleTextIncludes(${JSON.stringify(needle)})`);
  }

  nextDialog(mode: DialogMode) {
    this.pendingDialog = mode;
  }

  async close() {
    try { this.ws.close(); } catch {}
    if (!this.proc.killed) this.proc.kill("SIGTERM");
    await rm(this.profileDir, { recursive: true, force: true });
  }

  private send(method: string, params: Record<string, unknown> = {}) {
    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });
    const promise = new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
    this.ws.send(payload);
    return promise;
  }

  private waitForEvent(method: string, timeoutMs: number) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.ws.removeEventListener("message", listener);
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeoutMs);
      const listener = (event: MessageEvent) => {
        const message = JSON.parse(String(event.data)) as CdpMessage;
        if (message.method !== method) return;
        clearTimeout(timeout);
        this.ws.removeEventListener("message", listener);
        resolve(message.params);
      };
      this.ws.addEventListener("message", listener);
    });
  }

  private onMessage(event: MessageEvent) {
    const message = JSON.parse(String(event.data)) as CdpMessage;
    if (message.method === "Page.javascriptDialogOpening") {
      void this.send("Page.handleJavaScriptDialog", { accept: this.pendingDialog === "accept" });
      this.pendingDialog = "accept";
      return;
    }
    if (!message.id) return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    if (message.error) pending.reject(new Error(message.error.message));
    else pending.resolve(message.result);
  }
}

async function waitForDevToolsEndpoint(proc: ChildProcessWithoutNullStreams) {
  let stderr = "";
  const deadline = Date.now() + 15_000;
  return new Promise<string>((resolve, reject) => {
    const timeout = setInterval(() => {
      if (Date.now() > deadline) {
        clearInterval(timeout);
        reject(new Error(`Timed out waiting for DevTools endpoint. Browser stderr:\n${stderr}`));
      }
    }, 100);
    proc.stderr.on("data", (chunk) => {
      stderr += String(chunk);
      const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (!match) return;
      clearInterval(timeout);
      resolve(match[1]);
    });
    proc.on("error", reject);
    proc.on("exit", (code) => reject(new Error(`Browser exited before DevTools endpoint opened: ${code}\n${stderr}`)));
  });
}

async function createPageTarget(browserWsEndpoint: string, url: string) {
  const base = browserWsEndpoint.replace(/^ws:/, "http:").replace(/\/devtools\/browser\/.+$/, "");
  const response = await fetch(`${base}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  if (!response.ok) throw new Error(`Could not create browser tab: HTTP ${response.status}`);
  const info = await response.json() as { webSocketDebuggerUrl?: string };
  assert(info.webSocketDebuggerUrl, "Browser did not return a page WebSocket URL");
  return info.webSocketDebuggerUrl;
}

function openWebSocket(url: string) {
  return new Promise<WebSocket>((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.addEventListener("open", () => resolve(ws));
    ws.addEventListener("error", reject);
  });
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
