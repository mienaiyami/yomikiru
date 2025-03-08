import { dialogUtils } from "@utils/dialog";
import { useState } from "react";

export const useExplorerOptions = () => {
    const [isUpdating, setIsUpdating] = useState(false);
    const handleInvoke = async (
        channel:
            | "explorer:addOption"
            | "explorer:removeOption"
            | "explorer:addOption:epub"
            | "explorer:removeOption:epub",
        successMessage?: string,
    ) => {
        try {
            setIsUpdating(true);

            await window.electron.invoke(channel);
            if (successMessage) {
                dialogUtils.confirm({
                    message: successMessage,
                    noOption: true,
                });
            }

            return true;
        } catch (error) {
            if (error instanceof Error) dialogUtils.nodeError(error);
            else window.logger.error("Failed to update explorer options:", error);
            return false;
        } finally {
            setIsUpdating(false);
        }
    };

    return { isUpdating, handleInvoke };
};
