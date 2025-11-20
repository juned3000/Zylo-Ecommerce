const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Security middleware
app.use(helmet());

// Rate limiting - more lenient for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // 1000 requests for dev, 100 for production
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil(15 * 60) // seconds until reset
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for health checks in development
    if (process.env.NODE_ENV !== 'production' && req.path === '/api/health') {
      return true;
    }
    return false;
  }
});
app.use('/api/', limiter);

// CORS configuration (honor ALLOWED_ORIGINS from .env if provided)
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:5500,http://127.0.0.1:5500,http://localhost:8080,http://127.0.0.1:8080')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
app.use(cors({
  origin: function(origin, callback){
    // Allow non-browser tools and local file:// origins in development
    if (process.env.NODE_ENV !== 'production' && (!origin || origin === 'null')) {
      return callback(null, true);
    }
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/products', require('./routes/products'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/wishlist', require('./routes/wishlist'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/addresses', require('./routes/addresses'));
app.use('/api/coupons', require('./routes/coupons'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api/admin', require('./routes/admin'));

// Enhanced health check endpoint with database monitoring
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'OK',
    message: 'Zylo Backend API is running',
    timestamp: new Date().toISOString(),
    database: {
      status: 'unknown',
      connection: 'unknown',
      responseTime: null
    },
    server: {
      uptime: Math.floor(process.uptime()),
      memory: process.memoryUsage(),
      node_version: process.version
    }
  };

  try {
    // Test database connection with a simple ping
    const startTime = Date.now();
    const dbState = mongoose.connection.readyState;
    
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    const connectionStates = {
      0: 'disconnected',
      1: 'connected', 
      2: 'connecting',
      3: 'disconnecting'
    };
    
    health.database.connection = connectionStates[dbState] || 'unknown';
    
    if (dbState === 1) {
      // Test actual database operation
      await mongoose.connection.db.admin().ping();
      health.database.status = 'healthy';
      health.database.responseTime = Date.now() - startTime;
    } else {
      health.database.status = 'unhealthy';
      health.status = 'DEGRADED';
    }
  } catch (error) {
    health.database.status = 'error';
    health.database.error = error.message;
    health.status = 'DEGRADED';
    console.error('💥 Health check database error:', error.message);
  }

  const statusCode = health.status === 'OK' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Detailed database diagnostics endpoint
app.get('/api/diagnostics/database', async (req, res) => {
  try {
    const diagnostics = {
      connection: {
        state: mongoose.connection.readyState,
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        name: mongoose.connection.name
      },
      collections: {},
      performance: {}
    };

    if (mongoose.connection.readyState === 1) {
      // Get collection stats
      const Product = require('./models/Product');
      
      const startTime = Date.now();
      const productCount = await Product.countDocuments();
      diagnostics.performance.productCountTime = Date.now() - startTime;
      
      const sampleStartTime = Date.now();
      const sampleProducts = await Product.find().limit(5).select('id name category');
      diagnostics.performance.sampleQueryTime = Date.now() - sampleStartTime;
      
      diagnostics.collections.products = {
        count: productCount,
        sample: sampleProducts.map(p => ({ id: p.id, name: p.name, category: p.category }))
      };
    }

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      diagnostics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Diagnostics failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 404 handler (Express 5 compatible - catch-all without path)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found'
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Error:', error);
  
  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors
    });
  }
  
  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format'
    });
  }
  
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    return res.status(400).json({
      success: false,
      message: `${field} already exists`
    });
  }
  
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 5000;

// MongoDB connection configuration
const mongooseOptions = {
  maxPoolSize: 10, // Maintain up to 10 socket connections
  serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds
  connectTimeoutMS: 10000, // Give up initial connection after 10 seconds
  heartbeatFrequencyMS: 10000, // How often to check the connection
  maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
};

// Enhanced MongoDB connection with better error handling
const connectMongoDB = async () => {
  try {
    const connection = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/zylo-ecommerce', mongooseOptions);
    
    console.log('✅ Connected to MongoDB');
    console.log(`📊 Database: ${connection.connections[0].name}`);
    console.log(`🔗 Host: ${connection.connections[0].host}:${connection.connections[0].port}`);
    
    return connection;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    throw error;
  }
};

// MongoDB event listeners for connection monitoring
mongoose.connection.on('connected', () => {
  console.log('🔄 MongoDB connected');
});

mongoose.connection.on('error', (err) => {
  console.error('💥 MongoDB connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('🔄 MongoDB reconnected');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  await mongoose.connection.close();
  console.log('📴 MongoDB connection closed');
  process.exit(0);
});

// Connect to MongoDB and start server with retry logic
const startServer = async () => {
  let retries = 5;
  
  while (retries > 0) {
    try {
      await connectMongoDB();
      
      app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`🏥 API Health Check: http://localhost:${PORT}/api/health`);
      });
      
      return; // Success, exit retry loop
    } catch (error) {
      retries--;
      console.error(`❌ Failed to start server (${5-retries}/5 attempts):`, error.message);
      
      if (retries === 0) {
        console.error('💀 All connection attempts failed. Exiting...');
        process.exit(1);
      }
      
      console.log(`⏳ Retrying in 5 seconds... (${retries} attempts remaining)`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
};

startServer();

module.exports = app;
