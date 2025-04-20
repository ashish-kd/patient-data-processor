import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import FileUpload from '@/components/FileUpload';
import PatientTable from '@/components/PatientTable';
import { ChunkResult, ParseResult } from '@/lib/fileParser';

export default function Home() {
  const [patientData, setPatientData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Fetch patients on component mount
  useEffect(() => {
    fetchPatients();
  }, []);
  
  // Fetch patients from API
  const fetchPatients = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/patients');
      
      if (!response.ok) {
        throw new Error('Failed to fetch patients');
      }
      
      const data = await response.json();
      
      // Extract columns from the data
      const allColumns = new Set<string>();
      if (data.data && data.data.length > 0) {
        data.data.forEach((patient: any) => {
          Object.keys(patient).forEach(key => {
            // Skip internal fields
            if (!['_id', 'createdAt', 'updatedAt'].includes(key)) {
              allColumns.add(key);
            }
          });
        });
      }
      
      console.log('Fetched patients:', data.data);
      console.log('Detected columns:', Array.from(allColumns));
      
      // Set the patient data and columns
      setPatientData(data.data || []);
      setColumns(Array.from(allColumns));
      
    } catch (error) {
      console.error('Error fetching patients:', error);
      toast.error('Failed to fetch patients');
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Handle receipt of a data chunk from file parsing
  const handleDataChunk = useCallback((chunk: ChunkResult) => {
    setIsUploading(true);
    
    // Extract fields from the chunk
    if (chunk.fields && chunk.fields.length > 0) {
      setColumns(prevColumns => {
        const newColumns = new Set([...prevColumns]);
        chunk.fields.forEach(field => {
          // Skip internal fields
          if (!['_id', 'createdAt', 'updatedAt'].includes(field)) {
            newColumns.add(field);
          }
        });
        return Array.from(newColumns);
      });
    }
    
    // Process this chunk and send to the API
    if (chunk.data && chunk.data.length > 0) {
      console.log('Processing chunk with', chunk.data.length, 'patients');
      sendChunkToApi(chunk.data);
    }
  }, []);
  
  // Send a chunk of patient data to the API
  const sendChunkToApi = async (patients: any[]) => {
    try {
      const response = await fetch('/api/patients/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ patients }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload patients');
      }
      
      const result = await response.json();
      console.log('Chunk upload result:', result);
      
      // No need to handle the response here
      // We'll refresh the patient list after all chunks are done
    } catch (error) {
      console.error('Error uploading patient chunk:', error);
      toast.error('Error uploading data chunk');
    }
  };
  
  // Handle completion of file parsing
  const handleParseComplete = useCallback(async (result: ParseResult) => {
    console.log(`File parsing complete. Processed ${result.totalRows} rows.`);
    toast.success(`Processed ${result.totalRows} records!`);
    
    // Small delay to ensure all API operations have completed
    setTimeout(async () => {
      // Refresh the patient list
      await fetchPatients();
      setIsUploading(false);
    }, 500);
  }, [fetchPatients]);
  
  // Handle resetting the file upload
  const handleReset = () => {
    setIsUploading(false);
  };
  
  return (
    <>
      <Head>
        <title>Patient Data Processor</title>
        <meta name="description" content="Upload and manage patient data" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <h1 className="text-3xl font-bold mb-6">Patient Data Processor</h1>
        
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Upload Patient Data</h2>
          <FileUpload
            onDataChunk={handleDataChunk}
            onComplete={handleParseComplete}
            onReset={handleReset}
          />
        </div>
        
        <div>
          <h2 className="text-xl font-semibold mb-4">Patients</h2>
          <PatientTable
            data={patientData}
            columns={columns}
            isLoading={isLoading || isUploading}
          />
        </div>
      </main>
      
      <Toaster position="bottom-right" />
    </>
  );
} 