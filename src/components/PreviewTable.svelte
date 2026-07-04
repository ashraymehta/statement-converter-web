<script lang="ts">
  import type { Transaction } from '../lib/converter/index';

  interface Props {
    transactions: Transaction[];
    onchange: (transactions: Transaction[]) => void;
  }

  let { transactions, onchange }: Props = $props();

  type EditableRow = Transaction & { included: boolean };

  // Make a local mutable copy so edits update independently.
  // `included` is UI-only state — unchecked rows stay visible here but
  // are filtered out before being reported upstream for conversion.
  let rows = $state<EditableRow[]>(
    transactions.map((t) => ({ ...t, Date: new Date(t.Date), included: true })),
  );

  let includedCount = $derived(rows.filter((r) => r.included).length);
  let allChecked = $derived(rows.length > 0 && includedCount === rows.length);
  let someChecked = $derived(includedCount > 0 && includedCount < rows.length);

  function update() {
    const includedTransactions = rows
      .filter((r) => r.included)
      .map(({ included, ...transaction }) => transaction);
    onchange(includedTransactions);
  }

  function toggleRow(i: number) {
    rows[i].included = !rows[i].included;
    update();
  }

  function toggleAll(value: boolean) {
    rows = rows.map((r) => ({ ...r, included: value }));
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

  // Svelte action: keeps a checkbox's indeterminate DOM property in sync
  function indeterminate(node: HTMLInputElement, value: boolean) {
    node.indeterminate = value;
    return {
      update(value: boolean) {
        node.indeterminate = value;
      },
    };
  }
</script>

<div class="preview-wrapper">
  <div class="preview-header">
    <span class="eyebrow">
      Ledger &middot;
      {#if rows.length > 0 && includedCount !== rows.length}
        {includedCount} of {rows.length} {rows.length === 1 ? 'entry' : 'entries'}
      {:else}
        {rows.length} {rows.length === 1 ? 'entry' : 'entries'}
      {/if}
    </span>
  </div>

  <div class="table-scroll">
    <table class="preview-table">
      <thead>
        <tr>
          <th class="checkbox-col">
            <input
              type="checkbox"
              class="row-toggle"
              checked={allChecked}
              use:indeterminate={someChecked}
              onchange={(e) => toggleAll((e.target as HTMLInputElement).checked)}
              aria-label="Include all entries in conversion"
            />
          </th>
          <th>Date</th>
          <th>Payee</th>
          <th>Memo</th>
          <th class="num-col">Outflow</th>
          <th class="num-col">Inflow</th>
          <th>Category</th>
        </tr>
      </thead>
      <tbody>
        {#each rows as row, i (i)}
          <tr class="ledger-row" class:ledger-row--excluded={!row.included} style="--row-index: {i}">
            <td class="checkbox-col">
              <input
                type="checkbox"
                class="row-toggle"
                checked={row.included}
                onchange={() => toggleRow(i)}
                aria-label="Include entry {i + 1} in conversion"
              />
            </td>
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
  }

  .table-scroll {
    overflow-x: auto;
    border: 1px solid var(--color-rule);
    border-radius: var(--radius);
  }

  /* Sheet-like grid — full cell borders, no zebra striping */
  .preview-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .preview-table th,
  .preview-table td {
    border: 1px solid var(--color-rule);
  }

  .preview-table thead th {
    border-bottom: 2px solid var(--color-rule-strong);
  }

  .preview-table tr:first-child td {
    border-top: none;
  }

  .table-scroll table tr :is(th, td):first-child {
    border-left: none;
  }

  .table-scroll table tr :is(th, td):last-child {
    border-right: none;
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
    white-space: nowrap;
  }

  .preview-table td {
    padding: 0.3rem 0.4rem;
    vertical-align: middle;
  }

  .ledger-row:hover td {
    background: var(--color-surface-alt);
  }

  .ledger-row--excluded {
    opacity: 0.5;
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

  .checkbox-col {
    width: 2.5rem;
    text-align: center;
  }

  .row-toggle {
    width: 1rem;
    height: 1rem;
    accent-color: var(--color-green);
    cursor: pointer;
    vertical-align: middle;
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

  /* Hide the native calendar picker glyph while keeping the field functional */
  .cell-input[type='date']::-webkit-calendar-picker-indicator {
    display: none;
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
</style>
