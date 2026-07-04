<script lang="ts">
  import { detect, readGenericSheet, type Transaction, type RawTable } from './lib/converter/index';
  import type { Bank } from './lib/converter/index';
  import { toasts } from './stores/toast';
  import Dropzone from './components/Dropzone.svelte';
  import PreviewTable from './components/PreviewTable.svelte';
  import ExportBar from './components/ExportBar.svelte';
  import Toasts from './components/Toasts.svelte';

  type AppState = 'idle' | 'parsing' | 'preview';

  let appState = $state<AppState>('idle');
  let transactions = $state<Transaction[]>([]);
  let rawTable = $state<RawTable | null>(null);
  let currentBank = $state<Bank | null>(null);
  let parseError = $state<string | null>(null);

  async function onFile(file: File) {
    appState = 'parsing';
    parseError = null;
    currentBank = null;
    rawTable = null;
    transactions = [];

    try {
      const buffer = await file.arrayBuffer();
      const detected = await detect(buffer);

      if (detected) {
        currentBank = detected.bank;
        transactions = detected.transactions;
        appState = 'preview';
        return;
      }

      // No known bank matched — fall back to letting the user map the
      // columns themselves, as long as the file is at least tabular.
      const table = readGenericSheet(buffer);
      if (table) {
        rawTable = table;
        appState = 'preview';
        return;
      }

      parseError = "This file doesn't look like a spreadsheet we can read. Double-check the format and try again.";
      appState = 'idle';
    } catch (err) {
      console.error('Parse error:', err);
      parseError = 'Couldn’t read this file. Check the format and try again.';
      appState = 'idle';
      toasts.show(parseError, 'error');
    }
  }

  function onTransactionsChange(updated: Transaction[]) {
    transactions = updated;
  }

  function reset() {
    appState = 'idle';
    transactions = [];
    rawTable = null;
    currentBank = null;
    parseError = null;
  }
</script>

<div class="layout">
  <header class="header">
    <div class="header-inner">
      <a class="brand" href="https://github.com/ashraymehta/statement-converter-web" aria-label="Statement Converter — view source on GitHub">
        <svg class="brand-mark" width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden="true">
          <line x1="4" y1="7" x2="24" y2="7" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          <line x1="4" y1="14" x2="19" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          <line x1="4" y1="21" x2="14" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          <path d="M17 20 L20.5 24 L26 14.5" stroke="var(--color-green)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span class="brand-name">Statement Converter</span>
      </a>

      <div class="status-pill status-pill--{appState}">
        <span class="status-dot" aria-hidden="true"></span>
        {#if appState === 'idle'}
          Ready
        {:else if appState === 'parsing'}
          Reading&hellip;
        {:else if rawTable && transactions.length === 0}
          Mapping columns&hellip;
        {:else}
          Reviewing {transactions.length} {transactions.length === 1 ? 'entry' : 'entries'}
        {/if}
      </div>
    </div>
  </header>

  <main class="main">
    <div class="content" class:content--wide={appState === 'preview' && !!rawTable}>
      {#if appState === 'idle'}
        <div class="intro">
          <h1 class="intro-title">Turn any statement into a clean ledger.</h1>
          <p class="intro-sub">
            Drop a file — we'll recognise the format automatically, or let you map its columns
            if it's from a bank we don't know yet. Everything happens on your device.
          </p>
        </div>
        <Dropzone onfile={onFile} />
        {#if parseError}
          <div class="error-banner" role="alert">{parseError}</div>
        {/if}

      {:else if appState === 'parsing'}
        <div class="loading" aria-busy="true" aria-live="polite">
          <span class="ink-track" aria-hidden="true"><span class="ink-fill"></span></span>
          <p class="loading-label">Reading your statement&hellip;</p>
        </div>

      {:else if appState === 'preview'}
        {#if rawTable}
          <PreviewTable source={{ kind: 'raw', table: rawTable }} bank={null} onchange={onTransactionsChange} />
        {:else}
          <PreviewTable source={{ kind: 'known', transactions }} bank={currentBank} onchange={onTransactionsChange} />
        {/if}
        <ExportBar {transactions} bank={currentBank} onreset={reset} />
      {/if}
    </div>
  </main>

  <Toasts />
</div>

<style>
  .layout {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    color: var(--color-ink);
    background: var(--color-paper);
  }

  /* ── Header ──────────────────────────────────────── */
  .header {
    background: var(--color-surface);
    border-bottom: 2px solid var(--color-rule-strong);
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .header-inner {
    max-width: 60rem;
    margin: 0 auto;
    padding: 0.9rem 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    text-decoration: none;
    color: var(--color-ink);
  }

  .brand-mark {
    color: var(--color-ink);
    flex-shrink: 0;
  }

  .brand-name {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 1.05rem;
    letter-spacing: -0.01em;
  }

  .brand:hover .brand-mark,
  .brand:hover .brand-name {
    color: var(--color-green);
  }

  .status-pill {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    color: var(--color-ink-muted);
    white-space: nowrap;
  }

  .status-dot {
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 50%;
    background: var(--color-ink-muted);
    flex-shrink: 0;
  }

  .status-pill--idle .status-dot { background: var(--color-ink-muted); }
  .status-pill--parsing .status-dot { background: var(--color-green); animation: pulse 1s ease-in-out infinite; }
  .status-pill--preview .status-dot { background: var(--color-green); }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.35; }
  }

  /* ── Main content ────────────────────────────────── */
  .main {
    flex: 1;
    padding: 2.5rem 1.5rem 4rem;
  }

  .content {
    max-width: 60rem;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    transition: max-width 0.2s ease;
  }

  /* Unknown-format tables can have any number of columns — give them more
     room than the fixed-width known-bank ledger needs. */
  .content--wide {
    max-width: 96rem;
  }

  .intro {
    text-align: center;
    padding: 0.5rem 0 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  .intro-title {
    margin: 0;
    font-size: clamp(1.6rem, 1.2rem + 1.5vw, 2.15rem);
    font-weight: 700;
    letter-spacing: -0.015em;
    color: var(--color-ink);
  }

  .intro-sub {
    color: var(--color-ink-muted);
    font-size: 1rem;
    max-width: 34rem;
    margin-inline: auto;
  }

  .error-banner {
    background: var(--color-rust-tint);
    color: var(--color-rust);
    border-left: 3px solid var(--color-rust);
    border-radius: var(--radius-sm);
    padding: 0.75rem 1rem;
    font-size: 0.9rem;
  }

  /* ── Loading ─────────────────────────────────────── */
  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 5rem 1rem;
  }

  .loading-label {
    color: var(--color-ink-muted);
    font-size: 0.95rem;
  }

  .ink-track {
    display: block;
    width: 14rem;
    height: 3px;
    background: var(--color-rule);
    border-radius: 99px;
    overflow: hidden;
    position: relative;
  }

  .ink-fill {
    position: absolute;
    inset: 0;
    width: 40%;
    background: var(--color-green);
    border-radius: 99px;
    animation: ink-sweep 1.1s ease-in-out infinite;
  }

  @keyframes ink-sweep {
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(350%); }
  }
</style>
