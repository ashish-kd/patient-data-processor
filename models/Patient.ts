import { ObjectId } from 'mongodb';

// Helper function to convert string ID to ObjectId
export function toObjectId(id: string): ObjectId {
  return new ObjectId(id);
}

// Helper function to prepare a patient object for the database
export function preparePatient(patient: any): any {
  // Create a copy
  const prepared = { ...patient };
  
  // Convert string _id to ObjectId if needed
  if (prepared._id && typeof prepared._id === 'string') {
    prepared._id = toObjectId(prepared._id);
  }
  
  // Add timestamps
  if (!prepared.createdAt) {
    prepared.createdAt = new Date();
  }
  prepared.updatedAt = new Date();
  
  return prepared;
}

// Helper to convert MongoDB patients to JSON-safe format
export function patientToJSON(patient: any): any {
  if (!patient) return null;
  
  const jsonPatient = { ...patient };
  
  // Convert ObjectId to string
  if (jsonPatient._id && typeof jsonPatient._id !== 'string') {
    jsonPatient._id = jsonPatient._id.toString();
  }
  
  // Convert dates to ISO strings
  if (jsonPatient.createdAt instanceof Date) {
    jsonPatient.createdAt = jsonPatient.createdAt.toISOString();
  }
  
  if (jsonPatient.updatedAt instanceof Date) {
    jsonPatient.updatedAt = jsonPatient.updatedAt.toISOString();
  }
  
  return jsonPatient;
} 