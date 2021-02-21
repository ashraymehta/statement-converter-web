import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ToastsComponent } from "./toasts.component";
import { NgbModule } from "@ng-bootstrap/ng-bootstrap";

@NgModule({
  exports: [ToastsComponent],
  declarations: [ToastsComponent],
  imports: [CommonModule, NgbModule],
})
export class ToastModule {}
