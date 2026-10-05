import type { CommandId } from "@common/keybindings";
import { useCommandOwner } from "@features/keybindings";

type CycleDirection = -1 | 1;

/** One ordered value group controlled by a cycle-shortcut pair. */
export type CycleShortcutGroup<TValue extends string> = {
    values: readonly TValue[];
    current: TValue;
    onChange: (value: TValue) => void;
};

type CycleShortcutGroups<TBar1 extends string, TBar2 extends string = string> = {
    bar1?: CycleShortcutGroup<TBar1>;
    bar2?: CycleShortcutGroup<TBar2>;
};

type CycleShortcutOptions = {
    enabled: boolean;
    /** Unique owner id for this screen's bar groups. */
    ownerId: string;
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
 * Registers first- and second-bar cycle commands on the current screen owner.
 * Catalog context is home; callers set {@link CycleShortcutOptions.enabled} so
 * only the visible screen's groups run.
 */
export const useCycleShortcutGroups = <TBar1 extends string, TBar2 extends string = string>(
    groups: CycleShortcutGroups<TBar1, TBar2>,
    { enabled, ownerId }: CycleShortcutOptions,
): void => {
    const bar1 = groups.bar1;
    const bar2 = groups.bar2;
    const handlers: Partial<Record<CommandId, () => void>> = {};
    if (bar1) {
        handlers.cycleBar1Prev = () => applyCycle(bar1.values, bar1.current, bar1.onChange, -1);
        handlers.cycleBar1Next = () => applyCycle(bar1.values, bar1.current, bar1.onChange, 1);
    }
    if (bar2) {
        handlers.cycleBar2Prev = () => applyCycle(bar2.values, bar2.current, bar2.onChange, -1);
        handlers.cycleBar2Next = () => applyCycle(bar2.values, bar2.current, bar2.onChange, 1);
    }

    useCommandOwner({
        ownerId,
        contextKinds: ["home"],
        visible: enabled,
        handlers,
    });
};
