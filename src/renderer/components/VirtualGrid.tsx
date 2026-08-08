import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useRef } from 'react';
import { cssVariables } from '../styles/css-variables';
import styles from './VirtualGrid.module.css';

interface VirtualGridProps<T> {
  items: T[];
  columns?: number;
  rowHeight?: number;
  getKey(item: T): string | number;
  renderItem(item: T): React.ReactNode;
  empty: React.ReactNode;
  className?: string;
  fillHeight?: boolean;
  measureKey?: string | number;
  testId?: string;
}

export function VirtualGrid<T>({
  items,
  columns = 2,
  rowHeight = 96,
  getKey,
  renderItem,
  empty,
  className,
  fillHeight = false,
  measureKey,
  testId,
}: VirtualGridProps<T>) {
  const viewport = useRef<HTMLDivElement>(null);
  const rowCount = Math.ceil(items.length / columns);
  // TanStack Virtual exposes imperative measurement methods by design.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => viewport.current,
    estimateSize: () => rowHeight,
    overscan: 5,
  });
  useEffect(() => {
    virtualizer.measure();
  }, [columns, items.length, measureKey, rowHeight, virtualizer]);

  if (items.length === 0)
    return <div className={`${styles.empty} ${fillHeight ? styles.fillHeight : ''}`}>{empty}</div>;
  if (items.length <= 12) {
    return (
      <div
        className={`${styles.staticGrid} ${fillHeight ? styles.fillHeight : ''}`}
        style={cssVariables({ '--grid-columns': columns })}
      >
        {items.map((item) => (
          <div key={getKey(item)}>{renderItem(item)}</div>
        ))}
      </div>
    );
  }
  return (
    <div
      ref={viewport}
      data-testid={testId}
      className={`${styles.viewport} ${fillHeight ? styles.fillHeight : ''} ${className ?? ''}`}
    >
      <div className={styles.canvas} style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((row) => {
          const rowItems = items.slice(row.index * columns, row.index * columns + columns);
          return (
            <div
              key={row.key}
              className={styles.row}
              style={{
                ...cssVariables({ '--grid-columns': columns }),
                height: row.size,
                transform: `translateY(${row.start}px)`,
              }}
            >
              {rowItems.map((item) => (
                <div key={getKey(item)}>{renderItem(item)}</div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
