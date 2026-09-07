import { useMemo } from "react";
import { type KeybindHandlerConfig, useKeybindings } from "./useKeybindings";

type CycleDirection = -1 | 1;

/** One ordered value group controlled by a cycle-shortcut pair. */
export type CycleShortcutGroup<TValue extends string> = {
    values: readonly TValue[];
    current: TValue;
    onChange: (value: TValue) => void;
};

type CycleShortcutGroups<TBar1 extends string, TBar2 extends string> = {
    bar1?: CycleShortcutGroup<TBar1>;
    bar2?: CycleShortcutGroup<TBar2>;
};

type CycleShortcutOptions = {
    enabled: boolean;
};

/**
 * Returns the adjacent value in an ordered group, wrapping at either end.
 * A missing current value enters at the end matching the requested direction.
 */
export const cycleWrappedValue = <TValue>(
    values: readonly TValue[],
    current: TValue,
    direction: CycleDirection,
): TValue => {
    if (values.length === 0) return current;
    const currentIndex = values.indexOf(current);
    if (currentIndex === -1) return direction === 1 ? values[0] : values[values.length - 1];
    return values[(currentIndex + direction + values.length) % values.length];
};

/** Applies a wrapped cycle without notifying the owner when selection stays unchanged. */
const applyCycle = <TValue extends string>(
    values: readonly TValue[],
    current: TValue,
    onChange: (value: TValue) => void,
    direction: CycleDirection,
): void => {
    const nextValue = cycleWrappedValue(values, current, direction);
    if (nextValue !== current) onChange(nextValue);
};

/**
 * Registers reusable first- and second-bar cycle commands for the current screen.
 * Capture keeps the commands available while a descendant search field owns bubbling.
 */
export const useCycleShortcutGroups = <TBar1 extends string, TBar2 extends string = string>(
    groups: CycleShortcutGroups<TBar1, TBar2>,
    { enabled }: CycleShortcutOptions,
): void => {
    const bar1Values = groups.bar1?.values;
    const bar1Current = groups.bar1?.current;
    const bar1OnChange = groups.bar1?.onChange;
    const bar2Values = groups.bar2?.values;
    const bar2Current = groups.bar2?.current;
    const bar2OnChange = groups.bar2?.onChange;

    const handlers = useMemo<KeybindHandlerConfig[]>(() => {
        const cycleHandlers: KeybindHandlerConfig[] = [];
        if (bar1Values && bar1Current !== undefined && bar1OnChange) {
            cycleHandlers.push(
                {
                    command: "cycleBar1Prev",
                    handler: () => applyCycle(bar1Values, bar1Current, bar1OnChange, -1),
                    allowInInputs: true,
                    allowRepeated: false,
                },
                {
                    command: "cycleBar1Next",
                    handler: () => applyCycle(bar1Values, bar1Current, bar1OnChange, 1),
                    allowInInputs: true,
                    allowRepeated: false,
                },
            );
        }
        if (bar2Values && bar2Current !== undefined && bar2OnChange) {
            cycleHandlers.push(
                {
                    command: "cycleBar2Prev",
                    handler: () => applyCycle(bar2Values, bar2Current, bar2OnChange, -1),
                    allowInInputs: true,
                    allowRepeated: false,
                },
                {
                    command: "cycleBar2Next",
                    handler: () => applyCycle(bar2Values, bar2Current, bar2OnChange, 1),
                    allowInInputs: true,
                    allowRepeated: false,
                },
            );
        }
        return cycleHandlers;
    }, [bar1Values, bar1Current, bar1OnChange, bar2Values, bar2Current, bar2OnChange]);

    useKeybindings(handlers, { enabled, capture: true });
};
