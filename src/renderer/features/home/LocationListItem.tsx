import { useAppSelector } from "@store/hooks";
import { dialogUtils } from "@utils/dialog";
import { formatUtils } from "@utils/file";
import { ReactElement } from "react";
import { useAppContext } from "src/renderer/App";
import ListItem from "../../components/ListItem";

const LocationListItem = ({
    name,
    link,
    inHistory,
    setCurrentLink,
    onContextMenu,
    focused,
}: {
    name: string;
    link: string;
    setCurrentLink: React.Dispatch<React.SetStateAction<string>>;
    inHistory: boolean;
    onContextMenu: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>, link: string, inHistory: boolean) => void;
    focused: boolean;
}): ReactElement => {
    const { openInReader } = useAppContext();
    const appSettings = useAppSelector((store) => store.appSettings);

    const onClickHandle = () => {
        if (!window.fs.existsSync(link)) {
            dialogUtils.customError({ message: "Directory/File doesn't exist." });
            return;
        }
        if (formatUtils.files.test(name)) {
            openInReader(link);
            return;
        }
        if (
            appSettings.openDirectlyFromManga &&
            window.path.normalize(window.path.resolve(link + "../../../") + window.path.sep) ===
                window.path.normalize(appSettings.baseDir + window.path.sep)
        ) {
            openInReader(link).then((isValid) => {
                if (isValid) {
                    setCurrentLink(window.path.dirname(link));
                }
            });
        }
        setCurrentLink(link);
    };

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        if (appSettings.openOnDblClick) {
            const elem = e.currentTarget;
            if (!elem.getAttribute("data-dblClick")) {
                elem.setAttribute("data-dblClick", "true");
                setTimeout(() => {
                    if (elem.getAttribute("data-dblClick") === "true") {
                        elem.removeAttribute("data-dblClick");
                        onClickHandle();
                    }
                }, 250);
            } else {
                elem.removeAttribute("data-dblClick");
                openInReader(link);
            }
        } else onClickHandle();
    };

    const handleContextMenu = (e: React.MouseEvent<HTMLAnchorElement>) => {
        onContextMenu(e, link, inHistory);
    };

    return (
        <ListItem
            focused={focused}
            classNameLi={inHistory ? "alreadyRead" : ""}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
            title={name}
        >
            <span className="text">{formatUtils.files.getName(name)}</span>
            {formatUtils.files.test(name) && <code className="nonFolder">{formatUtils.files.getExt(name)}</code>}
        </ListItem>
    );
};

export default LocationListItem;
