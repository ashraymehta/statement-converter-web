<script lang="ts">
  import type { Transaction } from '../lib/converter/index';

  interface Props {
    transactions: Transaction[];
    onchange: (transactions: Transaction[]) => void;
  }

  let { transactions, onchange }: Props = $props();

  // Make a local mutable copy so edits update independently
  let rows = $state(transactions.map((t) => ({ ...t, Date: new Date(t.Date) })));

  function update() {
    onchange(rows.map((r) => ({ ...r })));
  }

  function deleteRow(index: number) {
    rows = rows.filter((_, i) => i !== index);
    update();
  }

  function addRow() {
    rows = [
      ...rows,
      {
        Payee: '',
        Outflow: 0,
        Inflow: 0,
        Date: new Date(),
        Memo: '',
        Category: null,
      },
    ];
    update();
  }

  function formatDate(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function parseDate(s: string): Date {
    const d = new Date(s);
    return isNaN(d.getTime()) ? new Date() : d;
  }
</script>

<div class="preview-wrapper">
  <div class="preview-header">
    <h2 class="preview-title">Preview &amp; edit transactions</h2>
    <span class="row-count">{rows.length} row{rows.length !== 1 ? 's' : ''}</span>
  </div>

  <div class="table-scroll">
    <table class="preview-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Payee</th>
          <th>Memo</th>
          <th class="num-col">Outflow</th>
          <th class="num-col">Inflow</th>
          <th>Category</th>
          <th class="action-col" aria-label="Actions"></th>
        </tr>
      </thead>
      <tbody>
        {#each rows as row, i (i)}
          <tr>
            <td>
              <input
                type="date"
                class="cell-input"
                value={formatDate(row.Date)}
                onchange={(e) => {
                  rows[i].Date = parseDate((e.target as HTMLInputElement).value);
                  update();
                }}
              />
            </td>
            <td>
              <input
                type="text"
                class="cell-input"
                bind:value={rows[i].Payee}
                oninput={update}
                placeholder="Payee"
              />
            </td>
            <td>
              <input
                type="text"
                class="cell-input"
                bind:value={rows[i].Memo}
                oninput={update}
                placeholder="Memo"
              />
            </td>
            <td>
              <input
                type="number"
                class="cell-input num-input"
                min="0"
                step="0.01"
                bind:value={rows[i].Outflow}
                oninput={update}
              />
            </td>
            <td>
              <input
                type="number"
                class="cell-input num-input"
                min="0"
                step="0.01"
                bind:value={rows[i].Inflow}
                oninput={update}
              />
            </td>
            <td>
              <input
                type="text"
                class="cell-input"
                value={row.Category ?? ''}
                oninput={(e) => {
                  rows[i].Category = (e.target as HTMLInputElement).value || null;
                  update();
                }}
                placeholder="Category"
              />
            </td>
            <td>
              <button
                class="btn-delete"
                onclick={() => deleteRow(i)}
                aria-label="Delete row {i + 1}"
                title="Delete row"
              >×</button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <div class="preview-footer">
    <button class="btn-add" onclick={addRow}>+ Add row</button>
  </div>
</div>

<style>
  .preview-wrapper {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    padding: 1.5rem;
    box-shadow: var(--shadow);
  }

  .preview-header {
    display: flex;
    align-items: baseline;
    gap: 1rem;
  }

  .preview-title {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--color-text);
  }

  .row-count {
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }

  .table-scroll {
    overflow-x: auto;
    border-radius: var(--radius);
    border: 1px solid var(--color-border);
  }

  .preview-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .preview-table th {
    background: var(--color-surface-raised);
    color: var(--color-text-muted);
    font-weight: 600;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.6rem 0.75rem;
    text-align: left;
    border-bottom: 1px solid var(--color-border);
    white-space: nowrap;
  }

  .preview-table td {
    padding: 0.3rem 0.4rem;
    border-bottom: 1px solid var(--color-border-subtle);
    vertical-align: middle;
  }

  .preview-table tr:last-child td {
    border-bottom: none;
  }

  .preview-table tr:hover td {
    background: var(--color-accent-subtle);
  }

  .num-col {
    text-align: right;
  }

  .action-col {
    width: 2.5rem;
  }

  .cell-input {
    width: 100%;
    padding: 0.35rem 0.4rem;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-text);
    font-size: inherit;
    font-family: inherit;
    min-width: 6rem;
    box-sizing: border-box;
  }

  .cell-input:focus {
    outline: none;
    border-color: var(--color-accent);
    background: var(--color-bg);
  }

  .num-input {
    min-width: 5rem;
    text-align: right;
  }

  .btn-delete {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-error);
    font-size: 1.1rem;
    padding: 0.1rem 0.3rem;
    border-radius: var(--radius-sm);
    line-height: 1;
    opacity: 0.6;
  }

  .btn-delete:hover {
    opacity: 1;
    background: var(--color-error-bg);
  }

  .preview-footer {
    display: flex;
    justify-content: flex-start;
  }

  .btn-add {
    background: none;
    border: 1.5px dashed var(--color-border);
    border-radius: var(--radius);
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 0.4rem 1rem;
    font-size: 0.875rem;
    font-family: inherit;
    transition: border-color 0.15s, color 0.15s;
  }

  .btn-add:hover {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }
</style>
