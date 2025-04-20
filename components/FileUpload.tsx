import React, { useState, useRef } from 'react';
import { parseCSVFile, parseExcelFile, ChunkResult, ParseResult } from '@/lib/fileParser';
import toast from 'react-hot-toast';

interface FileUploadProps {
  onDataChunk: (chunk: ChunkResult) => void;
  onComplete: (result: ParseResult) => void;
  onReset: () => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onDataChunk, onComplete, onReset }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  
  // Reset the upload form
  const handleReset = () => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    setIsUploading(false);
    setProgress(0);
    setFileName(null);
    setError(null);
    onReset();
  };
  
  // Handle file selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setFileName(file.name);
    setError(null);
    setProgress(0);
    
    // Process the selected file
    handleFileUpload(file);
  };
  
  // Handle file upload and parsing
  const handleFileUpload = async (file: File) => {
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    // Validate file type
    if (!fileExtension || !['csv', 'xlsx', 'xls'].includes(fileExtension)) {
      setError('Invalid file type. Please upload a CSV or Excel file.');
      return;
    }
    
    setIsUploading(true);
    toast.loading('Processing file...');
    
    try {
      let processedChunks = 0;
      let totalChunks = 0; // We'll estimate this based on file size
      
      // Estimate total chunks (rough calculation)
      const estimatedRowSize = 200; // bytes per row (average)
      const estimatedChunkSize = 100; // rows per chunk
      totalChunks = Math.ceil(file.size / (estimatedRowSize * estimatedChunkSize));
      
      // Set up chunk processing
      const handleChunk = (result: ChunkResult) => {
        processedChunks++;
        const newProgress = Math.min(95, Math.floor((processedChunks / totalChunks) * 100));
        setProgress(newProgress);
        onDataChunk(result);
      };
      
      // Set up completion handler
      const handleComplete = (result: ParseResult) => {
        setProgress(100);
        setIsUploading(false);
        toast.dismiss();
        toast.success(`Processed ${result.totalRows} records!`);
        onComplete(result);
      };
      
      // Set up error handler
      const handleError = (error: Error) => {
        console.error('File parsing error:', error);
        setError(error.message);
        setIsUploading(false);
        toast.dismiss();
        toast.error('Error processing file');
      };
      
      // Parse the file based on its type
      if (fileExtension === 'csv') {
        workerRef.current = parseCSVFile(file, handleChunk, handleComplete, handleError);
      } else {
        await parseExcelFile(file, handleChunk, handleComplete, handleError);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsUploading(false);
      toast.dismiss();
      toast.error('Unexpected error occurred');
    }
  };
  
  // Allow drag and drop of files
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      setFileName(file.name);
      setError(null);
      setProgress(0);
      handleFileUpload(file);
    }
  };
  
  return (
    <div className="w-full">
      <div
        className={`border-2 border-dashed p-8 rounded-lg text-center ${
          isUploading ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-300'
        } ${error ? 'border-red-300 bg-red-50' : ''}`}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center space-y-2">
            {!fileName ? (
              <>
                <svg
                  className="w-16 h-16 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <p className="text-lg font-medium text-gray-700">
                  Drop your file here, or <span className="text-blue-600">browse</span>
                </p>
                <p className="text-sm text-gray-500">Supports CSV and Excel files (.csv, .xlsx, .xls)</p>
              </>
            ) : (
              <>
                <p className="text-lg font-medium text-gray-700">
                  {fileName}
                </p>
                {isUploading && (
                  <div className="w-full max-w-md mx-auto">
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-blue-600 h-2.5 rounded-full"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">Processing... {progress}%</p>
                  </div>
                )}
              </>
            )}
            
            {error && (
              <div className="text-red-500 text-sm font-medium mt-2">
                <p>{error}</p>
              </div>
            )}
            
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
              disabled={isUploading}
            />
          </div>
          
          <div className="flex justify-center space-x-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className={`px-4 py-2 rounded-md ${
                isUploading
                  ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
              aria-label="Select file"
            >
              Select File
            </button>
            
            {fileName && (
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300"
                aria-label="Reset file upload"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileUpload; 