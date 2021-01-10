import { saveAs } from 'file-saver';
import { Component } from '@angular/core';
import { Bank, StatementConverter } from '@ashray.mehta/statement-converter';

@Component({
    templateUrl: 'home.component.html'
})
export class HomeComponent {
    private readonly statementConverter: StatementConverter;

    constructor(statementConverter: StatementConverter) {
        this.statementConverter = statementConverter;
    }

    public async onFormSubmitted(data: { buffer: Buffer, bank: Bank }) {
        const convertedStatement = await this.statementConverter.convert(data.bank, data.buffer);
        this.saveToFileSystem(convertedStatement, `${data.bank}-converted-${new Date().toISOString()}.qif`);
    }

    private saveToFileSystem(qif, filename) {
        const blob = new Blob([qif], { type: 'application/qif' });
        saveAs(blob, filename);
    }
}