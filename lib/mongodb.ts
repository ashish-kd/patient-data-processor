import { MongoClient, ServerApiVersion } from 'mongodb';

declare const env: { MONGODB_URI?: string };

console.log('NODE_ENV:', process.env.MONGODB_URI);
// Ensure we have the URI from Wrangler’s vars/secrets
if (!process.env.MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

const uri = process.env.MONGODB_URI;
const options = {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  // In development with Next.js (Node), you still get NODE_ENV.
  // Use a global to preserve the client across HMR reloads.
  let globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
  };

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  // In the Cloudflare Worker (production), just connect once.
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise;

export async function getDb() {
  const client = await clientPromise;
  return client.db();
}

export async function getPatientsCollection() {
  const db = await getDb();
  return db.collection('patients');
}

// Log connection status (optional)
clientPromise
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Failed to connect to MongoDB', err));
