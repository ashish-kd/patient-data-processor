import React, { useState, useEffect, useMemo } from 'react';
import { Table, Row } from '@tanstack/react-table'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  RowData,
  RowSelectionState,
} from '@tanstack/react-table';
import toast from 'react-hot-toast';

declare module '@tanstack/react-table' {
  interface TableMeta<TData extends RowData> {
    updateData: (rowIndex: number, columnId: string, value: any) => void;
  }
}

interface PatientTableProps {
  data: any[];
  columns: string[];
  isLoading?: boolean;
}

const PatientTable: React.FC<PatientTableProps> = ({ data = [], columns = [], isLoading = false }) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [tableData, setTableData] = useState<any[]>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [dirtyRows, setDirtyRows] = useState<Set<number>>(new Set());
  const [originalData, setOriginalData] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Update the table data when the input data changes
  useEffect(() => {
    console.log('Table data updated:', data);
    setTableData(data);
    setOriginalData(JSON.parse(JSON.stringify(data))); // Deep copy
    setDirtyRows(new Set());
    setRowSelection({});
  }, [data]);
  
  // Define columns based on the data keys
  const tableColumns = useMemo(() => {
    // Make sure we have both data and column definitions
    if (!columns.length) {
      // If no columns provided, try to extract from data
      if (data.length > 0) {
        const extractedColumns = new Set<string>();
        data.forEach(item => {
          Object.keys(item).forEach(key => {
            if (!['_id', 'createdAt', 'updatedAt'].includes(key)) {
              extractedColumns.add(key);
            }
          });
        });
        columns = Array.from(extractedColumns);
      } else {
        return [];
      }
    }
    
    console.log('Creating table columns:', columns);
    
    const baseColumns = [
      {
        id: 'select',
        header: ({ table }: { table: Table<any> }) => (
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
          />
        ),
        cell: ({ row }: { row: Row<any> }) => (
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
          />
        ),
        size: 40,
      },
    ];
    
    const dataColumns = columns.map((column) => {
      // Format the column header nicely
      const header = column
        .replace(/([A-Z])/g, ' $1') // Add space before capital letters
        .split(/[\s_]+/) // Split by spaces or underscores
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Capitalize words
        .join(' '); // Join with spaces
        
      return {
        accessorKey: column,
        header,
        cell: ({ row, column, getValue, table }) => {
          const initialValue = getValue() || '';
          
          // Skip special fields for editing
          if (column.id === '_id' || column.id === 'createdAt' || column.id === 'updatedAt') {
            return initialValue;
          }
          
          // Handle editable cells
          return (
            <div
              contentEditable
              suppressContentEditableWarning
              className={`editable-cell px-2 py-1 rounded ${
                dirtyRows.has(row.index) ? 'bg-yellow-50' : ''
              }`}
              onBlur={(e) => {
                const newValue = e.currentTarget.innerText;
                // Only mark as changed if the content actually changed
                if (newValue !== String(initialValue || '')) {
                  table.options.meta?.updateData(row.index, column.id, newValue);
                }
              }}
              dangerouslySetInnerHTML={{ __html: String(initialValue) }}
            />
          );
        },
      } as ColumnDef<any>;
    });
    
    return [...baseColumns, ...dataColumns];
  }, [columns, dirtyRows, data]);
  
  // Function to update data
  const updateData = (rowIndex: number, columnId: string, value: any) => {
    // Clone the current table data
    const newData = [...tableData];
    
    // Update the value in the data
    newData[rowIndex][columnId] = value;
    
    // Mark this row as dirty (edited)
    const newDirtyRows = new Set(dirtyRows);
    newDirtyRows.add(rowIndex);
    
    // Update state
    setTableData(newData);
    setDirtyRows(newDirtyRows);
    
    console.log(`Updated row ${rowIndex}, column ${columnId} to "${value}"`);
  };
  
  // Initialize the table
  const table = useReactTable({
    data: tableData,
    columns: tableColumns,
    state: {
      sorting,
      globalFilter,
      rowSelection,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    meta: {
      updateData,
    },
  });
  
  // Handle saving changes
  const handleSaveChanges = async () => {
    try {
      setIsSaving(true);
      toast.loading('Saving changes...');
      
      // Collect all modified rows
      const modifiedRows = Array.from(dirtyRows).map(index => {
        // Make sure each row has all the necessary data, especially _id
        const row = tableData[index];
        if (!row._id) {
          console.error('Row is missing _id:', row);
          throw new Error('Cannot update row without _id');
        }
        return row;
      });
      
      if (modifiedRows.length === 0) {
        toast.dismiss();
        toast.success('No changes to save');
        return;
      }
      
      console.log('Saving modified rows:', modifiedRows);
      
      // Send to the API
      const response = await fetch('/api/patients', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(modifiedRows),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save changes');
      }
      
      const result = await response.json();
      console.log('Save result:', result);
      
      // Update the original data
      setOriginalData(JSON.parse(JSON.stringify(tableData)));
      
      // Clear dirty state
      setDirtyRows(new Set());
      
      toast.dismiss();
      toast.success(`Saved ${result.modifiedCount} changes!`);
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.dismiss();
      toast.error((error as Error).message || 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Handle deleting selected rows
  const handleDeleteSelected = async () => {
    try {
      const selectedRows = Object.keys(rowSelection).map(
        index => tableData[parseInt(index, 10)]
      );
      
      if (selectedRows.length === 0) {
        toast.error('No rows selected');
        return;
      }
      
      // Confirm deletion
      if (!window.confirm(`Are you sure you want to delete ${selectedRows.length} selected record(s)?`)) {
        return;
      }
      
      setIsDeleting(true);
      toast.loading(`Deleting ${selectedRows.length} record(s)...`);
      
      console.log('Deleting rows:', selectedRows);
      
      const deletePromises = selectedRows.map(row => {
        if (!row._id) {
          console.error('Row is missing _id:', row);
          throw new Error('Cannot delete row without _id');
        }
        
        return fetch(`/api/patients/${row._id}`, {
          method: 'DELETE',
        }).then(response => {
          if (!response.ok) {
            throw new Error(`Failed to delete record with ID ${row._id}`);
          }
          return response.json();
        });
      });
      
      await Promise.all(deletePromises);
      
      // Clear selection
      setRowSelection({});
      
      // Refresh the data
      const response = await fetch('/api/patients');
      const data = await response.json();
      setTableData(data.data || []);
      setOriginalData(JSON.parse(JSON.stringify(data.data || [])));
      setDirtyRows(new Set());
      
      toast.dismiss();
      toast.success(`Deleted ${selectedRows.length} record(s) successfully`);
    } catch (error) {
      console.error('Error deleting records:', error);
      toast.dismiss();
      toast.error((error as Error).message || 'Failed to delete records');
    } finally {
      setIsDeleting(false);
    }
  };
  
  // Handle reverting changes
  const handleRevertChanges = () => {
    setTableData(JSON.parse(JSON.stringify(originalData)));
    setDirtyRows(new Set());
    toast.success('Changes reverted');
  };
  
  // Get the number of selected rows
  const selectedCount = Object.keys(rowSelection).length;
  
  return (
    <div className="space-y-4">
      {/* Search and actions */}
      <div className="flex flex-col sm:flex-row justify-between gap-2 pb-4">
        <div className="flex-1 max-w-md">
          <input
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="p-2 border border-gray-300 rounded w-full"
            placeholder="Search all columns..."
          />
        </div>
        <div className="flex gap-2">
          {selectedCount > 0 && (
            <button
              onClick={handleDeleteSelected}
              disabled={isDeleting || selectedCount === 0}
              className={`px-4 py-2 rounded ${
                isDeleting
                  ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              {isDeleting ? 'Deleting...' : `Delete Selected (${selectedCount})`}
            </button>
          )}
          
          <button
            onClick={handleSaveChanges}
            disabled={dirtyRows.size === 0 || isSaving}
            className={`px-4 py-2 rounded ${
              dirtyRows.size === 0 || isSaving
                ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {isSaving ? 'Saving...' : `Save Changes (${dirtyRows.size})`}
          </button>
          
          {dirtyRows.size > 0 && (
            <button
              onClick={handleRevertChanges}
              disabled={dirtyRows.size === 0 || isSaving}
              className={`px-4 py-2 rounded ${
                dirtyRows.size === 0 || isSaving
                  ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                  : 'bg-orange-600 text-white hover:bg-orange-700'
              }`}
            >
              Revert All
            </button>
          )}
        </div>
      </div>
      
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 border">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none"
                    onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                    style={{ width: header.column.getSize() }}
                  >
                    <div className="flex items-center">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {{
                        asc: ' 🔼',
                        desc: ' 🔽',
                      }[header.column.getIsSorted() as string] ?? null}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isLoading || isDeleting ? (
              <tr>
                <td
                  colSpan={tableColumns.length || 1}
                  className="px-6 py-4 text-center text-sm text-gray-500"
                >
                  {isDeleting ? 'Deleting...' : 'Loading...'}
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={tableColumns.length || 1}
                  className="px-6 py-4 text-center text-sm text-gray-500"
                >
                  No results found
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr 
                  key={row.id} 
                  className={dirtyRows.has(row.index) ? 'dirty-row' : ''}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-6 py-4 text-sm text-gray-500"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-700">
            Page{' '}
            <strong>
              {table.getState().pagination.pageIndex + 1} of{' '}
              {table.getPageCount() || 1}
            </strong>
          </span>
          <span className="text-sm text-gray-700">
            | Go to page:
            <input
              type="number"
              min={1}
              max={table.getPageCount() || 1}
              value={table.getState().pagination.pageIndex + 1}
              onChange={(e) => {
                const page = e.target.value ? Number(e.target.value) - 1 : 0;
                table.setPageIndex(Math.min(Math.max(page, 0), (table.getPageCount() - 1) || 0));
              }}
              className="w-16 ml-1 p-1 border border-gray-300 rounded"
            />
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            className="px-3 py-1 border rounded bg-white hover:bg-gray-100 disabled:opacity-50"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            {'<<'}
          </button>
          <button
            className="px-3 py-1 border rounded bg-white hover:bg-gray-100 disabled:opacity-50"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            {'<'}
          </button>
          <button
            className="px-3 py-1 border rounded bg-white hover:bg-gray-100 disabled:opacity-50"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            {'>'}
          </button>
          <button
            className="px-3 py-1 border rounded bg-white hover:bg-gray-100 disabled:opacity-50"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            {'>>'}
          </button>
        </div>
        <select
          value={table.getState().pagination.pageSize}
          onChange={(e) => {
            table.setPageSize(Number(e.target.value));
          }}
          className="p-1 border border-gray-300 rounded"
        >
          {[10, 25, 50, 100].map((pageSize) => (
            <option key={pageSize} value={pageSize}>
              Show {pageSize}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default PatientTable; 