import { pull } from "lodash";
import { EventEmitter, Injectable } from "@angular/core";

@Injectable({ providedIn: "root" })
export class ToastService {
  private static readonly toasts: any[] = [];
  private static readonly toastModifiedEvent = new EventEmitter<any[]>();

  show(header: string, body: string) {
    ToastService.toasts.push({ header, body });
    ToastService.toastModifiedEvent.emit(ToastService.toasts);
  }

  showError(header: string, body: string) {
    ToastService.toasts.unshift({
      header,
      body,
      classname: "bg-danger text-light"
    });
    ToastService.toastModifiedEvent.emit(ToastService.toasts);
  }

  remove(toast) {
    pull(ToastService.toasts, toast);
    ToastService.toastModifiedEvent.emit(ToastService.toasts);
  }

  subscribeToToastModifications(subscriber: (toasts: any[]) => void) {
    ToastService.toastModifiedEvent.subscribe((toasts) => subscriber(toasts));
  }
}
