<script lang="ts">
  import { Bank, BankLabels } from '../lib/converter/index';

  interface Props {
    onfile: (bank: Bank, file: File) => void;
  }

  let { onfile }: Props = $props();

  // Banks sorted alphabetically by label
  const bankOptions = Object.values(Bank)
    .map((value) => ({ value, label: BankLabels[value] }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const acceptedFormats = ['.xls', '.xlsx', '.csv', '.json', '.txt'];

  let selectedBank = $state<Bank>(Bank.ABN);
  let dragging = $state(false);
  let fileInput = $state<HTMLInputElement | undefined>(undefined);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    onfile(selectedBank, files[0]);
  }

  function onDragover(e: DragEvent) {
    e.preventDefault();
    dragging = true;
  }

  function onDragleave() {
    dragging = false;
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    dragging = false;
    handleFiles(e.dataTransfer?.files ?? null);
  }

  function onInputChange(e: Event) {
    handleFiles((e.target as HTMLInputElement).files);
    if (fileInput) fileInput.value = '';
  }

  function openPicker() {
    fileInput?.click();
  }
</script>

<div class="dropzone-card">
  <span class="stamp" aria-hidden="true">Private<br />Local only</span>

  <div class="field">
    <label class="eyebrow field-label" for="bank-select">Statement from</label>
    <select id="bank-select" class="select" bind:value={selectedBank}>
      {#each bankOptions as opt}
        <option value={opt.value}>{opt.label}</option>
      {/each}
    </select>
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="drop-area"
    class:drop-area--active={dragging}
    ondragover={onDragover}
    ondragleave={onDragleave}
    ondrop={onDrop}
    role="button"
    tabindex="0"
    aria-label="Drop statement file here or click to browse"
    onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && openPicker()}
    onclick={openPicker}
  >
    <span class="drop-plus" aria-hidden="true">+</span>
    <p class="drop-hint">
      {#if dragging}
        Drop it right here
      {:else}
        Drag your statement here, or <strong>click to browse</strong>
      {/if}
    </p>
    <div class="format-chips">
      {#each acceptedFormats as fmt}
        <span class="format-chip mono">{fmt}</span>
      {/each}
    </div>
  </div>

  <input
    bind:this={fileInput}
    type="file"
    accept=".xls,.xlsx,.csv,.json,.txt,.sta,.mt940"
    class="file-input-hidden"
    onchange={onInputChange}
  />
</div>

<style>
  .dropzone-card {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    background: var(--color-surface);
    border: 1px solid var(--color-rule);
    border-radius: var(--radius-lg);
    padding: 2rem;
  }

  .stamp {
    position: absolute;
    top: -0.6rem;
    right: 1.5rem;
    transform: rotate(-4deg);
    border: 1.5px solid var(--color-rust);
    border-radius: var(--radius-sm);
    padding: 0.3rem 0.6rem;
    font-family: var(--font-mono);
    font-size: 0.62rem;
    font-weight: 500;
    line-height: 1.25;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-rust);
    background: var(--color-surface);
    pointer-events: none;
  }

  .field-label {
    display: block;
    margin-bottom: 0.5rem;
  }

  .select {
    width: 100%;
    padding: 0.6rem 0.75rem;
    border: 1px solid var(--color-rule);
    border-radius: var(--radius);
    background-color: var(--color-paper);
    color: var(--color-ink);
    font-family: var(--font-body);
    font-size: 1rem;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='%235b6b60' d='M2 5l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.75rem center;
    background-size: 0.9em;
    cursor: pointer;
  }

  .select:focus-visible {
    border-color: var(--color-green);
  }

  .drop-area {
    border: 1.5px dashed var(--color-rule-strong);
    border-radius: var(--radius);
    padding: 2.25rem 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.65rem;
    text-align: center;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }

  .drop-area:hover,
  .drop-area--active {
    border-color: var(--color-green);
    background: var(--color-green-tint);
  }

  .drop-plus {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border: 1.5px solid var(--color-rule-strong);
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
    font-size: 1.1rem;
    line-height: 1;
    color: var(--color-ink-muted);
  }

  .drop-area:hover .drop-plus,
  .drop-area--active .drop-plus {
    border-color: var(--color-green);
    color: var(--color-green);
  }

  .drop-hint {
    margin: 0;
    color: var(--color-ink);
    font-size: 0.95rem;
  }

  .format-chips {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.4rem;
    margin-top: 0.15rem;
  }

  .format-chip {
    font-size: 0.7rem;
    color: var(--color-ink-muted);
    border: 1px solid var(--color-rule);
    border-radius: var(--radius-sm);
    padding: 0.15rem 0.4rem;
  }

  .file-input-hidden {
    display: none;
  }
</style>
