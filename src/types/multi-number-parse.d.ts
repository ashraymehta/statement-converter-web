declare module 'multi-number-parse' {
    /** Parses a numeric string with mixed locale separators (e.g. "1.234,56" or "1,234.56"). */
    export default function parse(text: string): number | undefined;
}
