import React from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getSortedRowModel
} from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2 } from 'lucide-react';
import { Button } from './Button';
import { toDisplayCase } from '../../utils/text';

const formatCellContent = (content) => {
  if (typeof content === 'string') {
    return toDisplayCase(content);
  }

  if (Array.isArray(content)) {
    return content.map(formatCellContent);
  }

  if (React.isValidElement(content)) {
    return React.cloneElement(
      content,
      content.props,
      formatCellContent(content.props.children)
    );
  }

  return content;
};

export function DataTable({
  columns,
  data,
  loading,
  manualPagination = false,
  pageCount = 1,
  pageIndex = 0,
  pageSize = 50,
  onPageChange,
  onPageSizeChange,
  totalCount
}) {
  const [sorting, setSorting] = React.useState([]);

  // Ensure data is always an array
  const tableData = React.useMemo(() => data || [], [data]);

  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      sorting,
      pagination: {
        pageIndex,
        pageSize
      }
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    pageCount: Math.max(1, pageCount)
  });

  const handlePageChange = (newPageIndex) => {
    if (onPageChange) {
      onPageChange(newPageIndex + 1);
    }
  };

  const rows = table.getRowModel().rows;

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-gray-200 bg-white relative shadow-sm">
        {loading &&
        <div className="absolute inset-0 z-10 bg-white/50 flex items-center justify-center backdrop-blur-[1px]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        }
        <div className="overflow-x-auto">
          <table className="w-full border-collapse table-auto text-left text-[16px]">
            <thead className="bg-primary text-white text-[15px] font-bold uppercase tracking-wider">
              {table.getHeaderGroups().map((headerGroup) =>
              <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                  return (
                    <th
                      key={header.id}
                      className={`px-4 py-3 border-b border-primary/20 whitespace-normal align-middle ${header.column.columnDef.className || ''}`}>
                      
                        {header.isPlaceholder ?
                      null :
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      </th>);

                })}
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length ?
              rows.map((row) =>
              <tr
                key={row.id}
                className="hover:bg-gray-50/80 transition-colors">
                
                    {row.getVisibleCells().map((cell) =>
                <td
                  key={cell.id}
                  className={`px-4 py-3 text-text-main whitespace-normal align-middle ${cell.column.columnDef.className || ''}`}>
                  
                        {formatCellContent(flexRender(cell.column.columnDef.cell, cell.getContext()))}
                      </td>
                )}
                  </tr>
              ) :

              <tr>
                  <td colSpan={columns.length} className="h-24 text-center text-gray-500">
                    {loading ? 'Loading data...' : 'No results found.'}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      {manualPagination &&
      <div className="flex items-center justify-between px-2 py-1">
          <div className="flex-1 text-sm text-gray-500 font-medium">
            {totalCount !== undefined ?
          <>Showing {totalCount > 0 ? pageIndex * pageSize + 1 : 0} to {Math.min((pageIndex + 1) * pageSize, totalCount)} of {totalCount} results</> :

          <>Showing {rows.length} results</>
          }
          </div>
          <div className="flex items-center space-x-6 lg:space-x-8">
            {onPageSizeChange && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500 font-medium">Rows per page</label>
                <select
                  value={pageSize}
                  onChange={(e) => onPageSizeChange(Number(e.target.value))}
                  className="h-8 px-2 border border-gray-200 rounded-md text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={500}>500</option>
                  <option value={1000}>1000</option>
                </select>
              </div>
            )}
            <div className="flex items-center space-x-2">
              <p className="text-sm font-bold text-gray-700">Page {pageIndex + 1} of{' '}
                {Math.max(1, pageCount)}</p>
            </div>
            <div className="flex items-center space-x-2">
              <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => handlePageChange(0)}
              disabled={pageIndex === 0}>
              
                <span className="sr-only">Go to first page</span>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => handlePageChange(pageIndex - 1)}
              disabled={pageIndex === 0}>
              
                <span className="sr-only">Go to previous page</span>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => handlePageChange(pageIndex + 1)}
              disabled={pageIndex + 1 >= pageCount}>
              
                <span className="sr-only">Go to next page</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => handlePageChange(pageCount - 1)}
              disabled={pageIndex + 1 >= pageCount}>
              
                <span className="sr-only">Go to last page</span>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      }
    </div>);

}
