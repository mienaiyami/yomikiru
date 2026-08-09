import Modal from "@ui/Modal";
import { keyFormatter } from "@utils/keybindings";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

type TextInputModalProps = {
    /** Modal title shown above the input. */
    title: string;
    /** Placeholder for the text input. */
    placeholder?: string;
    /** Label for the submit button. Default: common `actions.save`. */
    submitLabel?: string;
    /** Label for the cancel button. Default: common `actions.cancel`. */
    cancelLabel?: string;
    /** Initial value for the input. Default: "". */
    initialValue?: string;
    /** Validation fn. Returns error message if invalid, null if valid. Submit disabled when invalid. */
    validate?: (value: string) => string | null;
    /** Called when modal is dismissed (Cancel or Escape). */
    onClose: () => void;
    /** Called with trimmed value when submitted. */
    onSave: (value: string) => void;
};

/**
 * Generic modal with text input. Use instead of window.prompt in Electron.
 */
const TextInputModal = memo(
    ({
        title,
        placeholder = "",
        submitLabel,
        cancelLabel,
        initialValue = "",
        validate,
        onClose,
        onSave,
    }: TextInputModalProps) => {
        const { t } = useTranslation("common");
        const resolvedSubmitLabel = submitLabel ?? t("actions.save");
        const resolvedCancelLabel = cancelLabel ?? t("actions.cancel");
        const resolvedValidate =
            validate ?? ((value: string) => (value.trim() === "" ? t("validation.required") : null));
        const [value, setValue] = useState(initialValue);
        const inputRef = useRef<HTMLInputElement>(null);
        const error = resolvedValidate(value.trim());
        const isValid = error === null;

        useEffect(() => {
            inputRef.current?.focus();
        }, []);

        const handleSubmit = useCallback(() => {
            if (!isValid) return;
            onSave(value.trim());
            onClose();
        }, [value, isValid, onSave, onClose]);

        return (
            <Modal open onClose={onClose} className="text-input-modal">
                <h3>{title}</h3>
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.currentTarget.value)}
                    onKeyDown={(e) => {
                        e.stopPropagation();
                        const keyStr = keyFormatter(e, false);
                        if (keyStr === "enter") handleSubmit();
                        if (keyStr === "escape") onClose();
                    }}
                    placeholder={placeholder}
                    aria-invalid={error !== null}
                    aria-describedby={error ? "text-input-modal-error" : undefined}
                />
                {error && (
                    <p id="text-input-modal-error" className="text-input-modal-error" role="alert">
                        {error}
                    </p>
                )}
                <div className="modal-actions">
                    <button onClick={onClose}>{resolvedCancelLabel}</button>
                    <button onClick={handleSubmit} disabled={!isValid}>
                        {resolvedSubmitLabel}
                    </button>
                </div>
            </Modal>
        );
    },
);

TextInputModal.displayName = "TextInputModal";

export default TextInputModal;
