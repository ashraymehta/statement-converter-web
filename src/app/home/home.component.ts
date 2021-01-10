import { saveAs } from 'file-saver';
import { Component } from '@angular/core';
import { Bank, StatementConverter } from '@ashray/statement-converter';

@Component({
    templateUrl: 'home.component.html'
})
export class HomeComponent {
    private readonly statementConverter: StatementConverter;

    constructor(statementConverter: StatementConverter) {
        this.statementConverter = statementConverter;
    }

    public async onFormSubmitted(data: { buffer: Buffer, bank: Bank }) {
        console.log(data);
        const convertedStatement = await this.statementConverter.convert(data.bank, data.buffer);
        console.log(convertedStatement);
        this.saveToFileSystem(convertedStatement, `${data.bank}-converted-${new Date().toISOString()}.qif`);
    }

    private saveToFileSystem(qif, filename) {
        const blob = new Blob([qif], { type: 'application/qif' });
        saveAs(blob, filename);
    }
}