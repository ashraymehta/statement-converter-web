import { Bank } from '@ashray.mehta/statement-converter';
import { Component, EventEmitter, Output } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import {sortBy} from 'lodash'

export enum ExtendedBank {
    TRADE_REPUBLIC = 'trade_republic'
}

@Component({
    selector: 'app-form',
    templateUrl: 'form.component.html',
    styleUrls: ['./form.component.scss'],
    standalone: false
})
export class FormComponent {
    public readonly formGroup: UntypedFormGroup;
    private readonly fileReader: FileReader;

    // Banks from the library, plus Trade Republic appended
    public readonly banks = sortBy([
        ...Object.keys(Bank).sort().map(k => ({ name: k, value: Bank[k as keyof typeof Bank] })),
        { name: 'Trade Republic', value: ExtendedBank.TRADE_REPUBLIC }
    ], item => item.name)

    @Output()
    public readonly onFormSubmitted = new EventEmitter<{ buffer: ArrayBuffer | string, bank: Bank | ExtendedBank }>();

    public shouldShowDropZone: boolean = false;

    public constructor(formBuilder: UntypedFormBuilder, fileReader: FileReader) {
        this.fileReader = fileReader;
        this.formGroup = formBuilder.group({
            bank: formBuilder.control(Bank.ABN),
            bankStatementFile: formBuilder.control(null),
            jsonInput: formBuilder.control('')
        });
    }

    public get isTradeRepublic(): boolean {
        return this.formGroup.get('bank')?.value === ExtendedBank.TRADE_REPUBLIC;
    }

     public async onFileSelected(files: File[]): Promise<void> {
        if (!files || files.length === 0) {
            return;
        }

        const file = files[0];
        const content = await this.readFileContent(file);
        this.onFormSubmitted.emit({
            buffer: content,
            bank: this.formGroup.controls.bank.value
        });
        this.resetSelectedFile(this.formGroup);
    }

    public onSubmitJson(): void {
        const jsonInput = this.formGroup.controls.jsonInput.value;
        if (!jsonInput?.trim()) {
            alert('Please enter JSON content');
            return;
        }

        try {
            const csv = this.convertTradeRepublicJsonToCsv(jsonInput.trim());
            this.downloadCsv(csv);
            this.formGroup.controls.jsonInput.reset();
        } catch (error) {
            console.error('Conversion failed:', error);
            alert('Invalid Trade Republic JSON format. Please check the data.');
        }
    }

    private convertTradeRepublicJsonToCsv(jsonStr: string): string {
        const data = JSON.parse(jsonStr);

        if (!data.items || !Array.isArray(data.items)) {
            throw new Error('JSON must contain an "items" array');
        }

        const csvLines = ['Date,Payee,Memo,Amount'];

        for (const item of data.items) {
            const date = new Date(item.timestamp);
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            const yyyy = date.getFullYear();
            const formattedDate = `${mm}/${dd}/${yyyy}`;

            const payee = this.escapeCsv(item.title || '');
            const memo = this.escapeCsv(item.eventType || '');
            const amount = Number(item.amount.value).toFixed(2);

            csvLines.push(`${formattedDate},${payee},${memo},${amount}`);
        }

        return csvLines.join('\n');
    }

    private escapeCsv(value: string): string {
        if (/["\n,]/.test(value)) {
            return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
    }

    private downloadCsv(csv: string): void {
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'trade-republic-statement.csv';
        anchor.click();
        window.URL.revokeObjectURL(url);
    }

    private resetSelectedFile(formGroup: UntypedFormGroup) {
        formGroup.controls.bankStatementFile.reset();
    }

    public readFileContent(file: File): Promise<ArrayBuffer> {
        return new Promise<ArrayBuffer>((resolve, reject) => {
            const reader = this.fileReader;

            reader.onload = (e) => {
                const buffer = reader.result as ArrayBuffer;
                resolve(buffer);
            };

            reader.onerror = (error) => reject(error);
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