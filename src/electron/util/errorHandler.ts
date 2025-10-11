import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { app, BrowserWindow, dialog, shell } from "electron";
import { log } from ".";

/**
 * Error severity levels for better categorization
 */
export type ErrorSeverity = "low" | "medium" | "high" | "critical";

/**
 * Error context information for better debugging
 */
export type ErrorContext = {
    /** Function or module where error occurred */
    source?: string;
    /** User action that triggered the error */
    action?: string;
    /** Additional metadata */
    metadata?: Record<string, unknown>;
    /** Window ID where error occurred */
    windowId?: number;
    /** IPC channel if error occurred in IPC handler */
    ipcChannel?: string;
};

/**
 * Complete error information for reporting
 */
export type ErrorReport = {
    /** Error message */
    message: string;
    /** Error stack trace */
    stack?: string;
    /** Error severity level */
    severity: ErrorSeverity;
    /** Error context information */
    context: ErrorContext;
    /** Timestamp when error occurred */
    timestamp: Date;
    /** System information */
    systemInfo: SystemInfo;
    /** Application version */
    appVersion: string;
    /** Whether error was handled gracefully */
    handled: boolean;
};

/**
 * System information for debugging
 */
export type SystemInfo = {
    appVersion: string;
    platform: string;
    arch: string;
    osVersion: string;
    nodeVersion: string;
    electronVersion: string;
    totalMemory: number;
    freeMemory: number;
    cpuCount: number;
};

/**
 * Global error handler configuration
 */
export type ErrorHandlerConfig = {
    /** Whether to show error dialogs to user */
    showDialogs: boolean;
    /** Whether to log errors to file */
    logToFile: boolean;
    /** Whether to collect system info */
    collectSystemInfo: boolean;
    /** Maximum number of error reports to keep */
    maxReports: number;
    /** Whether to enable automatic crash reporting */
    enableCrashReporting: boolean;
};

/**
 * Global error handler class for managing all application errors
 *
 * @example Basic error handling
 * ```ts
 * try {
 *     // some operation that might fail
 *     throw new Error("Something went wrong");
 * } catch (error) {
 *     handleError(error as Error, "medium", {
 *         source: "Example Function",
 *         action: "Demonstrate basic error handling",
 *         metadata: { userId: "123", operation: "test" }
 *     }, true);
 * }
 * ```
 *
 * @example Wrapping async functions
 * ```ts
 * const errorHandler = getErrorHandler();
 * const safeOperation = errorHandler.wrapAsync(
 *     async (data: string) => {
 *         if (Math.random() > 0.5) throw new Error("Random failure");
 *         return `Processed: ${data}`;
 *     },
 *     { source: "Async Operation", action: "Process data" }
 * );
 * const result = await safeOperation("test"); // null if error
 * ```
 *
 * @example Using decorator
 * ```ts
 * class ExampleService {
 *     @withErrorHandling("medium", { source: "ExampleService" })
 *     async processData(data: string): Promise<string> {
 *         if (!data) throw new Error("Data is required");
 *         return `Processed: ${data}`;
 *     }
 * }
 * ```
 *
 * @example Retry utility (see retry.ts)
 * ```ts
 * import { withRetry, RetryPresets } from "./retry";
 *
 * // basic retry
 * const result = await withRetry(
 *     async () => fetch('https://api.example.com/data'),
 *     { maxRetries: 3, retryDelay: 1000 }
 * );
 *
 * // with preset
 * const data = await withRetry(
 *     async () => db.query('SELECT * FROM users'),
 *     RetryPresets.database
 * );
 * ```
 */
export class ErrorHandler {
    private static instance: ErrorHandler | null = null;
    private config: ErrorHandlerConfig;
    private errorReports: ErrorReport[] = [];
    private errorLogPath: string;
    private systemInfo: SystemInfo;

    private constructor(config: Partial<ErrorHandlerConfig> = {}) {
        this.config = {
            showDialogs: true,
            logToFile: true,
            collectSystemInfo: true,
            maxReports: 100,
            enableCrashReporting: true,
            ...config,
        };

        this.errorLogPath = path.join(app.getPath("userData"), "logs", "errors.log");
        this.systemInfo = this.collectSystemInfo();
        this.setupGlobalHandlers();
        this.ensureLogDirectory();
    }

    public static getInstance(config?: Partial<ErrorHandlerConfig>): ErrorHandler {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler(config);
        }
        return ErrorHandler.instance;
    }

    /**
     * Handle an error with full context and reporting
     */
    public handleError(
        error: Error | string,
        severity: ErrorSeverity = "medium",
        context: ErrorContext = {},
        showDialog = true,
    ): void {
        const errorReport = this.createErrorReport(error, severity, context, true);
        this.processError(errorReport, showDialog);
    }

    /**
     * Handle unhandled errors (from global handlers)
     */
    public handleUnhandledError(
        error: Error | string,
        severity: ErrorSeverity = "high",
        context: ErrorContext = {},
    ): void {
        const errorReport = this.createErrorReport(error, severity, context, false);
        this.processError(errorReport, true);
    }

    /**
     * Wrap async functions with error handling
     */
    public wrapAsync<T extends unknown[], R>(
        fn: (...args: T) => Promise<R>,
        context: ErrorContext = {},
    ): (...args: T) => Promise<R | null> {
        return async (...args: T): Promise<R | null> => {
            try {
                return await fn(...args);
            } catch (error) {
                this.handleError(error as Error, "medium", {
                    ...context,
                    source: fn.name || "anonymous function",
                });
                return null;
            }
        };
    }

    /**
     * Wrap sync functions with error handling
     */
    public wrapSync<T extends unknown[], R>(
        fn: (...args: T) => R,
        context: ErrorContext = {},
    ): (...args: T) => R | null {
        return (...args: T): R | null => {
            try {
                return fn(...args);
            } catch (error) {
                this.handleError(error as Error, "medium", {
                    ...context,
                    source: fn.name || "anonymous function",
                });
                return null;
            }
        };
    }

    /**
     * Get all error reports
     */
    public getErrorReports(): ErrorReport[] {
        return [...this.errorReports];
    }

    /**
     * Clear all error reports
     */
    public clearErrorReports(): void {
        this.errorReports = [];
    }

    /**
     * Export error reports for issue reporting
     */
    public exportErrorReports(): string {
        const recentErrors = this.errorReports.slice(-5);
        const reportData = {
            appVersion: app.getVersion(),
            systemInfo: this.systemInfo,
            timestamp: new Date().toISOString(),
            errors: recentErrors.map((report) => ({
                message: report.message,
                stack: report.stack,
                severity: report.severity,
                context: report.context,
                timestamp: report.timestamp.toISOString(),
                handled: report.handled,
            })),
        };

        return JSON.stringify(reportData, null, 2);
    }

    public async showIssueReportDialog(windowId?: number): Promise<void> {
        const window = windowId ? BrowserWindow.fromId(windowId) : BrowserWindow.getFocusedWindow();

        if (!window) {
            log.warn("No window available for issue report dialog");
            return;
        }

        const result = await dialog.showMessageBox(window, {
            type: "question",
            title: "Report Issue",
            message: "Would you like to report this issue to help improve Yomikiru?",
            detail: "This will open GitHub with error information pre-filled. No personal data is included.",
            buttons: ["Report Issue", "Copy Error Info", "Cancel"],
            defaultId: 0,
            cancelId: 2,
        });

        if (result.response === 0) {
            await this.openGitHubIssue();
        } else if (result.response === 1) {
            await this.copyErrorInfoToClipboard();
            await dialog.showMessageBox(window, {
                type: "info",
                title: "Error Info Copied",
                message: "Error information has been copied to clipboard.",
                buttons: ["OK"],
            });
        }
    }

    /**
     * Create error report from error object
     */
    private createErrorReport(
        error: Error | string,
        severity: ErrorSeverity,
        context: ErrorContext,
        handled: boolean,
    ): ErrorReport {
        const errorObj = typeof error === "string" ? new Error(error) : error;

        return {
            message: errorObj.message,
            stack: errorObj.stack,
            severity,
            context,
            timestamp: new Date(),
            systemInfo: this.systemInfo,
            appVersion: app.getVersion(),
            handled,
        };
    }

    /**
     * Process error report (log, store, show dialog)
     */
    private processError(errorReport: ErrorReport, showDialog: boolean): void {
        this.errorReports.push(errorReport);

        if (this.errorReports.length > this.config.maxReports) {
            this.errorReports = this.errorReports.slice(-this.config.maxReports);
        }

        if (this.config.logToFile) {
            this.logError(errorReport);
        }

        log.error("Error occurred:", {
            message: errorReport.message,
            severity: errorReport.severity,
            context: errorReport.context,
            stack: errorReport.stack,
        });

        // show dialog for high/critical errors or if explicitly requested
        if (
            showDialog &&
            this.config.showDialogs &&
            (errorReport.severity === "high" || errorReport.severity === "critical")
        ) {
            this.showErrorDialog(errorReport);
        }
    }

    private async showErrorDialog(errorReport: ErrorReport): Promise<void> {
        const window = errorReport.context.windowId
            ? BrowserWindow.fromId(errorReport.context.windowId)
            : BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];

        if (!window) {
            log.warn("No window available for error dialog");
            return;
        }

        const buttons = ["OK"];
        if (errorReport.severity === "high" || errorReport.severity === "critical") {
            buttons.push("Report Issue");
        }

        const result = await dialog.showMessageBox(window, {
            type: "error",
            title: `${errorReport.severity.charAt(0).toUpperCase() + errorReport.severity.slice(1)} Error`,
            message: errorReport.message,
            detail: this.formatErrorDetail(errorReport),
            buttons,
            defaultId: 0,
        });

        if (result.response === 1) {
            await this.showIssueReportDialog(window.id);
        }
    }

    private formatErrorDetail(errorReport: ErrorReport): string {
        const details = [];

        if (errorReport.context.source) {
            details.push(`Source: ${errorReport.context.source}`);
        }

        if (errorReport.context.action) {
            details.push(`Action: ${errorReport.context.action}`);
        }

        if (errorReport.context.ipcChannel) {
            details.push(`IPC Channel: ${errorReport.context.ipcChannel}`);
        }

        details.push(`Time: ${errorReport.timestamp.toLocaleString()}`);
        details.push(`App Version: ${errorReport.appVersion}`);

        return details.join("\n");
    }

    private logError(errorReport: ErrorReport): void {
        try {
            const logEntry = {
                timestamp: errorReport.timestamp.toISOString(),
                severity: errorReport.severity,
                message: errorReport.message,
                context: errorReport.context,
                stack: errorReport.stack,
                handled: errorReport.handled,
            };

            const logLine = `${JSON.stringify(logEntry)}\n`;
            fs.appendFileSync(this.errorLogPath, logLine);
        } catch (error) {
            log.error("Failed to write error log:", error);
        }
    }

    private collectSystemInfo(): SystemInfo {
        return {
            appVersion: app.getVersion(),
            platform: os.platform(),
            arch: os.arch(),
            osVersion: os.release(),
            nodeVersion: process.version,
            electronVersion: process.versions.electron || "unknown",
            totalMemory: os.totalmem(),
            freeMemory: os.freemem(),
            cpuCount: os.cpus().length,
        };
    }

    /**
     * Setup global error handlers
     */
    private setupGlobalHandlers(): void {
        // handle uncaught exceptions
        process.on("uncaughtException", (error) => {
            this.handleUnhandledError(error, "critical", {
                source: "uncaughtException",
            });
        });

        // handle unhandled promise rejections
        process.on("unhandledRejection", (reason) => {
            this.handleUnhandledError(reason instanceof Error ? reason : new Error(String(reason)), "high", {
                source: "unhandledRejection",
            });
        });

        // handle renderer process crashes
        app.on("render-process-gone", (_event, _webContents, details) => {
            this.handleUnhandledError(new Error(`Renderer process crashed: ${details.reason}`), "critical", {
                source: "render-process-gone",
                metadata: {
                    reason: details.reason,
                    exitCode: details.exitCode,
                },
            });
        });

        // handle child process errors
        app.on("child-process-gone", (_event, details) => {
            this.handleUnhandledError(new Error(`Child process crashed: ${details.type}`), "high", {
                source: "child-process-gone",
                metadata: {
                    type: details.type,
                    reason: details.reason,
                    exitCode: details.exitCode,
                },
            });
        });
    }

    /**
     * Ensure log directory exists
     */
    private ensureLogDirectory(): void {
        const logDir = path.dirname(this.errorLogPath);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }

    private async openGitHubIssue(): Promise<void> {
        const errorInfo = this.exportErrorReports();
        const issueTitle = encodeURIComponent("Error Report");
        const issueBody = encodeURIComponent(
            `
## Error Report

**App Version:** ${app.getVersion()}
**Platform:** ${this.systemInfo.platform} ${this.systemInfo.arch}
**OS Version:** ${this.systemInfo.osVersion}

## Error Details

\`\`\`json
${errorInfo}
\`\`\`

## Steps to Reproduce

1. 

## Expected Behavior

## Actual Behavior

## Additional Context

        `.trim(),
        );

        const githubUrl = `https://github.com/mienaiyami/yomikiru/issues/new?title=${issueTitle}&body=${issueBody}&labels=bug`;
        await shell.openExternal(githubUrl);
    }

    private async copyErrorInfoToClipboard(): Promise<void> {
        const { clipboard } = await import("electron");
        const errorInfo = this.exportErrorReports();
        clipboard.writeText(errorInfo);
    }
}

/**
 * Get error handler singleton instance
 */
export const getErrorHandler = (config?: Partial<ErrorHandlerConfig>): ErrorHandler => {
    return ErrorHandler.getInstance(config);
};

/**
 * Convenience function to handle errors
 */
export const handleError = (
    error: Error | string,
    severity: ErrorSeverity = "medium",
    context: ErrorContext = {},
    showDialog = true,
): void => {
    getErrorHandler().handleError(error, severity, context, showDialog);
};

/**
 * Decorator for wrapping methods with error handling
 */
export function withErrorHandling(_severity: ErrorSeverity = "medium", context: ErrorContext = {}) {
    return <T extends unknown[], R>(
        target: unknown,
        propertyKey: string,
        descriptor: TypedPropertyDescriptor<(...args: T) => Promise<R> | R>,
    ) => {
        const originalMethod = descriptor.value;

        if (!originalMethod) return descriptor;

        descriptor.value = function (this: unknown, ...args: T): Promise<R | null> | R | null {
            const errorHandler = getErrorHandler();
            const methodContext = {
                ...context,
                source: `${target?.constructor?.name || "unknown"}.${propertyKey}`,
            };

            if (originalMethod.constructor.name === "AsyncFunction") {
                return errorHandler.wrapAsync(
                    originalMethod.bind(this) as (...args: T) => Promise<R>,
                    methodContext,
                )(...args);
            } else {
                return errorHandler.wrapSync(
                    originalMethod.bind(this) as (...args: T) => R,
                    methodContext,
                )(...args);
            }
        } as typeof originalMethod;

        return descriptor;
    };
}
