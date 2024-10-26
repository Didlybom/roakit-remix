import { Box, type SxProps } from '@mui/material';
import { useEffect, useRef, useState, type CSSProperties, type MutableRefObject } from 'react';
import { useResizeDetector } from 'react-resize-detector';
import AutoSizer from 'react-virtualized-auto-sizer';
import { VariableSizeList } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';

const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_THRESHOLD = 50;
const DEFAULT_REFRESH_INTERVAL_MS = 15 * 1000;

interface InfiniteListProps {
  height: string;
  rowSx?: SxProps;
  minimumBatchSize?: number;
  threshold?: number;
  refreshIntervalMs?: number;
  head: JSX.Element;
  itemCount: number;
  isItemLoaded: (index: number) => boolean;
  rowElement: (index: number) => JSX.Element;
  loadMoreItems: () => void;
  loadNewItems: () => void;
  listLoaderRef: MutableRefObject<InfiniteLoader | null>; // provides resetloadMoreItemsCache()
  setRef: (ref: VariableSizeList | null) => void; // provides scrollToItem() etc.
  setListScrollOffset?: (scrollOffset: number) => void;
  rowHeights: number[];
  setRowHeights: (heights: number[]) => void;
}
/**
 * A just-in-time-loading, auto-refreshing, infinite list with cells of variable height adjusting themselves to width resizing.
 */
export default function InfiniteList({
  height,
  rowSx,
  minimumBatchSize = DEFAULT_PAGE_SIZE,
  threshold = DEFAULT_THRESHOLD,
  refreshIntervalMs = DEFAULT_REFRESH_INTERVAL_MS,
  head,
  itemCount,
  isItemLoaded,
  rowElement,
  loadMoreItems,
  loadNewItems,
  listLoaderRef,
  setRef,
  setListScrollOffset,
  rowHeights,
  setRowHeights,
}: InfiniteListProps) {
  const [scrollOffset, setScrollOffset] = useState(0);
  const [heights, setHeights] = useState(rowHeights);
  const listRef = useRef<VariableSizeList | null>(null);
  const { ref: rootRef } = useResizeDetector({
    handleHeight: false,
    onResize: () => {
      setRowHeights([]);
      setHeights([]);
    },
  });
  const autoRefresh = useRef<number | undefined>(undefined);

  // auto refresh
  useEffect(() => {
    if (!refreshIntervalMs) return;
    if (scrollOffset === 0) {
      autoRefresh.current = window.setInterval(loadNewItems, refreshIntervalMs);
    } else if (autoRefresh.current != null) {
      window.clearInterval(autoRefresh.current);
      autoRefresh.current = undefined;
    }
    return () => window.clearInterval(autoRefresh.current);
  }, [loadNewItems, refreshIntervalMs, scrollOffset]);

  // recalculate heights when items change
  useEffect(() => {
    setHeights([]);
  }, [itemCount, setHeights]);

  function Row({ index, style }: { index: number; style: CSSProperties }) {
    const ref = useRef<Element>();

    useEffect(() => {
      if (!ref.current || heights[index]) return;
      const height = ref.current.getBoundingClientRect().height;
      heights[index] = Math.ceil(height);
      listRef.current?.resetAfterIndex(index);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
      <Box style={style} sx={rowSx}>
        <Box ref={ref} pb={2}>
          {rowElement(index)}
        </Box>
      </Box>
    );
  }

  return (
    <Box ref={rootRef} height={height}>
      {head}
      <AutoSizer>
        {({ height, width }) => (
          <InfiniteLoader
            ref={listLoaderRef}
            isItemLoaded={isItemLoaded}
            itemCount={itemCount}
            loadMoreItems={loadMoreItems}
            minimumBatchSize={minimumBatchSize}
            threshold={threshold}
          >
            {({ onItemsRendered, ref }) => (
              <VariableSizeList
                estimatedItemSize={100}
                itemSize={i => heights[i] ?? 100}
                height={height}
                width={width}
                itemCount={itemCount}
                ref={elem => {
                  ref(elem);
                  setRef(elem);
                  listRef.current = elem;
                }}
                onScroll={({ scrollOffset }) => {
                  setScrollOffset(scrollOffset);
                  setListScrollOffset?.(scrollOffset);
                }}
                onItemsRendered={onItemsRendered}
              >
                {Row}
              </VariableSizeList>
            )}
          </InfiniteLoader>
        )}
      </AutoSizer>
    </Box>
  );
}
