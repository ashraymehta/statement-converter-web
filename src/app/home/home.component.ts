import { saveAs } from "file-saver";
import { Component } from "@angular/core";
import { Bank, StatementConverter } from "@ashray.mehta/statement-converter";
import { ToastService } from "../toast/toast.service";

@Component({
    templateUrl: "home.component.html",
    standalone: false
})
export class HomeComponent {
  private readonly toastService: ToastService;
  private readonly statementConverter: StatementConverter;

  constructor(
    statementConverter: StatementConverter,
    toastService: ToastService
  ) {
    this.statementConverter = statementConverter;
    this.toastService = toastService;
  }

  public async onFormSubmitted(data: { buffer: Buffer; bank: Bank }) {
    try {
      const convertedStatement = await this.statementConverter.convert(
        data.bank,
        data.buffer
      );
      this.saveToFileSystem(
        convertedStatement,
        `${data.bank}-converted-${new Date().toISOString()}.qif`
      );

      this.toastService.show("Statement converted successfully!", "Your statement should be downloading now.");
    } catch (err) {
      this.toastService.showError(
        "Oops!",
        "Something went wrong while converting your statement."
      );
      console.error("Something went wrong while converting the statement.", err);
    }
  }

  private saveToFileSystem(qif, filename) {
    const blob = new Blob([qif], { type: "application/qif" });
    saveAs(blob, filename);
  }
}
