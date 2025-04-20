import { NextApiRequest, NextApiResponse } from 'next';
import { getPatientsCollection } from '@/lib/mongodb';
import { preparePatient } from '@/models/Patient';

// Set a higher limit for the JSON body parser
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    console.log('Receiving patient data upload');
    const { patients } = req.body;
    
    if (!Array.isArray(patients) || patients.length === 0) {
      return res.status(400).json({ error: 'Invalid or empty patients array' });
    }
    
    console.log(`Processing ${patients.length} patients`);
    
    // Get reference to collection
    const patientsCollection = await getPatientsCollection();
    
    // Prepare patients for insertion
    const documents = patients.map(patient => preparePatient(patient));
    
    // Insert all documents
    const result = await patientsCollection.insertMany(documents);
    
    console.log('Upload processed successfully', {
      insertedCount: result.insertedCount
    });
    
    return res.status(200).json({
      success: true,
      count: patients.length,
      insertedCount: result.insertedCount
    });
  } catch (error) {
    console.error('Upload processing error:', error);
    return res.status(500).json({ 
      error: 'Failed to process upload', 
      details: (error as Error).message 
    });
  }
} 