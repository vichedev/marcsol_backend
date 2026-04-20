export interface ImportRowError {
    row: number;
    name?: string;
    errors: string[];
}

export interface ImportResult {
    total: number;
    created: number;
    failed: number;
    errors: ImportRowError[];
}