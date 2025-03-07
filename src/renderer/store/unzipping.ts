// import { createSlice, PayloadAction } from "@reduxjs/toolkit";
//
// const initialState = {
//     state: false,
//     text: "",
// };
//
// const unzipping = createSlice({
//     name: "unzipping",
//     initialState,
//     reducers: {
//         setUnzipping: (state, action: PayloadAction<{ state: boolean; text?: string } | boolean>) => {
//             if (typeof action.payload === "boolean") return { text: "", state: action.payload };
//             return { text: "", ...action.payload };
//         },
//     },
// });
//
// export const { setUnzipping } = unzipping.actions;
//
// export default unzipping.reducer;
//
