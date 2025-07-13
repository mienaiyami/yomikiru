import Modal from "@ui/Modal";

const FootNodeModal = ({
    footnoteModalData,
    close,
    onEpubLinkClick,
}: {
    footnoteModalData: {
        title: string;
        content: string;
    } | null;
    close: () => void;
    onEpubLinkClick: (ev: MouseEvent | React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
}) => {
    return (
        footnoteModalData && (
            <Modal open={true} onClose={close}>
                <span className="title">{footnoteModalData.title}</span>
                <div
                    className="content"
                    ref={(node) => {
                        if (node) {
                            node.innerHTML = footnoteModalData.content;
                            node.querySelectorAll("a").forEach((e) => {
                                e.addEventListener("click", (ev) => {
                                    onEpubLinkClick(ev);
                                    close();
                                });
                            });
                        }
                    }}
                ></div>
            </Modal>
        )
    );
};

export default FootNodeModal;
