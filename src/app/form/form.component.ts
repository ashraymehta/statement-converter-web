import { Bank } from '@ashray.mehta/statement-converter';
import { Component, EventEmitter, Output } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';

@Component({
    selector: 'app-form',
    templateUrl: 'form.component.html',
    styleUrls: ['./form.component.scss'],
    standalone: false
})
export class FormComponent {
    public readonly formGroup: UntypedFormGroup;
    private readonly fileReader: FileReader;
    public readonly banks = Object.keys(Bank).sort().map(k => ({ name: k, value: Bank[k] }));
    @Output()
    public readonly onFormSubmitted = new EventEmitter<{ buffer: Buffer, bank: Bank }>();
    public shouldShowDropZone: boolean = false;

    public constructor(formBuilder: UntypedFormBuilder, fileReader: FileReader) {
        this.fileReader = fileReader;
        this.formGroup = formBuilder.group({
            bank: formBuilder.control(null, [Validators.required]),
            bankStatementFile: formBuilder.control(null, [Validators.required])
        });
        this.formGroup.controls.bank.setValue(Bank.ABN);
    }

    public async onFileSelected(files: File[]): Promise<void> {
        const file = files[0];
        const content = await this.readFileContent(file);
        this.onFormSubmitted.emit({ buffer: content, bank: this.formGroup.controls.bank.value });

        this.resetSelectedFile(this.formGroup);
    }

    private resetSelectedFile(formGroup: UntypedFormGroup) {
        formGroup.controls.bankStatementFile.reset();
    }

    public readFileContent(file: File): Promise<Buffer> {
        return new Promise<Buffer>((resolve, reject) => {
            const reader = this.fileReader;

            reader.onload = (e) => {
                const buffer = reader.result as Buffer;
                resolve(buffer);
            };

            reader.readAsArrayBuffer(file);
        });
    }

    public showDropZone() {
        this.shouldShowDropZone = true;
    }

    public hideDropZone() {
        this.shouldShowDropZone = false;
    }
}