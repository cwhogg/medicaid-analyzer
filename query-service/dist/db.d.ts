export declare function initDB(): Promise<void>;
export declare function reloadViews(): Promise<{
    created: string[];
    missing: string[];
}>;
export declare function isReady(): boolean;
export declare function executeSQL(sql: string): Promise<{
    columns: string[];
    rows: unknown[][];
}>;
