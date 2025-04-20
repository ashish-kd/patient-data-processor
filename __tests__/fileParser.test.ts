import { parseCSVFile, parseExcelFile, createCSVParserWorker } from '@/lib/fileParser';

// Mock Web Worker since it's not available in Node.js
global.Worker = class MockWorker {
  onmessage: ((this: Worker, ev: MessageEvent) => any) | null = null;
  onerror: ((this: Worker, ev: ErrorEvent) => any) | null = null;
  
  // Mock sending a message from worker to main thread
  postMessage(message: any) {
    if (this.onmessage) {
      const event = { data: message } as MessageEvent;
      this.onmessage(event);
    }
  }
  
  // Mock receiving a message from main thread
  constructor(stringUrl: string) {
    // No implementation needed
  }
  
  // Mock terminate method
  terminate() {
    // No implementation needed
  }
} as any;

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'mockObjectURL');

// Mock Blob
global.Blob = class MockBlob {
  constructor(parts: BlobPart[], options?: BlobPropertyBag) {
    // No implementation needed
  }
} as any;

describe('CSV Parser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('should process CSV data in chunks', (done) => {
    // Create mock file
    const csvContent = 'firstName,lastName,email\nJohn,Doe,john@example.com\nJane,Smith,jane@example.com';
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' });
    
    // Mock data that the worker would process
    const mockChunk1 = {
      data: [{ firstName: 'John', lastName: 'Doe', email: 'john@example.com' }],
      meta: { fields: ['firstName', 'lastName', 'email'] },
      errors: []
    };
    
    const mockChunk2 = {
      data: [{ firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com' }],
      meta: { fields: ['firstName', 'lastName', 'email'] },
      errors: []
    };
    
    // Tracking for assertions
    const processedChunks: any[] = [];
    let isCompleted = false;
    let totalRows = 0;
    
    // Start parsing
    const worker = parseCSVFile(
      file,
      (result) => {
        // Called for each chunk
        processedChunks.push([...result.data]);
      },
      (result) => {
        // Called when parsing is complete
        isCompleted = true;
        totalRows = result.totalRows;
        
        // Assertions
        expect(processedChunks.length).toBe(2);
        expect(processedChunks[0]).toEqual(mockChunk1.data);
        expect(processedChunks[1]).toEqual(mockChunk2.data);
        expect(isCompleted).toBe(true);
        expect(totalRows).toBe(2);
        
        done();
      },
      (error) => {
        // This should not be called in our test
        done(error);
      }
    );
    
    // Simulate worker sending messages
    if (worker && typeof worker === 'object' && 'postMessage' in worker) {
      // First chunk
      worker.postMessage({
        type: 'chunk',
        data: mockChunk1.data,
        fields: mockChunk1.meta.fields,
        errors: mockChunk1.errors
      });
      
      // Second chunk
      worker.postMessage({
        type: 'chunk',
        data: mockChunk2.data,
        fields: mockChunk2.meta.fields,
        errors: mockChunk2.errors
      });
      
      // Complete message
      worker.postMessage({
        type: 'complete',
        totalRows: 2,
        fields: mockChunk1.meta.fields,
        errors: []
      });
    }
  });
  
  test('should handle errors in CSV parsing', (done) => {
    // Create mock file
    const file = new File(['invalid,csv,data'], 'test.csv', { type: 'text/csv' });
    
    // Start parsing
    const worker = parseCSVFile(
      file,
      () => {
        // Should not reach here
      },
      () => {
        // Should not reach here
        done(new Error('Should not complete successfully'));
      },
      (error) => {
        // Error handler should be called
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBe('Test error message');
        done();
      }
    );
    
    // Simulate worker sending error message
    if (worker && typeof worker === 'object' && 'postMessage' in worker) {
      worker.postMessage({
        type: 'error',
        error: 'Test error message'
      });
    }
  });
}); 