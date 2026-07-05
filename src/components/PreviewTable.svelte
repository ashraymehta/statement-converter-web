<script lang="ts">
  import {
    BankLabels,
    applyMapping,
    createEmptyMapping,
    isMappingComplete,
    detectCategoricalColumns,
    guessDateFormat,
    parseCellAsDate,
    parseCellAsNumber,
    extractIndicator,
  } from '../lib/converter/index';
  import type { Bank, Transaction, RawTable, ColumnMapping, ColumnRole, AmountPattern, CellValue } from '../lib/converter/index';
  import { toasts } from '../stores/toast';
  import { tick } from 'svelte';

  type PreviewSource = { kind: 'known'; transactions: Transaction[] } | { kind: 'raw'; table: RawTable };

  interface Props {
    source: PreviewSource;
    bank: Bank | null;
    onchange: (transactions: Transaction[]) => void;
  }

  let { source, bank, onchange }: Props = $props();

  const isRaw = source.kind === 'raw';
  const rawTable = source.kind === 'raw' ? source.table : null;

  type EditableRow = Transaction & { included: boolean };

  // ── Known-bank path: a transaction list already resolved by an adapter ────
  let rows = $state<EditableRow[]>(
    source.kind === 'known' ? source.transactions.map((t) => ({ ...t, Date: new Date(t.Date), included: true })) : [],
  );

  // ── Raw/mapping path: nothing recognised the file, so the user assigns
  //    each column's role directly on the table headers. `rawRows` is a
  //    working copy of the file's cells; once a column gets a role, its
  //    cells are normalised in place (parsed once into a Date/number/string)
  //    so it can be rendered and edited exactly like a known-bank column. ──
  type WorkingCell = CellValue;
  const columnCount = rawTable?.headers.length ?? 0;

  let mapping = $state<ColumnMapping>(createEmptyMapping(columnCount));
  const categorical = rawTable ? detectCategoricalColumns(rawTable) : [];
  let normalized = $state<boolean[]>(Array(columnCount).fill(false));
  // `embeddedIsDebit` preserves the direction extracted from an amount cell
  // like "Dr.1,499.00" at normalisation time (see onRoleChange) — once the
  // cell is overwritten with just the numeric magnitude for editing, that
  // information would otherwise be lost before applyMapping could use it.
  let rawRows = $state<{ cells: WorkingCell[]; included: boolean; embeddedIsDebit?: boolean | null }[]>(
    rawTable ? rawTable.rows.map((cells) => ({ cells: [...cells], included: true })) : [],
  );

  const totalCount = $derived(isRaw ? rawRows.length : rows.length);
  const includedCount = $derived(
    isRaw ? rawRows.filter((r) => r.included).length : rows.filter((r) => r.included).length,
  );
  const allChecked = $derived(totalCount > 0 && includedCount === totalCount);
  const someChecked = $derived(includedCount > 0 && includedCount < totalCount);
  const countLabel = $derived(
    totalCount === 0
      ? '0 entries'
      : includedCount !== totalCount
        ? `${includedCount} of ${totalCount} ${totalCount === 1 ? 'entry' : 'entries'}`
        : `${totalCount} ${totalCount === 1 ? 'entry' : 'entries'}`,
  );
  const mappingReady = $derived(isRaw && isMappingComplete(mapping));

  // ── Known-bank editing ─────────────────────────────────────────────────
  function update() {
    const includedTransactions = rows.filter((r) => r.included).map(({ included, ...transaction }) => transaction);
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

  // ── Raw/mapping editing ────────────────────────────────────────────────
  function amountRoleOptions(): { value: ColumnRole; label: string }[] {
    if (mapping.pattern === 'signed') {
      return [{ value: 'amount', label: 'Amount' }];
    }
    if (mapping.pattern === 'indicator') {
      // 'indicator' is optional here — leave it unassigned when the
      // direction is embedded in the amount cell itself (e.g. "Dr.1,499.00").
      return [
        { value: 'amount', label: 'Amount' },
        { value: 'indicator', label: 'Dr./Cr. column' },
      ];
    }
    return [
      { value: 'outflow', label: 'Outflow' },
      { value: 'inflow', label: 'Inflow' },
    ];
  }

  function roleValidForPattern(role: ColumnRole, pattern: AmountPattern): boolean {
    if (role === 'date' || role === 'payee' || role === 'memo' || role === 'category') return true;
    if (pattern === 'signed') return role === 'amount';
    if (pattern === 'indicator') return role === 'amount' || role === 'indicator';
    return role === 'outflow' || role === 'inflow';
  }

  function roleOptionsFor(): { value: ColumnRole | ''; label: string }[] {
    return [
      { value: '', label: '— Ignore —' },
      { value: 'date', label: 'Date' },
      { value: 'payee', label: 'Payee' },
      { value: 'memo', label: 'Memo' },
      { value: 'category', label: 'Category' },
      ...amountRoleOptions(),
    ];
  }

  async function onRoleChange(columnIndex: number, value: string) {
    const newRole = (value || null) as ColumnRole | null;

    // Roles are unique — assigning one here clears it from wherever it was.
    mapping.roles = mapping.roles.map((r, i) => {
      if (i === columnIndex) return newRole;
      return r === newRole && newRole !== null ? null : r;
    });

    if (newRole === 'date' && !normalized[columnIndex]) {
      const format = guessDateFormat(rawTable!, columnIndex);
      const parsed = rawRows.map((row) => parseCellAsDate(row.cells[columnIndex], format));
      const successCount = parsed.filter((d) => d !== null).length;

      if (rawRows.length > 0 && successCount === 0) {
        // Couldn't parse a single date in this column — revert rather than
        // leave it mapped-but-empty, and tell the user why. Awaiting a tick
        // lets Svelte flush the DOM for the interim 'date' selection first,
        // so the subsequent revert is a genuinely new update the <select>
        // picks up (rather than two writes collapsing into one before paint).
        await tick();
        mapping.roles = mapping.roles.map((r, i) => (i === columnIndex ? null : r));
        toasts.show('Couldn’t read dates in that column — check the file’s date format.', 'error');
        syncFromRawRows();
        return;
      }

      rawRows.forEach((row, i) => {
        row.cells[columnIndex] = parsed[i];
        // A row whose date didn't parse would otherwise stay checked/included
        // while silently being dropped from the export — surface it as an
        // error instead (see hasDateError) and keep `included` truthful.
        if (parsed[i] === null) row.included = false;
      });
      mapping.dateFormat = format;
      normalized[columnIndex] = true;
    } else if ((newRole === 'amount' || newRole === 'outflow' || newRole === 'inflow') && !normalized[columnIndex]) {
      // For the 'indicator' pattern with no separate indicator column, the
      // direction is embedded in this same cell (e.g. "Dr.1,499.00") —
      // extract it now, before overwriting the cell with just the numeric
      // magnitude, or that information is gone by the time applyMapping runs.
      const isEmbeddedIndicator =
        newRole === 'amount' && mapping.pattern === 'indicator' && !mapping.roles.includes('indicator');

      for (const row of rawRows) {
        if (isEmbeddedIndicator) {
          const extracted = extractIndicator(cellText(row.cells[columnIndex]));
          row.cells[columnIndex] = parseCellAsNumber(extracted.cleaned);
          row.embeddedIsDebit = extracted.isDebit;
        } else {
          row.cells[columnIndex] = parseCellAsNumber(row.cells[columnIndex]);
        }
      }
      normalized[columnIndex] = true;
    }

    syncFromRawRows();
  }

  function onPatternChange(newPattern: AmountPattern) {
    mapping.pattern = newPattern;
    mapping.roles = mapping.roles.map((r) => (r && roleValidForPattern(r, newPattern) ? r : null));
    syncFromRawRows();
  }

  /** True once a mapped date column's cell failed to parse for this row — it
   *  can't be included until the user fixes the date (the input stays
   *  editable; see the date <input>'s onchange below). */
  function hasDateError(row: { cells: WorkingCell[] }): boolean {
    const dateCol = mapping.roles.indexOf('date');
    return dateCol !== -1 && row.cells[dateCol] === null;
  }

  function toggleRawRow(i: number) {
    if (hasDateError(rawRows[i])) return; // disabled in the UI; guard defensively too
    rawRows[i].included = !rawRows[i].included;
    syncFromRawRows();
  }

  function toggleAllRaw(value: boolean) {
    rawRows = rawRows.map((r) => ({ ...r, included: hasDateError(r) ? false : value }));
    syncFromRawRows();
  }

  function syncFromRawRows() {
    if (!mappingReady) {
      onchange([]);
      return;
    }

    const included = rawRows.filter((r) => r.included);
    const amountCol = mapping.roles.indexOf('amount');
    const isEmbeddedIndicator =
      mapping.pattern === 'indicator' && amountCol !== -1 && !mapping.roles.includes('indicator');

    if (isEmbeddedIndicator) {
      // applyMapping's embedded-extraction would find nothing here — the
      // cell was already normalised to a bare number (see onRoleChange) and
      // the direction was preserved separately in `embeddedIsDebit`.
      const dateCol = mapping.roles.indexOf('date');
      const payeeCol = mapping.roles.indexOf('payee');
      const memoCol = mapping.roles.indexOf('memo');
      const categoryCol = mapping.roles.indexOf('category');

      const transactions = included.flatMap((row) => {
        const date = row.cells[dateCol];
        if (!(date instanceof Date)) return [];
        const amount = Math.abs(typeof row.cells[amountCol] === 'number' ? (row.cells[amountCol] as number) : 0);
        const isOutflow = row.embeddedIsDebit ?? true;
        const payee = payeeCol !== -1 ? cellText(row.cells[payeeCol]) : '';
        const category = categoryCol !== -1 ? cellText(row.cells[categoryCol]) : '';
        return [
          {
            Payee: payee,
            Outflow: isOutflow ? amount : 0,
            Inflow: isOutflow ? 0 : amount,
            Date: date,
            Memo: memoCol !== -1 ? cellText(row.cells[memoCol]) : payee,
            Category: category || null,
          },
        ];
      });
      onchange(transactions);
      return;
    }

    onchange(applyMapping({ headers: rawTable!.headers, rows: included.map((r) => r.cells) }, mapping));
  }

  function cellText(value: WorkingCell): string {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toLocaleDateString();
    return String(value);
  }

  function dateInputValue(value: WorkingCell): string {
    return value instanceof Date ? formatDate(value) : '';
  }

  function isOutflowSigned(value: WorkingCell): boolean {
    const n = typeof value === 'number' ? value : 0;
    return mapping.negativeIsOutflow ? n < 0 : n >= 0;
  }

  /** Direction for the 'amount'-role cell, accounting for the 'indicator'
   *  pattern (where sign alone doesn't tell you the direction — a separate
   *  or embedded Dr./Cr. signal does). */
  function isAmountOutflow(row: { cells: WorkingCell[]; embeddedIsDebit?: boolean | null }, c: number): boolean {
    if (mapping.pattern === 'indicator') {
      const indicatorCol = mapping.roles.indexOf('indicator');
      if (indicatorCol !== -1) {
        const debitWords = (mapping.debitIndicatorValues ?? ['dr', 'debit']).map((w) => w.toLowerCase());
        const text = cellText(row.cells[indicatorCol]).trim().toLowerCase().replace(/\.$/, '');
        return debitWords.includes(text);
      }
      return row.embeddedIsDebit ?? true;
    }
    return isOutflowSigned(row.cells[c]);
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
      {#if bank}
        Ledger &middot; {BankLabels[bank]} &middot; {countLabel}
      {:else if isRaw && !mappingReady}
        Ledger &middot; assign columns below to build your ledger
      {:else}
        Ledger &middot; custom mapping &middot; {countLabel}
      {/if}
    </span>
  </div>

  {#if isRaw}
    <div class="pattern-toggle">
      <span class="eyebrow">Amounts</span>
      <label class="pattern-option">
        <input
          type="radio"
          name="amount-pattern"
          checked={mapping.pattern === 'signed'}
          onchange={() => onPatternChange('signed')}
        />
        One amount column
      </label>
      <label class="pattern-option">
        <input
          type="radio"
          name="amount-pattern"
          checked={mapping.pattern === 'split'}
          onchange={() => onPatternChange('split')}
        />
        Separate money in / out
      </label>
      <label class="pattern-option">
        <input
          type="radio"
          name="amount-pattern"
          checked={mapping.pattern === 'indicator'}
          onchange={() => onPatternChange('indicator')}
        />
        Amount + separate Dr./Cr. column
      </label>
      {#if mapping.pattern === 'signed'}
        <label class="pattern-option">
          <input
            type="checkbox"
            checked={mapping.negativeIsOutflow}
            onchange={(e) => {
              mapping.negativeIsOutflow = (e.target as HTMLInputElement).checked;
              syncFromRawRows();
            }}
          />
          Negative values are money out
        </label>
      {/if}
    </div>
  {/if}

  <div class="table-scroll">
    <table class="preview-table">
      <thead>
        <tr>
          <th class="checkbox-col">
            {#if isRaw}
              <input
                type="checkbox"
                class="row-toggle"
                checked={allChecked}
                use:indeterminate={someChecked}
                onchange={(e) => toggleAllRaw((e.target as HTMLInputElement).checked)}
                aria-label="Include all entries in conversion"
              />
            {:else}
              <input
                type="checkbox"
                class="row-toggle"
                checked={allChecked}
                use:indeterminate={someChecked}
                onchange={(e) => toggleAll((e.target as HTMLInputElement).checked)}
                aria-label="Include all entries in conversion"
              />
            {/if}
          </th>

          {#if isRaw}
            {#each rawTable!.headers as header, c}
              <th class="mapped-header" class:mapped-header--assigned={mapping.roles[c] !== null}>
                <div class="header-label">{header}</div>
                <select
                  class="role-select"
                  value={mapping.roles[c] ?? ''}
                  onchange={(e) => onRoleChange(c, (e.target as HTMLSelectElement).value)}
                >
                  {#each roleOptionsFor() as opt}
                    <option value={opt.value}>{opt.label}</option>
                  {/each}
                </select>
              </th>
            {/each}
          {:else}
            <th>Date</th>
            <th>Payee</th>
            <th>Memo</th>
            <th class="num-col">Outflow</th>
            <th class="num-col">Inflow</th>
            <th>Category</th>
          {/if}
        </tr>
      </thead>
      <tbody>
        {#if isRaw}
          {#each rawRows as row, i (i)}
            <tr
              class="ledger-row"
              class:ledger-row--excluded={!row.included}
              class:ledger-row--error={hasDateError(row)}
              style="--row-index: {i}"
            >
              <td class="checkbox-col">
                <input
                  type="checkbox"
                  class="row-toggle"
                  checked={row.included}
                  disabled={hasDateError(row)}
                  title={hasDateError(row) ? 'Fix the date to include this entry' : undefined}
                  onchange={() => toggleRawRow(i)}
                  aria-label="Include entry {i + 1} in conversion"
                />
              </td>
              {#each rawTable!.headers as _, c}
                <td>
                  {#if mapping.roles[c] === null}
                    {#if categorical[c]}
                      <span class="pill">{cellText(row.cells[c])}</span>
                    {:else}
                      <span class="raw-text mono">{cellText(row.cells[c])}</span>
                    {/if}
                  {:else if mapping.roles[c] === 'date'}
                    <input
                      type="date"
                      class="cell-input mono"
                      class:cell-input--error={hasDateError(row)}
                      value={dateInputValue(row.cells[c])}
                      onchange={(e) => {
                        row.cells[c] = parseDate((e.target as HTMLInputElement).value);
                        row.included = true;
                        syncFromRawRows();
                      }}
                    />
                    {#if hasDateError(row)}
                      <span class="cell-error">Couldn’t read this date — edit to fix</span>
                    {/if}
                  {:else if mapping.roles[c] === 'amount'}
                    <input
                      type="number"
                      class="cell-input num-input mono"
                      class:ink-rust={isAmountOutflow(row, c)}
                      class:ink-green={!isAmountOutflow(row, c)}
                      step="0.01"
                      value={row.cells[c]}
                      oninput={(e) => {
                        row.cells[c] = Number((e.target as HTMLInputElement).value);
                        syncFromRawRows();
                      }}
                    />
                  {:else if mapping.roles[c] === 'outflow' || mapping.roles[c] === 'inflow'}
                    <input
                      type="number"
                      class="cell-input num-input mono"
                      class:ink-rust={mapping.roles[c] === 'outflow'}
                      class:ink-green={mapping.roles[c] === 'inflow'}
                      min="0"
                      step="0.01"
                      value={row.cells[c]}
                      oninput={(e) => {
                        row.cells[c] = Number((e.target as HTMLInputElement).value);
                        syncFromRawRows();
                      }}
                    />
                  {:else}
                    <input
                      type="text"
                      class="cell-input"
                      value={cellText(row.cells[c])}
                      oninput={(e) => {
                        row.cells[c] = (e.target as HTMLInputElement).value;
                        syncFromRawRows();
                      }}
                    />
                  {/if}
                </td>
              {/each}
            </tr>
          {/each}
        {:else}
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
                <input type="text" class="cell-input" bind:value={rows[i].Payee} oninput={update} placeholder="Payee" />
              </td>
              <td>
                <input type="text" class="cell-input" bind:value={rows[i].Memo} oninput={update} placeholder="Memo" />
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
        {/if}
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

  .pattern-toggle {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1.25rem;
    padding: 0.75rem 1rem;
    background: var(--color-surface-alt);
    border: 1px solid var(--color-rule);
    border-radius: var(--radius);
  }

  .pattern-option {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
    color: var(--color-ink);
    cursor: pointer;
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

  /* Error rows stay fully visible (unlike plain excluded rows) since they
     need the user's attention — a tinted background rather than dimming. */
  .ledger-row--error {
    opacity: 1;
  }

  .ledger-row--error td {
    background: var(--color-rust-tint);
  }

  .ledger-row--error:hover td {
    background: var(--color-rust-tint);
  }

  .cell-input--error {
    border-color: var(--color-rust);
  }

  .cell-error {
    display: block;
    margin-top: 0.15rem;
    font-size: 0.68rem;
    color: var(--color-rust);
    white-space: nowrap;
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

  /* ── Unmapped raw cell display ─────────────────────────────────────── */
  .pill {
    display: inline-block;
    padding: 0.15rem 0.55rem;
    border-radius: 999px;
    background: var(--color-surface-alt);
    color: var(--color-ink-muted);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    white-space: nowrap;
  }

  .raw-text {
    color: var(--color-ink-muted);
    font-size: 0.82rem;
    padding: 0 0.4rem;
  }

  /* ── Interactive mapping headers ───────────────────────────────────── */
  .mapped-header {
    vertical-align: top;
    padding: 0.5rem 0.6rem;
  }

  .header-label {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    text-transform: none;
    letter-spacing: 0;
    color: var(--color-ink-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 10rem;
    margin-bottom: 0.35rem;
  }

  .mapped-header--assigned .header-label {
    color: var(--color-green-dark);
    font-weight: 600;
  }

  .role-select {
    width: 100%;
    padding: 0.3rem 1.4rem 0.3rem 0.5rem;
    border: 1px solid var(--color-rule-strong);
    border-radius: var(--radius-sm);
    background-color: var(--color-surface);
    color: var(--color-ink-muted);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    text-transform: none;
    letter-spacing: 0;
    font-weight: 500;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='%235b6b60' d='M2 5l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.4rem center;
    background-size: 0.7em;
    cursor: pointer;
  }

  .mapped-header--assigned .role-select {
    border-color: var(--color-green);
    color: var(--color-green-dark);
  }

  .role-select:focus-visible {
    border-color: var(--color-green);
  }
</style>
