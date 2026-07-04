<script lang="ts">
  import { parse, type Transaction } from './lib/converter/index';
  import type { Bank } from './lib/converter/index';
  import { toasts } from './stores/toast';
  import Dropzone from './components/Dropzone.svelte';
  import PreviewTable from './components/PreviewTable.svelte';
  import ExportBar from './components/ExportBar.svelte';
  import Toasts from './components/Toasts.svelte';

  type AppState = 'idle' | 'parsing' | 'preview';

  let appState = $state<AppState>('idle');
  let transactions = $state<Transaction[]>([]);
  let currentBank = $state<Bank | null>(null);
  let parseError = $state<string | null>(null);

  async function onFile(bank: Bank, file: File) {
    appState = 'parsing';
    parseError = null;
    currentBank = bank;

    try {
      const buffer = await file.arrayBuffer();
      const result = await parse(bank, buffer);
      if (result.length === 0) {
        parseError = 'No transactions found in the file. Check that you selected the right bank.';
        appState = 'idle';
        return;
      }
      transactions = result;
      appState = 'preview';
    } catch (err) {
      console.error('Parse error:', err);
      parseError = err instanceof Error ? err.message : 'Failed to parse the statement. Check format and bank selection.';
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
    currentBank = null;
    parseError = null;
  }
</script>

<div class="layout">
  <header class="header">
    <div class="header-inner">
      <a class="header-brand" href="https://github.com/ashraymehta/statement-converter-web">
        <span class="header-icon" aria-hidden="true">📄</span>
        Statement Converter
      </a>
    </div>
  </header>

  <main class="main">
    <div class="content">
      {#if appState === 'idle'}
        <div class="intro">
          <h1 class="intro-title">Convert bank statements to QIF or CSV</h1>
          <p class="intro-sub">
            Upload a statement, review and edit transactions, then export — all in your browser. Nothing leaves your device.
          </p>
        </div>
        <Dropzone onfile={onFile} />
        {#if parseError}
          <div class="error-banner" role="alert">{parseError}</div>
        {/if}

      {:else if appState === 'parsing'}
        <div class="loading" aria-busy="true">
          <span class="spinner" aria-hidden="true"></span>
          Parsing statement…
        </div>

      {:else if appState === 'preview'}
        <PreviewTable {transactions} onchange={onTransactionsChange} />
        <ExportBar {transactions} bank={currentBank!} onreset={reset} />
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
    background: var(--color-bg);
    color: var(--color-text);
  }

  /* ── Header ──────────────────────────────────────── */
  .header {
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .header-inner {
    max-width: 64rem;
    margin: 0 auto;
    padding: 0.85rem 1.5rem;
    display: flex;
    align-items: center;
  }

  .header-brand {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 700;
    font-size: 1.05rem;
    color: var(--color-text);
    text-decoration: none;
  }

  .header-brand:hover {
    color: var(--color-accent);
  }

  .header-icon {
    font-size: 1.25rem;
  }

  /* ── Main content ────────────────────────────────── */
  .main {
    flex: 1;
    padding: 2rem 1.5rem;
  }

  .content {
    max-width: 64rem;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .intro {
    text-align: center;
    padding: 0.5rem 0 0.5rem;
  }

  .intro-title {
    margin: 0 0 0.5rem;
    font-size: 1.75rem;
    font-weight: 800;
    color: var(--color-text);
  }

  .intro-sub {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 0.975rem;
    max-width: 38rem;
    margin-inline: auto;
  }

  .error-banner {
    background: var(--color-error-bg);
    color: var(--color-error-text);
    border: 1px solid var(--color-error);
    border-radius: var(--radius);
    padding: 0.75rem 1rem;
    font-size: 0.9rem;
  }

  /* ── Loading ─────────────────────────────────────── */
  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 4rem;
    color: var(--color-text-muted);
    font-size: 1rem;
  }

  .spinner {
    display: inline-block;
    width: 1.25rem;
    height: 1.25rem;
    border: 2.5px solid var(--color-border);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
