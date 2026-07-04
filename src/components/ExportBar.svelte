<script lang="ts">
  import { toQif, toCsv } from '../lib/converter/index';
  import { toasts } from '../stores/toast';
  import type { Transaction } from '../lib/converter/index';
  import type { Bank } from '../lib/converter/index';

  interface Props {
    transactions: Transaction[];
    bank: Bank;
    onreset: () => void;
  }

  let { transactions, bank, onreset }: Props = $props();

  type Format = 'qif' | 'csv';
  let format = $state<Format>('qif');

  function download() {
    try {
      let content: string;
      let mime: string;
      let ext: string;

      if (format === 'qif') {
        content = toQif(transactions);
        mime = 'application/qif';
        ext = 'qif';
      } else {
        content = toCsv(transactions);
        mime = 'text/csv';
        ext = 'csv';
      }

      const filename = `${bank}-converted-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.${ext}`;
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      toasts.show(`Downloaded ${filename}`);
    } catch (err) {
      console.error('Export failed:', err);
      toasts.show('Couldn’t export the file. Check the console for details.', 'error');
    }
  }
</script>

<div class="export-bar">
  <div class="format-field">
    <span class="eyebrow">Export as</span>
    <div class="format-toggle" role="radiogroup" aria-label="Export format">
      <button
        type="button"
        class="format-option mono"
        class:format-option--active={format === 'qif'}
        role="radio"
        aria-checked={format === 'qif'}
        onclick={() => (format = 'qif')}
      >QIF</button>
      <button
        type="button"
        class="format-option mono"
        class:format-option--active={format === 'csv'}
        role="radio"
        aria-checked={format === 'csv'}
        onclick={() => (format = 'csv')}
      >CSV</button>
    </div>
  </div>

  <div class="export-actions">
    <button class="btn btn--ghost" onclick={onreset}>
      New statement
    </button>
    <button
      class="btn btn--primary"
      onclick={download}
      disabled={transactions.length === 0}
      title={transactions.length === 0 ? 'Select at least one entry to export' : undefined}
    >
      Download <span class="mono">.{format}</span>
    </button>
  </div>
</div>

<style>
  .export-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 1.25rem;
    background: var(--color-surface);
    border: 1px solid var(--color-rule);
    border-radius: var(--radius-lg);
    padding: 1.25rem 1.5rem;
  }

  .format-field {
    display: flex;
    align-items: center;
    gap: 0.85rem;
  }

  .format-toggle {
    display: flex;
    gap: 0.4rem;
  }

  .format-option {
    background: none;
    border: 1.5px solid var(--color-rule-strong);
    border-radius: var(--radius-sm);
    color: var(--color-ink-muted);
    padding: 0.3rem 0.7rem;
    font-size: 0.78rem;
    font-weight: 500;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }

  .format-option:hover {
    border-color: var(--color-green);
    color: var(--color-green);
  }

  .format-option--active {
    background: var(--color-green);
    border-color: var(--color-green);
    color: #fff;
  }

  .format-option--active:hover {
    color: #fff;
  }

  .export-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .btn {
    padding: 0.55rem 1.25rem;
    border-radius: var(--radius);
    font-family: var(--font-body);
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    white-space: nowrap;
  }

  .btn--primary {
    background: var(--color-green);
    color: #fff;
    border: 1px solid var(--color-green);
  }

  .btn--primary:hover {
    background: var(--color-green-dark);
    border-color: var(--color-green-dark);
  }

  .btn--primary:disabled {
    background: var(--color-rule-strong);
    border-color: var(--color-rule-strong);
    color: var(--color-ink-muted);
    cursor: not-allowed;
  }

  .btn--primary:disabled:hover {
    background: var(--color-rule-strong);
    border-color: var(--color-rule-strong);
  }

  .btn--ghost {
    background: none;
    color: var(--color-ink);
    border: 1px solid var(--color-rule-strong);
  }

  .btn--ghost:hover {
    border-color: var(--color-green);
    color: var(--color-green);
  }
</style>
