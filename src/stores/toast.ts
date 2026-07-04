import { writable } from 'svelte/store';

export interface Toast {
    id: number;
    message: string;
    type: 'success' | 'error';
}

let nextId = 0;

function createToastStore() {
    const { subscribe, update } = writable<Toast[]>([]);

    function show(message: string, type: Toast['type'] = 'success') {
        const id = nextId++;
        update((toasts) => [...toasts, { id, message, type }]);
        setTimeout(() => remove(id), 5000);
    }

    function remove(id: number) {
        update((toasts) => toasts.filter((t) => t.id !== id));
    }

    return { subscribe, show, remove };
}

export const toasts = createToastStore();
