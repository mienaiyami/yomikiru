import { memo, type ReactNode } from "react";
import FocusLock from "react-focus-lock";

type PropsBase = {
    open: boolean;
    onClose: () => void;
    noFocusLock?: boolean;
    className?: string;
};
type Props1 = PropsBase & { children: ReactNode; asHTML?: false };
type Props2 = PropsBase & { children: string; asHTML: true };

// todo: replace with radix ui

const Modal = memo((props: Props1 | Props2) => {
    return (
        <FocusLock disabled={!!props.noFocusLock}>
            <div
                className={`modal-element ${props.className || ""}`}
                data-state="closed"
                ref={(node) => {
                    if (node) {
                        setTimeout(() => {
                            if (node) node.setAttribute("data-state", "open");
                        });
                    }
                }}
            >
                <div className="clickClose" onClick={() => props.onClose()}></div>
                <div
                    className="modal-overlayCont"
                    ref={(node) => {
                        if (node) {
                            if (props.asHTML) node.innerHTML = props.children;
                        }
                    }}
                    onBlur={(e) => {
                        if (!e.currentTarget.contains(e.target)) {
                            props.onClose();
                        }
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Escape") {
                            // Settings (and similar overlays) listen for Escape on React ancestors
                            e.stopPropagation();
                            props.onClose();
                            return;
                        }
                        // space on the overlay itself; leave buttons and fields to native behavior
                        if (e.key === " " && e.target === e.currentTarget) {
                            e.preventDefault();
                            e.currentTarget.click();
                        }
                    }}
                    tabIndex={-1}
                >
                    {!props.asHTML && props.children}
                </div>
            </div>
        </FocusLock>
    );
});

Modal.displayName = "Modal";

export default Modal;
