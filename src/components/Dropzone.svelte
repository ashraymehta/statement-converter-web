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
  <div class="field">
    <label class="label" for="bank-select">Bank / format</label>
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
    <span class="drop-icon" aria-hidden="true">📂</span>
    <p class="drop-hint">
      {#if dragging}
        Drop your statement file here
      {:else}
        Drag &amp; drop your statement file here, or <strong>click to browse</strong>
      {/if}
    </p>
    <p class="drop-formats">
      Accepted: .xls, .xlsx, .csv, .json, .txt (MT940)
    </p>
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
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    padding: 2rem;
    box-shadow: var(--shadow);
  }

  .label {
    display: block;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.4rem;
  }

  .select {
    width: 100%;
    padding: 0.6rem 0.75rem;
    border: 1.5px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 1rem;
    font-family: inherit;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='%23666' d='M2 5l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.75rem center;
    background-size: 1em;
    cursor: pointer;
  }

  .select:focus {
    outline: 2px solid var(--color-accent);
    outline-offset: 1px;
    border-color: var(--color-accent);
  }

  .drop-area {
    border: 2px dashed var(--color-border);
    border-radius: var(--radius);
    padding: 2.5rem 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    text-align: center;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }

  .drop-area:hover,
  .drop-area--active {
    border-color: var(--color-accent);
    background: var(--color-accent-subtle);
  }

  .drop-area:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  .drop-icon {
    font-size: 2rem;
    line-height: 1;
  }

  .drop-hint {
    margin: 0;
    color: var(--color-text);
    font-size: 0.95rem;
  }

  .drop-formats {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 0.8rem;
  }

  .file-input-hidden {
    display: none;
  }
</style>
