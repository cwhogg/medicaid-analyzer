export declare function initMetricsDB(): Promise<void>;
export interface RecordRequestInput {
    timestamp: number;
    route: string;
    ip: string;
    status: number;
    claudeMs?: number;
    railwayMs?: number;
    totalMs: number;
    cached: boolean;
    inputTokens?: number;
    outputTokens?: number;
    dataset?: string;
}
export interface RecordQueryInput {
    timestamp: number;
    ip: string;
    route: string;
    question: string;
    sql: string | null;
    status: number;
    totalMs: number;
    cached: boolean;
    error?: string;
    dataset?: string;
}
export declare function recordMetrics(request?: RecordRequestInput, query?: RecordQueryInput): Promise<void>;
export declare function getMetrics(): Promise<{
    uptime: {
        startTime: string;
        seconds: number;
    };
    traffic: {
        totalRequests: number;
        uniqueUsers: number;
        byRoute: any;
        byStatus: any;
        topUsers: {
            ip: string;
            city: string | null;
            count: number;
        }[];
    };
    performance: {
        total: {
            avg: number;
            p95: number;
        };
        claude: {
            avg: number;
            p95: number;
        };
        railway: {
            avg: number;
            p95: number;
        };
        cacheHitRate: number;
        sampleSize: number;
    };
    costs: {
        inputTokens: number;
        outputTokens: number;
        estimatedUSD: number;
        budgetLimit: number;
        budgetPercent: number;
    };
    recentQueries: {
        timestamp: unknown;
        ip: string;
        route: unknown;
        question: unknown;
        sql: unknown;
        status: unknown;
        totalMs: unknown;
        cached: unknown;
        error: {} | undefined;
        ago: string;
    }[];
}>;
export interface FeedItemInput {
    id: string;
    question: string;
    route: string;
    timestamp: number;
    summary?: string | null;
    stepCount?: number;
    rowCount?: number;
    resultData?: unknown;
    dataset?: string;
}
export declare function recordFeedItem(item: FeedItemInput): Promise<void>;
export declare function getFeedItems(limit?: number, dataset?: string): Promise<Record<string, unknown>[]>;
export interface FeedbackInput {
    id: string;
    message: string;
    page?: string;
    ip?: string;
}
export declare function recordFeedback(item: FeedbackInput): Promise<void>;
export declare function getDetailedUsers(): Promise<Record<string, unknown>[]>;
export declare function getDailyQueries(day?: string): Promise<Record<string, unknown> | Record<string, unknown>[]>;
export declare function getRetention(): Promise<Record<string, unknown>>;
export declare function saveShare(id: string, data: unknown): Promise<void>;
export declare function getShare(id: string): Promise<unknown | null>;
export declare function getFeedback(limit?: number): Promise<Record<string, unknown>[]>;
export declare function saveBlogIdeas(ideas: {
    id: string;
    status: string;
    data: string;
}[]): Promise<void>;
export declare function getBlogIdeas(status?: string): Promise<Record<string, unknown>[]>;
export declare function getBlogIdea(id: string): Promise<Record<string, unknown> | null>;
export declare function updateBlogIdea(id: string, data: string, status: string): Promise<void>;
export declare function deleteBlogIdea(id: string): Promise<void>;
export interface TweetMetricsInput {
    id: string;
    blog_idea_id?: string;
    tweet_id?: string;
    slug?: string;
    tweet_text?: string;
    impressions?: number;
    likes?: number;
    retweets?: number;
    replies?: number;
    quotes?: number;
    bookmarks?: number;
    link_clicks?: number;
    profile_clicks?: number;
}
export declare function saveTweetMetrics(input: TweetMetricsInput): Promise<void>;
export declare function getTweetMetrics(id?: string): Promise<Record<string, unknown> | Record<string, unknown>[]>;
export declare function getTopPerformingTweets(limit?: number): Promise<Record<string, unknown>[]>;
export interface PageViewInput {
    path: string;
    referrer?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    ip?: string;
}
export declare function recordPageView(input: PageViewInput): Promise<void>;
export declare function getTrafficSources(days?: number): Promise<Record<string, unknown>>;
