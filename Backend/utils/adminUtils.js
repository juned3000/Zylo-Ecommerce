const fs = require('fs').promises;
const path = require('path');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Coupon = require('../models/Coupon');

// Data export utilities
class DataExporter {
  static async exportToCSV(data, filename) {
    if (!data || data.length === 0) {
      throw new Error('No data to export');
    }

    // Get headers from first object
    const headers = Object.keys(data[0]);
    let csv = headers.join(',') + '\n';

    // Add data rows
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        // Handle commas and quotes in values
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value || '';
      });
      csv += values.join(',') + '\n';
    }

    // Ensure exports directory exists
    const exportsDir = path.join(__dirname, '../exports');
    try {
      await fs.mkdir(exportsDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    // Write file
    const filePath = path.join(exportsDir, filename);
    await fs.writeFile(filePath, csv, 'utf8');

    return filePath;
  }

  static async exportUsersData() {
    try {
      const users = await User.find()
        .select('-passwordHash')
        .lean();

      const userData = users.map(user => ({
        id: user._id.toString(),
        name: user.name || 'N/A',
        email: user.email,
        isAdmin: user.isAdmin ? 'Yes' : 'No',
        joinedDate: user.createdAt ? user.createdAt.toISOString().split('T')[0] : 'N/A',
        addressCount: user.addresses ? user.addresses.length : 0,
        wishlistCount: user.wishlist ? user.wishlist.length : 0
      }));

      const filename = `users-export-${new Date().toISOString().split('T')[0]}.csv`;
      return await this.exportToCSV(userData, filename);
    } catch (error) {
      throw new Error(`Failed to export users: ${error.message}`);
    }
  }

  static async exportProductsData() {
    try {
      const products = await Product.find().lean();

      const productData = products.map(product => ({
        id: product.id,
        name: product.name,
        brand: product.brand,
        category: product.category,
        price: product.price,
        stock: product.stock,
        sizes: product.sizes ? product.sizes.join(';') : '',
        description: product.description || '',
        createdDate: product.createdAt ? product.createdAt.toISOString().split('T')[0] : 'N/A'
      }));

      const filename = `products-export-${new Date().toISOString().split('T')[0]}.csv`;
      return await this.exportToCSV(productData, filename);
    } catch (error) {
      throw new Error(`Failed to export products: ${error.message}`);
    }
  }

  static async exportOrdersData(startDate = null, endDate = null) {
    try {
      let filter = {};
      if (startDate && endDate) {
        filter.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }

      const orders = await Order.find(filter)
        .populate('userId', 'name email')
        .lean();

      const orderData = orders.map(order => ({
        id: order.id,
        customer: order.userId?.name || 'Unknown',
        customerEmail: order.userId?.email || 'N/A',
        orderDate: order.createdAt ? order.createdAt.toISOString().split('T')[0] : 'N/A',
        status: order.orderStatus,
        itemsCount: order.items ? order.items.length : 0,
        subtotal: order.totals?.subtotal || 0,
        shipping: order.totals?.shipping || 0,
        tax: order.totals?.tax || 0,
        total: order.totals?.total || 0,
        paymentMethod: order.paymentMethod || 'N/A',
        shippingAddress: order.shippingAddress ? 
          `${order.shippingAddress.street}, ${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.pincode}` : 
          'N/A'
      }));

      const dateRange = startDate && endDate ? `${startDate}-to-${endDate}` : 'all-time';
      const filename = `orders-export-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`;
      return await this.exportToCSV(orderData, filename);
    } catch (error) {
      throw new Error(`Failed to export orders: ${error.message}`);
    }
  }

  static async exportCouponsData() {
    try {
      const coupons = await Coupon.find()
        .populate('createdBy', 'name email')
        .lean();

      const couponData = coupons.map(coupon => ({
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        minimumOrderValue: coupon.minimumOrderValue,
        maximumDiscount: coupon.maximumDiscount || 'N/A',
        usageLimit: coupon.usageLimit || 'Unlimited',
        usedCount: coupon.usedCount || 0,
        validFrom: coupon.validFrom ? coupon.validFrom.toISOString().split('T')[0] : 'N/A',
        validTo: coupon.validTo ? coupon.validTo.toISOString().split('T')[0] : 'N/A',
        isActive: coupon.isActive ? 'Yes' : 'No',
        createdBy: coupon.createdBy?.name || 'N/A',
        createdDate: coupon.createdAt ? coupon.createdAt.toISOString().split('T')[0] : 'N/A'
      }));

      const filename = `coupons-export-${new Date().toISOString().split('T')[0]}.csv`;
      return await this.exportToCSV(couponData, filename);
    } catch (error) {
      throw new Error(`Failed to export coupons: ${error.message}`);
    }
  }
}

// Analytics utilities
class AnalyticsCalculator {
  static async calculateSalesMetrics(period = '30d') {
    try {
      const now = new Date();
      let startDate;
      
      switch (period) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      const orders = await Order.find({
        createdAt: { $gte: startDate },
        orderStatus: { $in: ['confirmed', 'processing', 'shipped', 'delivered'] }
      }).lean();

      const totalRevenue = orders.reduce((sum, order) => sum + (order.totals?.total || 0), 0);
      const totalOrders = orders.length;
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Calculate daily sales
      const dailySales = {};
      orders.forEach(order => {
        const date = order.createdAt.toISOString().split('T')[0];
        if (!dailySales[date]) {
          dailySales[date] = { revenue: 0, orders: 0 };
        }
        dailySales[date].revenue += order.totals?.total || 0;
        dailySales[date].orders += 1;
      });

      return {
        totalRevenue,
        totalOrders,
        averageOrderValue,
        dailySales,
        period
      };
    } catch (error) {
      throw new Error(`Failed to calculate sales metrics: ${error.message}`);
    }
  }

  static async calculateTopProducts(limit = 10, period = '30d') {
    try {
      const now = new Date();
      let startDate;
      
      switch (period) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      const topProducts = await Order.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.id',
            name: { $first: '$items.name' },
            brand: { $first: '$items.brand' },
            totalSold: { $sum: '$items.quantity' },
            revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
          }
        },
        { $sort: { totalSold: -1 } },
        { $limit: limit }
      ]);

      return topProducts;
    } catch (error) {
      throw new Error(`Failed to calculate top products: ${error.message}`);
    }
  }

  static async calculateCustomerMetrics() {
    try {
      const totalCustomers = await User.countDocuments({ isAdmin: { $ne: true } });
      const totalAdmins = await User.countDocuments({ isAdmin: true });

      // Calculate new customers in the last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const newCustomers = await User.countDocuments({
        isAdmin: { $ne: true },
        createdAt: { $gte: thirtyDaysAgo }
      });

      // Calculate repeat customers (customers with more than 1 order)
      const repeatCustomers = await Order.aggregate([
        { $group: { _id: '$userId', orderCount: { $sum: 1 } } },
        { $match: { orderCount: { $gt: 1 } } },
        { $count: 'repeatCustomers' }
      ]);

      return {
        totalCustomers,
        totalAdmins,
        newCustomers,
        repeatCustomers: repeatCustomers.length > 0 ? repeatCustomers[0].repeatCustomers : 0
      };
    } catch (error) {
      throw new Error(`Failed to calculate customer metrics: ${error.message}`);
    }
  }

  static async calculateInventoryMetrics() {
    try {
      const products = await Product.find().lean();
      
      const totalProducts = products.length;
      const lowStockProducts = products.filter(p => p.stock < 10).length;
      const outOfStockProducts = products.filter(p => p.stock === 0).length;
      const totalValue = products.reduce((sum, p) => sum + (p.price * p.stock), 0);

      // Calculate by category
      const categoryStats = {};
      products.forEach(product => {
        if (!categoryStats[product.category]) {
          categoryStats[product.category] = {
            count: 0,
            totalValue: 0,
            lowStock: 0,
            outOfStock: 0
          };
        }
        categoryStats[product.category].count++;
        categoryStats[product.category].totalValue += product.price * product.stock;
        if (product.stock < 10) categoryStats[product.category].lowStock++;
        if (product.stock === 0) categoryStats[product.category].outOfStock++;
      });

      return {
        totalProducts,
        lowStockProducts,
        outOfStockProducts,
        totalValue,
        categoryStats
      };
    } catch (error) {
      throw new Error(`Failed to calculate inventory metrics: ${error.message}`);
    }
  }
}

// Email notification utilities
class EmailNotifier {
  static async sendLowStockAlert(products, adminEmail) {
    // This would integrate with your email service
    // For now, we'll just log the alert
    console.log(`Low stock alert for ${products.length} products:`, products.map(p => `${p.name} (${p.stock} left)`));
    // TODO: Implement email sending using nodemailer
  }

  static async sendOrderStatusUpdate(order, customerEmail) {
    // This would send order status update emails
    console.log(`Order status update for ${order.id}: ${order.orderStatus} to ${customerEmail}`);
    // TODO: Implement email sending
  }

  static async sendNewOrderAlert(order, adminEmail) {
    // This would send new order alerts to admin
    console.log(`New order alert: ${order.id} for ₹${order.totals?.total} to ${adminEmail}`);
    // TODO: Implement email sending
  }
}

// Database backup utilities
class BackupManager {
  static async createDatabaseBackup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = path.join(__dirname, '../backups');
      
      // Ensure backup directory exists
      await fs.mkdir(backupDir, { recursive: true });

      // Export collections
      const collections = {
        users: await User.find().lean(),
        products: await Product.find().lean(),
        orders: await Order.find().lean(),
        coupons: await Coupon.find().lean()
      };

      const backupFile = path.join(backupDir, `backup-${timestamp}.json`);
      await fs.writeFile(backupFile, JSON.stringify(collections, null, 2));

      return {
        filename: `backup-${timestamp}.json`,
        path: backupFile,
        size: (await fs.stat(backupFile)).size,
        collections: Object.keys(collections).map(key => ({
          name: key,
          count: collections[key].length
        }))
      };
    } catch (error) {
      throw new Error(`Failed to create backup: ${error.message}`);
    }
  }

  static async listBackups() {
    try {
      const backupDir = path.join(__dirname, '../backups');
      
      try {
        const files = await fs.readdir(backupDir);
        const backupFiles = files.filter(f => f.startsWith('backup-') && f.endsWith('.json'));
        
        const backups = await Promise.all(backupFiles.map(async (file) => {
          const filePath = path.join(backupDir, file);
          const stats = await fs.stat(filePath);
          return {
            filename: file,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime
          };
        }));

        return backups.sort((a, b) => new Date(b.created) - new Date(a.created));
      } catch (error) {
        // Backup directory doesn't exist
        return [];
      }
    } catch (error) {
      throw new Error(`Failed to list backups: ${error.message}`);
    }
  }
}

module.exports = {
  DataExporter,
  AnalyticsCalculator,
  EmailNotifier,
  BackupManager
};
