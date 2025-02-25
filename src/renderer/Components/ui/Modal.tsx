import { ReactNode } from "react";
import FocusLock from "react-focus-lock";
type PropsBase = {
    open: boolean;
    onClose: () => void;
};
type Props1 = PropsBase & { children: ReactNode; asHTML?: false };
type Props2 = PropsBase & { children: string; asHTML: true };
const Modal = (props: Props1 | Props2) => {
    //todo impl
    return (
        props.open && (
            <FocusLock>
                <div
                    className="modal-element"
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
                                setTimeout(() => {
                                    node.focus();
                                });
                                if (props.asHTML) node.innerHTML = props.children;
                            }
                        }}
                        onBlur={(e) => {
                            if (!e.currentTarget.contains(e.target)) {
                                props.onClose();
                            }
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "Escape") props.onClose();
                        }}
                        tabIndex={-1}
                    >
                        {!props.asHTML && props.children}
                    </div>
                </div>
            </FocusLock>
        )
    );
};

export default Modal;
