import {
    type EpubPackage,
    estimateSpineItemHeight,
    SPINE_VIRTUAL_OVERSCAN,
    scrollTopFromInChapterFraction,
} from "@common/epub";
import { defaultRangeExtractor, measureElement, useVirtualizer } from "@tanstack/react-virtual";
import {
    captureEpubReadingPlace,
    chapterIdFromHtmlCont,
    type EpubReadingPlace,
    epubChapterRootId,
    queryEpubPosition,
    scrollYOfElement,
    settleEpubScroll,
    waitForEpubChapterRoot,
} from "@utils/epub";
import { createRendererLogger } from "@utils/logger";
import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";

const log = createRendererLogger("epub/continuousScroll");

/** One destination shared by opening, chapter/fragment navigation, percentage seek, and reflow. */
export type EpubScrollTarget = EpubReadingPlace & {
    /** Portion of chapter content height used by whole-publication percentage seek. */
    inChapterFraction?: number;
};

/**
 * Owns virtual spine measurements and cancellable navigation for continuous mode.
 * Targets stay mounted until real DOM geometry settles; user scrolling cancels pending work.
 */
export const useContinuousEpubScroll = ({
    enabled,
    epubData,
    weights,
    readerRef,
}: {
    enabled: boolean;
    epubData: EpubPackage | null;
    weights: readonly number[];
    readerRef: RefObject<HTMLElement>;
}) => {
    const [targetChapterId, setTargetChapterId] = useState<string | null>(null);
    const navigationRef = useRef<AbortController | null>(null);
    const readingPlaceRef = useRef<EpubReadingPlace | null>(null);
    const pendingResizePlaceRef = useRef<EpubReadingPlace | null>(null);
    const isPositioningRef = useRef(false);
    const restoreReadingPlaceRef = useRef<() => Promise<boolean>>(async () => false);
    const weightsTotal = useMemo(() => weights.reduce((total, weight) => total + weight, 0), [weights]);
    const spine = epubData?.spine;
    const spineIndexById = useMemo(() => new Map(spine?.map((chapter, index) => [chapter.id, index])), [spine]);
    const targetIndex = targetChapterId === null ? undefined : spineIndexById.get(targetChapterId);
    const getItemKey = useCallback((spineIndex: number) => spine?.[spineIndex]?.id ?? spineIndex, [spine]);
    const estimateSize = useCallback(
        (spineIndex: number) =>
            estimateSpineItemHeight(weights[spineIndex] ?? 1, {
                viewportHeightPx: readerRef.current?.clientHeight || window.innerHeight,
                spineItemCount: spine?.length ?? 0,
                weightsTotal,
            }),
        [weights, weightsTotal, spine, readerRef],
    );
    const rangeExtractor = useCallback(
        (range: Parameters<typeof defaultRangeExtractor>[0]) => {
            const visibleIndexes = defaultRangeExtractor(range);
            if (targetIndex === undefined || visibleIndexes.includes(targetIndex)) return visibleIndexes;
            return [...visibleIndexes, targetIndex].sort((left, right) => left - right);
        },
        [targetIndex],
    );
    const virtualizer = useVirtualizer<HTMLElement, HTMLElement>({
        enabled,
        count: enabled ? (spine?.length ?? 0) : 0,
        getScrollElement: () => readerRef.current,
        getItemKey,
        estimateSize,
        rangeExtractor,
        overscan: SPINE_VIRTUAL_OVERSCAN,
        useAnimationFrameWithResizeObserver: true,
        measureElement: (spineRow, entry, instance) => {
            const chapterRoot = spineRow.querySelector<HTMLElement>(".htmlCont");
            // an empty pending read must keep its estimate until HTMLPart declares injection complete
            if (chapterRoot?.dataset.epubReady !== "true") {
                return (
                    instance.measurementsCache[Number(spineRow.dataset.index)]?.size ??
                    estimateSize(Number(spineRow.dataset.index))
                );
            }
            const height = measureElement(spineRow, entry, instance);
            const chapterId = chapterIdFromHtmlCont(chapterRoot);
            const readingPlace = readingPlaceRef.current;
            const previousHeight = instance.measurementsCache[Number(spineRow.dataset.index)]?.size;
            if (
                entry &&
                previousHeight !== height &&
                readingPlace?.chapterId === chapterId &&
                !isPositioningRef.current
            ) {
                // late images and fonts can move a paragraph inside the current row after navigation finishes
                pendingResizePlaceRef.current = readingPlace;
                queueMicrotask(() => {
                    if (
                        !isPositioningRef.current &&
                        !instance.isScrolling &&
                        pendingResizePlaceRef.current === readingPlace &&
                        readingPlaceRef.current === readingPlace
                    ) {
                        pendingResizePlaceRef.current = null;
                        void restoreReadingPlaceRef.current();
                    }
                });
            }
            return height;
        },
    });
    virtualizer.shouldAdjustScrollPositionOnItemSizeChange = (spineItem) =>
        !isPositioningRef.current && spineItem.end <= (readerRef.current?.scrollTop ?? 0);

    /** Measures only the chapter that completed IO; the observer owns subsequent image/font changes. */
    const onHtmlInjected = useCallback(
        (chapterId: string) => {
            const spineRow = document
                .getElementById(epubChapterRootId(chapterId))
                ?.closest<HTMLElement>(".epubSpineItem");
            if (spineRow) virtualizer.measureElement(spineRow);
        },
        [virtualizer],
    );

    /** Stops older navigation immediately, including its wait for asynchronous chapter content. */
    const cancelNavigation = useCallback(() => {
        navigationRef.current?.abort();
        navigationRef.current = null;
        pendingResizePlaceRef.current = null;
        isPositioningRef.current = false;
        setTargetChapterId(null);
    }, []);

    /** Captures the current viewport without replacing a destination during programmatic movement. */
    const captureReadingPlace = useCallback(() => {
        if (!enabled || isPositioningRef.current || pendingResizePlaceRef.current || !readerRef.current)
            return readingPlaceRef.current;
        const readingPlace = captureEpubReadingPlace(readerRef.current);
        if (readingPlace) readingPlaceRef.current = readingPlace;
        return readingPlace;
    }, [enabled, readerRef]);

    /** Saves a pre-reflow anchor; layout restoration releases capture once the DOM stops moving. */
    const holdReadingPlace = useCallback(() => {
        if (!enabled) return;
        captureReadingPlace();
        if (readingPlaceRef.current) isPositioningRef.current = true;
    }, [enabled, captureReadingPlace]);

    /**
     * Mounts one destination and applies its real geometry through the virtualizer's offset API.
     * Returns false on cancellation or missing chapter markup, preserving the previously saved locator.
     */
    const navigate = useCallback(
        async (target: EpubScrollTarget): Promise<boolean> => {
            const reader = readerRef.current;
            if (!enabled || !reader || !spineIndexById.has(target.chapterId)) return false;
            navigationRef.current?.abort();
            pendingResizePlaceRef.current = null;
            const navigation = new AbortController();
            navigationRef.current = navigation;
            isPositioningRef.current = true;
            readingPlaceRef.current = target;
            setTargetChapterId(target.chapterId);
            try {
                const chapterRoot = await waitForEpubChapterRoot(reader, target.chapterId, navigation.signal);
                if (!chapterRoot || navigation.signal.aborted) {
                    if (!navigation.signal.aborted)
                        log.warn("chapter navigation timed out", { chapterId: target.chapterId });
                    return false;
                }
                const spineRow = chapterRoot.closest<HTMLElement>(".epubSpineItem");
                if (!spineRow) return false;
                virtualizer.measureElement(spineRow);
                const settled = await settleEpubScroll(
                    reader,
                    () => {
                        if (!reader.contains(chapterRoot)) return null;
                        let destination: number;
                        if (target.inChapterFraction !== undefined) {
                            destination = scrollTopFromInChapterFraction(
                                scrollYOfElement(reader, chapterRoot),
                                chapterRoot.getBoundingClientRect().height,
                                target.inChapterFraction,
                            );
                        } else {
                            const element = target.position
                                ? queryEpubPosition(chapterRoot, target.position)
                                : spineRow;
                            destination =
                                scrollYOfElement(reader, element ?? spineRow) - (target.viewportOffset ?? 0);
                        }
                        // near the end of a book the browser cannot align its last paragraph to the top
                        return Math.max(0, Math.min(destination, reader.scrollHeight - reader.clientHeight));
                    },
                    {
                        shouldAbort: () => navigation.signal.aborted,
                        scrollTo: (scrollTop) => virtualizer.scrollToOffset(scrollTop, { behavior: "auto" }),
                    },
                );
                if (!navigation.signal.aborted && !settled)
                    log.warn("chapter layout did not settle", { chapterId: target.chapterId });
                return settled;
            } finally {
                if (navigationRef.current === navigation) {
                    navigationRef.current = null;
                    isPositioningRef.current = false;
                    setTargetChapterId(null);
                }
            }
        },
        [enabled, readerRef, spineIndexById, virtualizer],
    );

    /** Restores the last pre-reflow capture using the same path as a chapter or percentage jump. */
    const restoreReadingPlace = useCallback(() => {
        const readingPlace = readingPlaceRef.current;
        return readingPlace ? navigate(readingPlace) : Promise.resolve(false);
    }, [navigate]);
    restoreReadingPlaceRef.current = restoreReadingPlace;

    useEffect(() => {
        // virtualizer size corrections emit scroll events too; finish their reflow once those events settle
        const pendingPlace = pendingResizePlaceRef.current;
        if (virtualizer.isScrolling || !pendingPlace || isPositioningRef.current) return;
        pendingResizePlaceRef.current = null;
        if (readingPlaceRef.current === pendingPlace) void restoreReadingPlace();
    }, [virtualizer.isScrolling, restoreReadingPlace]);

    useEffect(
        () => () => {
            navigationRef.current?.abort();
            navigationRef.current = null;
            pendingResizePlaceRef.current = null;
        },
        [],
    );

    return {
        virtualizer,
        onHtmlInjected,
        navigate,
        cancelNavigation,
        captureReadingPlace,
        holdReadingPlace,
        restoreReadingPlace,
        readingPlaceRef,
        isPositioningRef,
    };
};
