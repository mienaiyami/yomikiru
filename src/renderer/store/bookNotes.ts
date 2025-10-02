import type { BookNote } from "@common/types/db";
import type { DatabaseChannels } from "@common/types/ipc";
import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";

type BookNotesState = {
    // map of key:itemLink value: notes
    book: Record<string, BookNote[] | null>;
    loading: boolean;
    error: string | null;
};

const initialState: BookNotesState = {
    book: {},
    loading: false,
    error: null,
};

export const fetchAllNotes = createAsyncThunk("bookNotes/fetchAll", async () => {
    const notes = await window.electron.invoke("db:book:getAllNotes");
    return { bookNotes: notes };
});

export const addNote = createAsyncThunk(
    "bookNotes/add",
    async (data: DatabaseChannels["db:book:addNote"]["request"]) => {
        const note = await window.electron.invoke("db:book:addNote", data);
        if (!note) throw new Error("Failed to fetch added note");
        return { note };
    },
);

export const updateNote = createAsyncThunk(
    "bookNotes/update",
    async (data: { id: number; content: string; color: string }) => {
        const updatedNote = await window.electron.invoke("db:book:updateNote", data);
        if (!updatedNote) throw new Error("Failed to update note");
        return { note: updatedNote };
    },
);

export const removeNote = createAsyncThunk(
    "bookNotes/remove",
    async ({ itemLink, ids }: { itemLink: string; ids: number[] }) => {
        await window.electron.invoke("db:book:deleteNotes", { itemLink, ids });
        return { itemLink, ids };
    },
);

export const removeAllNotes = createAsyncThunk(
    "bookNotes/removeAll",
    async ({ itemLink }: { itemLink: string }) => {
        await window.electron.invoke("db:book:deleteNotes", { itemLink, ids: [] });
        return { itemLink };
    },
);

const bookNotesSlice = createSlice({
    name: "bookNotes",
    initialState,
    reducers: {
        clearError: (state) => {
            state.error = null;
        },
        setNotes: (state, action: PayloadAction<BookNotesState>) => {
            return action.payload;
        },
    },

    extraReducers: (builder) => {
        builder
            .addCase(fetchAllNotes.pending, (state) => {
                state.loading = true;
            })
            .addCase(fetchAllNotes.fulfilled, (state, action) => {
                state.book = {};
                for (const bookNote of action.payload.bookNotes) {
                    if (!state.book[bookNote.itemLink]) {
                        state.book[bookNote.itemLink] = [];
                    }
                    state.book[bookNote.itemLink]?.push(bookNote);
                }
                state.loading = false;
            });
    },
});

export const { clearError: clearError_bookNotes, setNotes } = bookNotesSlice.actions;

export default bookNotesSlice.reducer;
