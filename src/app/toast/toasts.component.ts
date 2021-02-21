import { Component, OnInit } from "@angular/core";
import { ToastService } from "./toast.service";

@Component({
  selector: "app-toasts",
  styleUrls: ["./toasts.component.scss"],
  templateUrl: "./toasts.component.html",
})
export class ToastsComponent implements OnInit {
  public toasts: any[] = [];
  constructor(public readonly toastService: ToastService) {}

  ngOnInit(): void {
    this.toastService.subscribeToToastModifications((newToasts) => {
      this.toasts = newToasts;
    });
  }
}
