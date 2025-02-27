import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { dialogUtils } from "@utils/dialog";

let initialState: Anilist.TrackStore = JSON.parse(localStorage.getItem("anilist_tracking") || "[]");
initialState = initialState.filter((e) => {
    if (!window.fs.existsSync(e.localURL)) {
        window.logger.log(`"${e.localURL}" no longer exist, removing from AniList Tracking.`);
        return false;
    }
    return true;
});

const anilistTracking = createSlice({
    name: "anilistTracking",
    initialState,
    reducers: {
        setAnilistTracking: (state, action: PayloadAction<Anilist.TrackStore>) => {
            try {
                if (!(action.payload instanceof Array)) throw Error("Incorrect Format.");
                const str = JSON.stringify(action.payload);
                localStorage.setItem("anilist_tracking", str);
                return action.payload;
            } catch (reason) {
                dialogUtils.customError({
                    message: "Failed to save AniList tracker",
                    detail: reason as string,
                });
            }
        },
        addAnilistTracker: (state, action: PayloadAction<Anilist.TrackItem>) => {
            try {
                if ("localURL" in action.payload) {
                    const stateDup = [...state];
                    stateDup.push(action.payload);
                    const str = JSON.stringify(stateDup);
                    localStorage.setItem("anilist_tracking", str);
                    return stateDup;
                } else throw Error("Invalid Format.");
            } catch (reason) {
                dialogUtils.customError({
                    message: "Failed to save AniList tracker",
                    detail: reason as string,
                });
            }
        },
        /**
         *
         * @param action localURL of manga
         */
        removeAnilistTracker: (state, action: PayloadAction<string>) => {
            try {
                if (action.payload) {
                    const stateDup = state.filter((e) => e.localURL !== action.payload);
                    const str = JSON.stringify(stateDup);
                    localStorage.setItem("anilist_tracking", str);
                    return stateDup;
                } else throw Error("Invalid Format.");
            } catch (reason) {
                dialogUtils.customError({
                    message: "Failed to save AniList tracker",
                    detail: reason as string,
                });
            }
        },
    },
});

export const { setAnilistTracking, addAnilistTracker, removeAnilistTracker } = anilistTracking.actions;

export default anilistTracking.reducer;
