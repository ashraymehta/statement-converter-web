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
      toasts.show('Export failed. See console for details.', 'error');
    }
  }
</script>

<div class="export-bar">
  <div class="export-left">
    <fieldset class="format-group">
      <legend class="format-legend">Export format</legend>
      <label class="format-option">
        <input type="radio" name="format" value="qif" bind:group={format} />
        QIF
      </label>
      <label class="format-option">
        <input type="radio" name="format" value="csv" bind:group={format} />
        CSV
      </label>
    </fieldset>
  </div>

  <div class="export-actions">
    <button class="btn btn--ghost" onclick={onreset}>
      ← Convert another
    </button>
    <button class="btn btn--primary" onclick={download}>
      Download .{format}
    </button>
  </div>
</div>

<style>
  .export-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 1rem;
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    padding: 1.25rem 1.5rem;
    box-shadow: var(--shadow);
  }

  .format-group {
    border: none;
    padding: 0;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 1.25rem;
  }

  .format-legend {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0;
    margin-bottom: 0.5rem;
    float: left;
    width: 100%;
  }

  .format-option {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.95rem;
    cursor: pointer;
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
    font-size: 0.9rem;
    font-family: inherit;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    white-space: nowrap;
  }

  .btn--primary {
    background: var(--color-accent);
    color: #fff;
    border: none;
  }

  .btn--primary:hover {
    background: var(--color-accent-dark);
  }

  .btn--ghost {
    background: none;
    color: var(--color-text-muted);
    border: 1.5px solid var(--color-border);
  }

  .btn--ghost:hover {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }
</style>
