import mongoose from 'mongoose';
import { multiTenantPlugin } from './multiTenantPlugin';

// Plugin will be applied below if not already registered

if (!process.env.MONGODB_URI) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('dotenv').config({ path: '.env.local' });
    if (!process.env.MONGODB_URI) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('dotenv').config();
    }
  } catch {
    // ignore
  }
}

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

let cached = global.mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null, pluginRegistered: false } as any;
}

if (!(cached as any).pluginRegistered) {
  mongoose.plugin(multiTenantPlugin);
  (cached as any).pluginRegistered = true;
}

// In development, clear Mongoose models on hot reload to prevent schema caching issues
if (process.env.NODE_ENV !== 'production') {
  (mongoose as any).models = {};
  (mongoose as any).modelSchemas = {};
}

async function dbConnect() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      return mongoose as any;
    });
  }
  cached.conn = await cached.promise;

  // Temporarily drop old indexes that conflict with multi-company setup
  try {
    const db = mongoose.connection.db;
    if (db) {
      await db.collection('shifts').dropIndex('shiftName_1').catch(() => { });
      await db.collection('leavepolicies').dropIndex('leaveCode_1').catch(() => { });
      await db.collection('payrolls').dropIndex('userId_1_month_1_year_1').catch(() => { });
    }
  } catch (e) {
    console.error('Error dropping indexes:', e);
  }

  return cached.conn;
}

export default dbConnect;
