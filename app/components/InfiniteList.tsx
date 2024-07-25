import { Box } from '@mui/material';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useResizeDetector } from 'react-resize-detector';
import AutoSizer from 'react-virtualized-auto-sizer';
import { VariableSizeList } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';

const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_THRESHOLD = 50;
const DEFAULT_REFRESH_INTERVAL_MS = 15 * 1000;

interface InfiniteListProps {
  height: string;
  margin?: number;
  minimumBatchSize?: number;
  threshold?: number;
  refreshIntervalMs?: number;
  head: JSX.Element;
  itemCount: number;
  isItemLoaded: (index: number) => boolean;
  rowElement: ({ index, style }: { index: number; style: CSSProperties }) => JSX.Element;
  loadMoreItems: () => void;
  loadNewItems: () => void;
  setRef: (ref: VariableSizeList | null) => void;
  setListScrollOffset?: (scrollOffset: number) => void;
  rowHeights: number[];
  setRowHeights: (heights: number[]) => void;
}

export default function InfiniteList({
  height,
  margin,
  minimumBatchSize = DEFAULT_PAGE_SIZE,
  threshold = DEFAULT_THRESHOLD,
  refreshIntervalMs = DEFAULT_REFRESH_INTERVAL_MS,
  head,
  itemCount,
  isItemLoaded,
  rowElement,
  loadMoreItems,
  loadNewItems,
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

  const Row = ({ index, style }: { index: number; style: CSSProperties }) => {
    const ref = useRef<Element>();

    useEffect(() => {
      if (!ref.current || heights[index]) return;
      const height = ref.current.getBoundingClientRect().height;
      heights[index] = Math.ceil(height);
      listRef.current?.resetAfterIndex(index);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
      <Box style={style} pr={margin}>
        <Box ref={ref} pb={2}>
          {rowElement({ index, style })}
        </Box>
      </Box>
    );
  };

  return (
    <Box ref={rootRef} height={height} my={margin} ml={margin}>
      {head}
      <AutoSizer disableWidth>
        {({ height }) => (
          <InfiniteLoader
            isItemLoaded={isItemLoaded}
            itemCount={itemCount}
            loadMoreItems={loadMoreItems}
            minimumBatchSize={minimumBatchSize}
            threshold={threshold}
          >
            {({ onItemsRendered, ref }) => (
              <VariableSizeList
                itemSize={i => heights[i] ?? 100}
                height={height}
                width="100%"
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
