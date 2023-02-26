import { createSlice, PayloadAction } from "@reduxjs/toolkit";

const initialState: IContextMenuData | null = null as IContextMenuData | null;

const contextMenu = createSlice({
    name: "contextMenu",
    initialState,
    reducers: {
        setContextMenu(state, action: PayloadAction<typeof initialState>) {
            return action.payload;
        },
    },
});

export const { setContextMenu } = contextMenu.actions;

export default contextMenu.reducer;
