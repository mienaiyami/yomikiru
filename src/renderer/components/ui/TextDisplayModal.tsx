import Modal from "@ui/Modal";
import { memo, useCallback, useRef } from "react";

export type TextDisplayModalButton = {
    label: string;
    disabled?: boolean;
    className?: string;
    style?: React.CSSProperties;
    onClick: () => void;
};

type TextDisplayModalProps = {
    /** Whether the modal is visible. */
    open: boolean;
    /** Modal title. */
    title: string;
    /** Readonly text content shown in textarea. */
    text: string;
    /** Action buttons. */
    buttons: TextDisplayModalButton[];
    /** Called when modal is dismissed (Escape or click outside). */
    onClose: () => void;
    /** Optional className for the modal element. */
    className?: string;
};

/**
 * Generic modal that displays text in a readonly textarea with configurable action buttons.
 */
const TextDisplayModal = memo(({ open, title, text, buttons, onClose, className }: TextDisplayModalProps) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        e.stopPropagation();
    }, []);

    if (!open) return null;

    return (
        <Modal open onClose={onClose} className={`text-display-modal ${className ?? ""}`.trim()}>
            <h3>{title}</h3>
            <textarea
                ref={textareaRef}
                readOnly
                value={text}
                onKeyDown={handleKeyDown}
                className="text-display-modal-textarea"
                aria-label={title}
            />
            <div className="modal-actions">
                {buttons.map((btn) => (
                    <button
                        key={btn.label}
                        onClick={btn.onClick}
                        disabled={btn.disabled}
                        className={btn.className}
                        style={btn.style}
                    >
                        {btn.label}
                    </button>
                ))}
            </div>
        </Modal>
    );
});

TextDisplayModal.displayName = "TextDisplayModal";

export default TextDisplayModal;
