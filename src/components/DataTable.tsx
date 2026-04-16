import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

type SortDirection = 'asc' | 'desc';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  className?: string;
  headerClassName?: string;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  render: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage: string;
  pageSizeOptions?: number[];
  initialPageSize?: number;
}

export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage,
  pageSizeOptions = [5, 10, 20, 50],
  initialPageSize = 10,
}: DataTableProps<T>) {
  const firstSortableColumn = columns.find((column) => column.sortable);
  const [sortKey, setSortKey] = useState<string | null>(firstSortableColumn?.key ?? null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageSize, rows.length]);

  const sortedRows = useMemo(() => {
    if (!sortKey) {
      return rows;
    }

    const column = columns.find((item) => item.key === sortKey);
    if (!column?.sortValue) {
      return rows;
    }

    const sorted = [...rows].sort((a, b) => {
      const aValue = column.sortValue!(a);
      const bValue = column.sortValue!(b);

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      const comparison = String(aValue).localeCompare(String(bValue), undefined, {
        numeric: true,
        sensitivity: 'base',
      });

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [columns, rows, sortDirection, sortKey]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const startIndex = (page - 1) * pageSize;
  const pagedRows = sortedRows.slice(startIndex, startIndex + pageSize);

  const toggleSort = (column: DataTableColumn<T>) => {
    if (!column.sortable) {
      return;
    }

    if (sortKey === column.key) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(column.key);
    setSortDirection('asc');
  };

  const getSortIcon = (column: DataTableColumn<T>) => {
    if (!column.sortable) {
      return null;
    }

    if (sortKey !== column.key) {
      return <ArrowUpDown size={14} className="text-gray-400" />;
    }

    return sortDirection === 'asc' ? (
      <ArrowUp size={14} className="text-dltt-green" />
    ) : (
      <ArrowDown size={14} className="text-dltt-green" />
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6">
        <p className="text-sm text-gray-500">
          Showing {sortedRows.length === 0 ? 0 : startIndex + 1}-
          {Math.min(startIndex + pageSize, sortedRows.length)} of {sortedRows.length}
        </p>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <span>Rows per page</span>
          <select
            className="border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number.parseInt(e.target.value, 10));
              setPage(1);
            }}
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50 border-b border-gray-100">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider ${column.headerClassName || ''}`}
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column)}
                      className="inline-flex items-center gap-2 hover:text-gray-700 transition-colors"
                    >
                      <span>{column.header}</span>
                      {getSortIcon(column)}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {pagedRows.map((row) => (
              <tr key={rowKey(row)} className="hover:bg-gray-50/50 transition-colors">
                {columns.map((column) => (
                  <td key={column.key} className={`px-6 py-5 ${column.className || ''}`}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
            {pagedRows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-gray-500">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 px-6 pb-6">
        <button
          type="button"
          onClick={() => setPage((current) => Math.max(1, current - 1))}
          disabled={page === 1}
          className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          Previous
        </button>
        <p className="text-sm text-gray-500">
          Page {page} of {pageCount}
        </p>
        <button
          type="button"
          onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
          disabled={page === pageCount}
          className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
