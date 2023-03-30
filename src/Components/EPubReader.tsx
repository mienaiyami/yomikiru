import React, { useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { setReaderOpen } from "../store/isReaderOpen";

const EPubReader = () => {
    const isReaderOpen = useAppSelector((store) => store.isReaderOpen);
    const dispatch = useAppDispatch();

    useEffect(() => {
        dispatch(setReaderOpen(true));
    }, []);
    return (
        <div
            id="EPubReader"
            className="reader"
            style={{
                display: isReaderOpen ? "block" : "block",
            }}
            tabIndex={-1}
        ></div>
    );
};

export default EPubReader;
