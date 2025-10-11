import { getErrorHandler } from "../util/errorHandler";
import { ipc } from "./utils";

/**
 * Register error reporting IPC handlers
 */
export const registerErrorReportingHandlers = () => {
    const errorHandler = getErrorHandler();

    ipc.handle("error:report", (event, args) => {
        args.severity ??= "medium";
        errorHandler.handleError(
            args.error,
            args.severity,
            {
                source: "Renderer Process",
                windowId: event.sender.id,
                metadata: args.context,
            },
            ["high", "critical"].includes(args.severity),
        );
    });
};
