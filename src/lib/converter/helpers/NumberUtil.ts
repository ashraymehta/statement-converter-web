import parse from 'multi-number-parse';

export class NumberUtil {
    private readonly commonSeparators = [',', '.'];

    public parseNumber(text: string): number | undefined {
        if (!text) {
            return undefined;
        }

        const trimmedText = text.trim();
        if (!trimmedText) {
            return undefined;
        }

        // Remove duplicate separators that multi-number-parse can't handle,
        // e.g. Indian lakh formatting: 2,00,000.00
        let parsableText = trimmedText;
        for (const separator of this.commonSeparators) {
            if (trimmedText.split(separator).length > 2) {
                parsableText = trimmedText.replace(separator, '');
                break;
            }
        }

        return parse(parsableText) as number;
    }
}
