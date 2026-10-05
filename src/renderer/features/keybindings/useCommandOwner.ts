import { useLayoutEffect, useRef } from "react";
import { useKeybindingRuntime } from "./runtimeContext";
import type { OwnerSpec, OwnerToken } from "./types";

let ownerSeq = 0;

/**
 * Stable per-mount command-owner id. The renderer React build does not
 * provide `useId` at runtime, so owners cannot use that hook.
 *
 * @param ownerKind short kind token included in the id (e.g. modal, combobox)
 */
export const useOwnerId = (ownerKind: string): string => {
    const idRef = useRef<string | null>(null);
    if (idRef.current === null) {
        ownerSeq += 1;
        idRef.current = `${ownerKind}:${ownerSeq}`;
    }
    return idRef.current;
};

/**
 * Registers `spec` for this mount and keeps handlers current without
 * re-attaching window listeners. Cleanup removes only this generation.
 */
export const useCommandOwner = (spec: OwnerSpec): void => {
    const runtime = useKeybindingRuntime();
    const tokenRef = useRef<OwnerToken | null>(null);
    const specRef = useRef(spec);
    specRef.current = spec;

    useLayoutEffect(() => {
        tokenRef.current = runtime.registerOwner(specRef.current);
        return () => {
            tokenRef.current?.unregister();
            tokenRef.current = null;
        };
    }, [runtime, spec.ownerId]);

    useLayoutEffect(() => {
        tokenRef.current?.update(specRef.current);
    });
};
