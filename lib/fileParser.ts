// This file contains utilities for parsing CSV and Excel files using PapaParse and ExcelJS

/**
 * Types for the file parsing utilities
 */
export interface ParseResult {
  data: Record<string, any>[];
  fields: string[];
  errors: any[];
  totalRows: number;
}

export interface ChunkResult {
  data: Record<string, any>[];
  fields: string[];
  errors: any[];
}

export type ChunkCallback = (result: ChunkResult) => void;
export type CompleteCallback = (result: ParseResult) => void;
export type ErrorCallback = (error: Error) => void;

/**
 * Create a web worker for parsing CSV files
 * This keeps heavy parsing work off the main thread
 */
export function createCSVParserWorker(): Worker {
  // Create a worker script as a blob to avoid needing a separate file
  const workerScript = `
    importScripts('https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js');
    
    let totalRows = 0;
    let allFields = new Set();
    let errors = [];
    
    self.onmessage = function(e) {
      const { file, config } = e.data;
      
      // Configure PapaParse
      const parseConfig = {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        
        // Process data in chunks to avoid blocking
        chunk: function(results, parser) {
          totalRows += results.data.length;
          
          // Track all fields seen in the data
          if (results.meta && results.meta.fields) {
            results.meta.fields.forEach(field => allFields.add(field));
          }
          
          // Collect any errors
          if (results.errors && results.errors.length > 0) {
            errors = errors.concat(results.errors);
          }
          
          // Send the chunk back to the main thread
          self.postMessage({
            type: 'chunk',
            data: results.data,
            fields: Array.from(allFields),
            errors: results.errors || []
          });
        },
        
        // Handle completion
        complete: function() {
          self.postMessage({
            type: 'complete',
            totalRows: totalRows,
            fields: Array.from(allFields),
            errors: errors
          });
        },
        
        // Handle errors
        error: function(error) {
          self.postMessage({
            type: 'error',
            error: error.message
          });
        },
        
        ...config
      };
      
      Papa.parse(file, parseConfig);
    };
  `;
  
  const blob = new Blob([workerScript], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
}

/**
 * Parse a CSV file using a web worker
 */
export function parseCSVFile(
  file: File,
  onChunk: ChunkCallback,
  onComplete: CompleteCallback,
  onError: ErrorCallback
) {
  // Create a new worker
  const worker = createCSVParserWorker();
  
  // Set up message handlers
  worker.onmessage = (e: MessageEvent) => {
    const { type, data, fields, errors, totalRows, error } = e.data;
    
    if (type === 'chunk') {
      onChunk({ data, fields, errors });
    } else if (type === 'complete') {
      onComplete({ data: [], fields, errors, totalRows });
      worker.terminate();
    } else if (type === 'error') {
      onError(new Error(error));
      worker.terminate();
    }
  };
  
  // Handle worker errors
  worker.onerror = (e: ErrorEvent) => {
    onError(new Error(`Worker error: ${e.message}`));
    worker.terminate();
  };
  
  // Start the parsing process
  worker.postMessage({
    file,
    config: {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true
    }
  });
  
  return worker;
}

/**
 * Parse an Excel file
 * Note: ExcelJS doesn't have native web worker support, so we'll implement a lightweight approach
 */
export async function parseExcelFile(
  file: File,
  onChunk: ChunkCallback,
  onComplete: CompleteCallback,
  onError: ErrorCallback
) {
  try {
    // This will be dynamically imported in the component
    // (since this is a client-side function)
    const ExcelJS = (await import('exceljs')).default;
    
    const workbook = new ExcelJS.Workbook();
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        if (!e.target?.result) {
          throw new Error('Failed to read file');
        }
        
        // Load the workbook from the array buffer
        await workbook.xlsx.load(e.target.result as ArrayBuffer);
        
        const allFields = new Set<string>();
        const allData: Record<string, any>[] = [];
        const errors: any[] = [];
        
        // Process the first worksheet
        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
          throw new Error('No worksheets found in the Excel file');
        }
        
        // Get headers from the first row
        const headers: string[] = [];
        worksheet.getRow(1).eachCell((cell, colNumber) => {
          const header = cell.value?.toString() || `Column${colNumber}`;
          headers.push(header);
          allFields.add(header);
        });
        
        // Process rows in chunks of 100
        const CHUNK_SIZE = 100;
        let currentChunk: Record<string, any>[] = [];
        let totalRows = 0;
        
        // Start from the second row (after headers)
        worksheet.eachRow((row, rowNumber) => {
          // Skip header row
          if (rowNumber === 1) return;
          
          const rowData: Record<string, any> = {};
          
          // Map cells to their headers
          row.eachCell((cell, colNumber) => {
            if (colNumber <= headers.length) {
              const header = headers[colNumber - 1];
              // Handle different cell types
              let value = cell.value;
              if (cell.type === ExcelJS.ValueType.Date) {
                value = cell.value as Date;
              }
              rowData[header] = value;
            }
          });
          
          currentChunk.push(rowData);
          totalRows++;
          
          // Send data in chunks
          if (currentChunk.length >= CHUNK_SIZE) {
            allData.push(...currentChunk);
            onChunk({
              data: currentChunk,
              fields: Array.from(allFields),
              errors: []
            });
            currentChunk = [];
          }
        });
        
        // Send any remaining rows
        if (currentChunk.length > 0) {
          allData.push(...currentChunk);
          onChunk({
            data: currentChunk,
            fields: Array.from(allFields),
            errors: []
          });
        }
        
        // All done
        onComplete({
          data: allData,
          fields: Array.from(allFields),
          errors,
          totalRows
        });
      } catch (error) {
        console.error('Error parsing Excel file:', error);
        onError(error instanceof Error ? error : new Error('Unknown error parsing Excel file'));
      }
    };
    
    reader.onerror = () => {
      onError(new Error('Failed to read Excel file'));
    };
    
    // Read the file as an array buffer
    reader.readAsArrayBuffer(file);
  } catch (error) {
    console.error('Error setting up Excel parsing:', error);
    onError(error instanceof Error ? error : new Error('Unknown error setting up Excel parsing'));
  }
} 