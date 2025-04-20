import { NextApiRequest, NextApiResponse } from 'next';
import { getPatientsCollection } from '@/lib/mongodb';
import { patientToJSON, preparePatient, toObjectId } from '@/models/Patient';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const patientsCollection = await getPatientsCollection();

    // GET /api/patients - List all patients
    if (req.method === 'GET') {
      console.log('Fetching all patients');
      const { limit = '50', page = '1', sort = 'createdAt' } = req.query;
      
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;
      
      const sortField = sort as string;
      const sortDirection = sortField.startsWith('-') ? -1 : 1;
      const actualSortField = sortField.startsWith('-') 
        ? sortField.substring(1) 
        : sortField;
      
      // Get total count for pagination
      const total = await patientsCollection.countDocuments();
      
      // Fetch patients with pagination
      const patients = await patientsCollection
        .find({})
        .sort({ [actualSortField]: sortDirection })
        .skip(skip)
        .limit(limitNum)
        .toArray();
      
      console.log(`Fetched ${patients.length} patients`);
      
      return res.status(200).json({
        data: patients.map(patientToJSON),
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum)
        }
      });
    }
    
    // PUT /api/patients - Update multiple patients
    if (req.method === 'PUT') {
      console.log('Updating multiple patients');
      const patients = req.body;
      
      if (!Array.isArray(patients)) {
        return res.status(400).json({ error: 'Expected array of patients' });
      }
      
      console.log('Received patients for update:', patients);
      
      const updateOperations = patients.map(patient => {
        // Ensure we have a valid _id
        if (!patient._id) {
          console.error('Patient is missing _id:', patient);
          throw new Error('Patient is missing _id field');
        }
        
        // Convert string ID to ObjectId
        const objectId = typeof patient._id === 'string' 
          ? toObjectId(patient._id) 
          : patient._id;
          
        console.log(`Preparing update for patient ${patient._id}`);
        
        // Prepare the update without _id field (MongoDB doesn't allow updating _id)
        const { _id, ...updateFields } = preparePatient(patient);
        
        return {
          updateOne: {
            filter: { _id: objectId },
            update: { $set: updateFields },
            upsert: false
          }
        };
      });
      
      if (updateOperations.length > 0) {
        console.log(`Executing ${updateOperations.length} update operations`);
        const result = await patientsCollection.bulkWrite(updateOperations);
        console.log('Update result:', result);
        console.log(`Updated ${result.modifiedCount} patients`);
        return res.status(200).json({ 
          success: true, 
          modifiedCount: result.modifiedCount 
        });
      }
      
      return res.status(200).json({ success: true, modifiedCount: 0 });
    }
    
    // Method not allowed
    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error', details: (error as Error).message });
  }
} 