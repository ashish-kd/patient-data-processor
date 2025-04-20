import { NextApiRequest, NextApiResponse } from 'next';
import { getPatientsCollection } from '@/lib/mongodb';
import { patientToJSON, toObjectId, preparePatient } from '@/models/Patient';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Get the patient ID from the URL
    const { id } = req.query;
    
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid patient ID' });
    }
    
    const patientsCollection = await getPatientsCollection();
    
    // GET /api/patients/[id] - Get a single patient
    if (req.method === 'GET') {
      console.log(`Fetching patient with ID: ${id}`);
      
      try {
        const patient = await patientsCollection.findOne({ 
          _id: toObjectId(id) 
        });
        
        if (!patient) {
          return res.status(404).json({ error: 'Patient not found' });
        }
        
        return res.status(200).json(patientToJSON(patient));
      } catch (error) {
        console.error('Error fetching patient:', error);
        return res.status(400).json({ error: 'Invalid patient ID format' });
      }
    }
    
    // PUT /api/patients/[id] - Update a single patient
    if (req.method === 'PUT') {
      console.log(`Updating patient with ID: ${id}`);
      const patientData = req.body;
      
      // Ensure the ID in the URL matches the patient object
      if (patientData._id && patientData._id !== id) {
        return res.status(400).json({ 
          error: 'Patient ID in the URL does not match the ID in the request body' 
        });
      }
      
      // Set the ID from the URL
      patientData._id = id;
      
      try {
        // Update the patient
        const result = await patientsCollection.updateOne(
          { _id: toObjectId(id) },
          { $set: preparePatient(patientData) }
        );
        
        if (result.matchedCount === 0) {
          return res.status(404).json({ error: 'Patient not found' });
        }
        
        // Get the updated patient
        const updatedPatient = await patientsCollection.findOne({ 
          _id: toObjectId(id) 
        });
        
        return res.status(200).json(patientToJSON(updatedPatient));
      } catch (error) {
        console.error('Error updating patient:', error);
        return res.status(400).json({ error: 'Invalid patient ID format' });
      }
    }
    
    // DELETE /api/patients/[id] - Delete a single patient
    if (req.method === 'DELETE') {
      console.log(`Deleting patient with ID: ${id}`);
      
      try {
        const result = await patientsCollection.deleteOne({ 
          _id: toObjectId(id) 
        });
        
        if (result.deletedCount === 0) {
          return res.status(404).json({ error: 'Patient not found' });
        }
        
        return res.status(200).json({ success: true });
      } catch (error) {
        console.error('Error deleting patient:', error);
        return res.status(400).json({ error: 'Invalid patient ID format' });
      }
    }
    
    // Method not allowed
    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: (error as Error).message 
    });
  }
} 