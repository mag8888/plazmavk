import mongoose from 'mongoose';

// Railway provides MONGO_URL for MongoDB plugin, but we also support DATABASE_URL
const dbUrl = process.env.DATABASE_URL || process.env.MONGO_URL;

if (!dbUrl) {
  console.error('❌ DATABASE_URL or MONGO_URL not found in environment variables');
  console.error('💡 To use Railway MongoDB, set DATABASE_URL=${{MongoDB.MONGO_URL}}');
}

// Fix MongoDB connection string for Railway compatibility
let fixedDbUrl: string | undefined = undefined;
if (dbUrl) {
  try {
    let url = dbUrl.trim();
    
    // Удаляем неподдерживаемые опции из connection string (до парсинга URL)
    url = url.replace(/[?&]buffermaxentries=\d+/gi, '');
    url = url.replace(/[?&]bufferMaxEntries=\d+/gi, '');
    
    // Для mongodb:// проверяем и исправляем формат
    if (url.startsWith('mongodb://') && !url.includes('mongodb+srv://')) {
      try {
        const urlObj = new URL(url);
        
        // Удаляем неподдерживаемые опции из query параметров
        urlObj.searchParams.delete('buffermaxentries');
        urlObj.searchParams.delete('bufferMaxEntries');
        
        // Если нет pathname (имени базы данных), добавляем по умолчанию
        if (!urlObj.pathname || urlObj.pathname === '/') {
          const defaultDb = process.env.MONGODB_DB_NAME || 'plazma_bot';
          urlObj.pathname = `/${defaultDb}`;
          console.log(`✅ Added default database name: ${defaultDb}`);
        }
        
        // Для Railway MongoDB добавляем authSource=admin если его нет
        if (!urlObj.searchParams.has('authSource')) {
          urlObj.searchParams.set('authSource', 'admin');
          console.log('✅ Added authSource=admin for Railway MongoDB');
        }
        
        url = urlObj.toString();
        
      } catch (urlError) {
        // Если URL парсер не смог распарсить, пробуем простую проверку
        if (!url.includes('/') || url.match(/^mongodb:\/\/[^/]+$/)) {
          const defaultDb = process.env.MONGODB_DB_NAME || 'plazma_bot';
          if (url.includes('?')) {
            url = url.replace('?', `/${defaultDb}?`);
          } else {
            url = `${url}/${defaultDb}`;
          }
          console.log(`✅ Added default database name (fallback): ${defaultDb}`);
        }
      }
    }
    
    fixedDbUrl = url;
  } catch (error) {
    console.error('Error processing database URL:', error);
    fixedDbUrl = dbUrl;
  }
}

if (fixedDbUrl) {
  console.log('Database URL configured:', fixedDbUrl.substring(0, 30) + '...');
  
  if (fixedDbUrl.includes('${{') || fixedDbUrl.includes('proxy.rlwy.net') || fixedDbUrl.includes('mongodb://mongo')) {
    console.log('✅ Railway MongoDB');
  }
}

// Mongoose connection options
const mongooseOptions = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  bufferCommands: false,
};

let isConnected = false;

export async function connectMongoose(): Promise<void> {
  if (isConnected) {
    console.log('✅ Mongoose already connected');
    return;
  }

  if (!fixedDbUrl) {
    throw new Error('DATABASE_URL or MONGO_URL not configured');
  }

  try {
    await mongoose.connect(fixedDbUrl, mongooseOptions);
    isConnected = true;
    console.log('✅ Mongoose connected to MongoDB');
  } catch (error: any) {
    console.error('❌ Mongoose connection error:', error.message);
    throw error;
  }
}

export async function disconnectMongoose(): Promise<void> {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    console.log('✅ Mongoose disconnected');
  } catch (error: any) {
    console.error('❌ Mongoose disconnection error:', error.message);
  }
}

// Handle connection events
mongoose.connection.on('connected', () => {
  console.log('✅ Mongoose connection established');
});

mongoose.connection.on('error', (error) => {
  console.error('❌ Mongoose connection error:', error);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️  Mongoose disconnected');
  isConnected = false;
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await disconnectMongoose();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await disconnectMongoose();
  process.exit(0);
});

export default mongoose;
