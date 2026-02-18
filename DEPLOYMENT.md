# RapidCare Hospital Management System - Deployment Guide

## Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or MongoDB Atlas)
- Git

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
PORT=5000
NODE_ENV=production

# Database Configuration
MONGO_URI=mongodb://localhost:27017/rapidcare
# For production MongoDB Atlas:
# MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/rapidcare?retryWrites=true&w=majority

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here-change-this-in-production

# Base URL for QR codes and API endpoints
BASE_URL=http://localhost:5000
# For production:
# BASE_URL=https://your-domain.com

# Optional: File upload configuration
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads

# Optional: CORS configuration
CORS_ORIGIN=*
# For production, specify your domain:
# CORS_ORIGIN=https://your-domain.com
```

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd rapidcare
```

2. Install dependencies:
```bash
npm install
```

3. Create the `.env` file with your configuration

4. Start the server:
```bash
npm start
```

## Production Deployment

### Using PM2 (Recommended)

1. Install PM2 globally:
```bash
npm install -g pm2
```

2. Create a PM2 ecosystem file (`ecosystem.config.js`):
```javascript
module.exports = {
  apps: [{
    name: 'rapidcare',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 5000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000
    }
  }]
};
```

3. Start with PM2:
```bash
pm2 start ecosystem.config.js --env production
```

4. Save PM2 configuration:
```bash
pm2 save
pm2 startup
```

### Using Docker

1. Create a `Dockerfile`:
```dockerfile
FROM node:16-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 5000

CMD ["npm", "start"]
```

2. Build and run:
```bash
docker build -t rapidcare .
docker run -p 5000:5000 --env-file .env rapidcare
```

### Using Nginx (Reverse Proxy)

1. Install Nginx
2. Create a configuration file `/etc/nginx/sites-available/rapidcare`:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

3. Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/rapidcare /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Database Setup

### Local MongoDB
1. Install MongoDB
2. Start MongoDB service
3. The application will automatically create the database and collections

### MongoDB Atlas (Cloud)
1. Create a MongoDB Atlas account
2. Create a new cluster
3. Get the connection string
4. Update `MONGO_URI` in your `.env` file

## Security Considerations

1. **Change JWT Secret**: Use a strong, random JWT secret in production
2. **HTTPS**: Use HTTPS in production (Let's Encrypt recommended)
3. **CORS**: Configure CORS properly for your domain
4. **File Uploads**: Set appropriate file size limits
5. **Environment Variables**: Never commit `.env` files to version control

## Monitoring

### PM2 Monitoring
```bash
pm2 monit
pm2 logs
```

### Health Check
The application provides a health check endpoint:
```
GET /api/health
```

## Backup

### Database Backup
```bash
# MongoDB local backup
mongodump --db rapidcare --out ./backup

# MongoDB Atlas backup (automatic with Atlas)
```

### File Backup
```bash
# Backup uploads directory
tar -czf uploads-backup.tar.gz uploads/
```

## Troubleshooting

### Common Issues

1. **Port already in use**: Change the PORT in `.env` or kill the process using the port
2. **MongoDB connection failed**: Check your MONGO_URI and ensure MongoDB is running
3. **File upload issues**: Check file permissions and disk space
4. **QR code generation fails**: Ensure the uploads directory exists and is writable

### Logs
- Application logs: Check PM2 logs or console output
- Nginx logs: `/var/log/nginx/error.log`
- MongoDB logs: Check MongoDB log files

## Performance Optimization

1. **Enable gzip compression** in Nginx
2. **Use CDN** for static assets
3. **Implement caching** for frequently accessed data
4. **Database indexing** for better query performance
5. **Load balancing** for high traffic

## Updates

1. Pull latest changes:
```bash
git pull origin main
```

2. Install new dependencies:
```bash
npm install
```

3. Restart the application:
```bash
pm2 restart rapidcare
```

## Support

For issues and support, please check the logs and ensure all environment variables are properly configured.
