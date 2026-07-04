<script lang="ts">
  import { toasts } from '../stores/toast';
</script>

<div class="toast-container" aria-live="polite">
  {#each $toasts as toast (toast.id)}
    <div class="toast toast--{toast.type}" role="alert">
      <span class="toast__message">{toast.message}</span>
      <button class="toast__close" onclick={() => toasts.remove(toast.id)} aria-label="Dismiss">×</button>
    </div>
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    top: 1.25rem;
    right: 1.25rem;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: 22rem;
  }

  .toast {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-radius: var(--radius);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    font-size: 0.9rem;
    animation: slide-in 0.2s ease;
  }

  .toast--success {
    background: var(--color-success-bg);
    color: var(--color-success-text);
    border-left: 4px solid var(--color-success);
  }

  .toast--error {
    background: var(--color-error-bg);
    color: var(--color-error-text);
    border-left: 4px solid var(--color-error);
  }

  .toast__close {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.2rem;
    line-height: 1;
    padding: 0;
    color: inherit;
    opacity: 0.7;
    flex-shrink: 0;
  }

  .toast__close:hover {
    opacity: 1;
  }

  @keyframes slide-in {
    from { transform: translateX(110%); opacity: 0; }
    to   { transform: translateX(0);    opacity: 1; }
  }
</style>
