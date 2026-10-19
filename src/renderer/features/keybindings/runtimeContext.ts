import { createContext, useContext } from "react";
import type { KeybindingRuntime } from "./runtime";

/** Window-local runtime. Missing provider is a programmer error. */
export const KeybindingRuntimeContext = createContext<KeybindingRuntime | null>(null);

/**
 * Runtime for this renderer. Throws when used outside {@link KeybindingProvider}.
 *
 * @throws {Error} When no provider is mounted
 */
export const useKeybindingRuntime = (): KeybindingRuntime => {
    const runtime = useContext(KeybindingRuntimeContext);
    if (!runtime) throw new Error("KeybindingProvider is required");
    return runtime;
};
