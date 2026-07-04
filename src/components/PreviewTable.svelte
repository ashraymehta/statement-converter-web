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
    <span class="eyebrow">Ledger &middot; {rows.length} {rows.length === 1 ? 'entry' : 'entries'}</span>
    <button class="btn-add" onclick={addRow}>+ Add entry</button>
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
          <tr class="ledger-row" style="--row-index: {i}">
            <td>
              <input
                type="date"
                class="cell-input mono"
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
                class="cell-input num-input mono"
                class:ink-rust={row.Outflow > 0}
                min="0"
                step="0.01"
                bind:value={rows[i].Outflow}
                oninput={update}
              />
            </td>
            <td>
              <input
                type="number"
                class="cell-input num-input mono"
                class:ink-green={row.Inflow > 0}
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
                aria-label="Remove entry {i + 1}"
                title="Remove entry"
              >&times;</button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<style>
  .preview-wrapper {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    background: var(--color-surface);
    border: 1px solid var(--color-rule);
    border-radius: var(--radius-lg);
    padding: 1.5rem;
  }

  .preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .table-scroll {
    overflow-x: auto;
    border: 1px solid var(--color-rule);
    border-radius: var(--radius);
  }

  .preview-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .preview-table th {
    background: var(--color-surface-alt);
    color: var(--color-ink-muted);
    font-family: var(--font-mono);
    font-weight: 500;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    padding: 0.65rem 0.75rem;
    text-align: left;
    border-bottom: 2px solid var(--color-rule-strong);
    white-space: nowrap;
  }

  .preview-table td {
    padding: 0.3rem 0.4rem;
    border-bottom: 1px solid var(--color-rule);
    vertical-align: middle;
  }

  .preview-table tr:last-child td {
    border-bottom: none;
  }

  /* Alternating rows, subtle parchment tint */
  .ledger-row:nth-child(even) td {
    background: var(--color-paper);
  }

  .ledger-row:hover td {
    background: var(--color-surface-alt);
  }

  .ledger-row {
    animation: post-entry 0.28s ease backwards;
    animation-delay: calc(var(--row-index) * 25ms);
  }

  @keyframes post-entry {
    from { opacity: 0; transform: translateY(3px); }
    to   { opacity: 1; transform: translateY(0); }
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
    color: var(--color-ink);
    font-size: inherit;
    font-family: inherit;
    min-width: 6rem;
    box-sizing: border-box;
  }

  .cell-input:focus-visible {
    outline: none;
    border-color: var(--color-green);
    background: var(--color-surface);
  }

  .num-input {
    min-width: 5.5rem;
    text-align: right;
  }

  .ink-rust {
    color: var(--color-rust);
  }

  .ink-green {
    color: var(--color-green-dark);
  }

  .btn-delete {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-rust);
    font-size: 1.1rem;
    padding: 0.1rem 0.3rem;
    border-radius: var(--radius-sm);
    line-height: 1;
    opacity: 0.55;
  }

  .btn-delete:hover {
    opacity: 1;
    background: var(--color-rust-tint);
  }

  .btn-add {
    background: none;
    border: 1px solid var(--color-rule);
    border-radius: var(--radius);
    color: var(--color-ink-muted);
    cursor: pointer;
    padding: 0.35rem 0.85rem;
    font-family: var(--font-body);
    font-size: 0.85rem;
    font-weight: 500;
    transition: border-color 0.15s, color 0.15s;
    white-space: nowrap;
  }

  .btn-add:hover {
    border-color: var(--color-green);
    color: var(--color-green);
  }
</style>
