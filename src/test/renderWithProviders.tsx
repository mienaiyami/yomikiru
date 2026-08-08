import { configureStore } from "@reduxjs/toolkit";
import type { RootState } from "@store/index";
import { rootReducer } from "@store/index";
import { type RenderOptions, render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { Provider } from "react-redux";

type ExtendedOptions = Omit<RenderOptions, "wrapper"> & {
    /** Partial Redux state merged into a fresh store for this render. */
    preloadedState?: Partial<RootState>;
};

/**
 * RTL `render` wrapped in a fresh Redux store using the real {@link rootReducer}.
 * Thunks that call `window.electron.invoke` hit the typed preload fake from setup.
 */
export const renderWithProviders = (ui: ReactElement, options: ExtendedOptions = {}) => {
    const { preloadedState, ...renderOptions } = options;
    const store = configureStore({
        reducer: rootReducer,
        preloadedState: preloadedState as RootState | undefined,
        middleware: (getDefaultMiddleware) =>
            getDefaultMiddleware({
                serializableCheck: false,
            }),
    });

    const Wrapper = ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>;

    return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
};
