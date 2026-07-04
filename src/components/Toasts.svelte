<script lang="ts">
  import { toasts } from '../stores/toast';
</script>

<div class="toast-container" aria-live="polite">
  {#each $toasts as toast (toast.id)}
    <div class="toast toast--{toast.type}" role="alert">
      <span class="toast__icon" aria-hidden="true">
        {#if toast.type === 'success'}
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M2.5 8.5 L6 12 L13.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        {:else}
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M8 2 L15 14 H1 Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
            <line x1="8" y1="6.5" x2="8" y2="9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            <circle cx="8" cy="11.7" r="0.9" fill="currentColor" />
          </svg>
        {/if}
      </span>
      <span class="toast__message">{toast.message}</span>
      <button class="toast__close" onclick={() => toasts.remove(toast.id)} aria-label="Dismiss">&times;</button>
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
    gap: 0.6rem;
    padding: 0.7rem 0.9rem;
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    box-shadow: var(--shadow-float);
    font-size: 0.88rem;
    animation: slide-in 0.2s ease;
  }

  .toast--success {
    border-left: 3px solid var(--color-green);
  }

  .toast--success .toast__icon {
    color: var(--color-green);
  }

  .toast--error {
    border-left: 3px solid var(--color-rust);
  }

  .toast--error .toast__icon {
    color: var(--color-rust);
  }

  .toast__icon {
    display: flex;
    flex-shrink: 0;
  }

  .toast__message {
    flex: 1;
    color: var(--color-ink);
  }

  .toast__close {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.1rem;
    line-height: 1;
    padding: 0;
    color: var(--color-ink-muted);
    flex-shrink: 0;
  }

  .toast__close:hover {
    color: var(--color-ink);
  }

  @keyframes slide-in {
    from { transform: translateX(110%); opacity: 0; }
    to   { transform: translateX(0);    opacity: 1; }
  }
</style>
