import { configureStore } from "@reduxjs/toolkit";
import i18n from "@renderer/i18n";
import type { RootState } from "@store/index";
import { rootReducer } from "@store/index";
import { type RenderOptions, render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { Provider } from "react-redux";

type ExtendedOptions = Omit<RenderOptions, "wrapper"> & {
    /** Partial Redux state merged into a fresh store for this render. */
    preloadedState?: Partial<RootState>;
};

/** Wraps RTL output in {@link I18nextProvider} using the renderer i18n singleton. */
const I18nWrapper = ({ children }: { children: ReactNode }) => (
    <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
);

/**
 * RTL `render` with the renderer i18n singleton already started in unit setup.
 * Use for components that call `useTranslation` and do not need Redux.
 */
export const renderWithI18n = (ui: ReactElement, options: Omit<RenderOptions, "wrapper"> = {}) =>
    render(ui, { wrapper: I18nWrapper, ...options });

/**
 * RTL `render` wrapped in a fresh Redux store using the real {@link rootReducer},
 * plus the same i18n provider as {@link renderWithI18n}.
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

    const Wrapper = ({ children }: { children: ReactNode }) => (
        <I18nextProvider i18n={i18n}>
            <Provider store={store}>{children}</Provider>
        </I18nextProvider>
    );

    return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
};
