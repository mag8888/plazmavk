# EM2 Game Deployment Instructions

## Railway Deployment

1. **Environment Variables Setup**
   Set the following environment variables in Railway:
   - `MONGODB_URI`: Your MongoDB Atlas connection string
   - `MONGODB_DB_NAME`: Database name (e.g., `em2_game`)
   - `JWT_SECRET`: A secure random string for JWT tokens
   - `NODE_ENV`: Set to `production`

2. **MongoDB Atlas Setup**
   - Create a MongoDB Atlas cluster
   - Create a database user with read/write permissions
   - Whitelist Railway's IP addresses (or use 0.0.0.0/0 for all IPs)
   - Get the connection string and set it as `MONGODB_URI`

3. **Deploy to Railway**
   - Connect your GitHub repository to Railway
   - Railway will automatically detect the Node.js project
   - The `railway.toml` file contains the deployment configuration
   - The app will start using `npm start` which runs `server-main.js`

## Key Changes Made

1. **Database Migration**: Migrated from SQLite to MongoDB Atlas
2. **Caching Fix**: Added `Cache-Control: no-store` headers to prevent 304 responses
3. **Server Update**: Updated main server file to `server-main.js` with MongoDB integration
4. **Models**: Created MongoDB models for Room, User, and BankAccount
5. **Environment**: Added proper environment variable configuration

## Health Check

The application provides a health check endpoint at `/api/health` that Railway uses to monitor the service.

## Troubleshooting

- Check Railway logs for any startup errors
- Ensure MongoDB Atlas connection string is correct
- Verify that all environment variables are set properly
- Check that the MongoDB Atlas cluster allows connections from Railway

