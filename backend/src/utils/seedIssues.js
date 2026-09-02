require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Issue = require('../models/Issue');

const seedIssues = async () => {
  try {
    const coreUri = process.env.MONGO_DB_1_URI || process.env.MONGODB_URI_CORE || process.env.MONGODB_URI || 'mongodb://localhost:27017/superui_db1_catalog';
    console.log('Connecting to MongoDB Core:', coreUri);
    await mongoose.connect(coreUri);

    console.log('Seeding sample customer raised support issues...');
    await Issue.deleteMany({});

    const sampleIssues = [
      {
        name: 'Amit Patel',
        email: 'amit.patel@techfirm.in',
        issueType: 'Download Issue',
        subject: 'Download token expired for order #ORD_SUP_84920',
        description: 'I attempted to download the SuperUI Glassmorphic Pro Kit zip file after payment, but the link returned an expired token error.',
        orderId: 'ORD_SUP_84920',
        status: 'open',
        priority: 'high'
      },
      {
        name: 'Kavita Sundaram',
        email: 'kavita@startupstudio.dev',
        issueType: 'Payment Problem',
        subject: 'Razorpay payment confirmation pending',
        description: 'Payment was deducted via UPI for order #ORD_SUP_92014, but page did not redirect automatically to confirmation area.',
        orderId: 'ORD_SUP_92014',
        status: 'in_progress',
        priority: 'urgent'
      },
      {
        name: 'Deepak Joshi',
        email: 'deepak@cloudnode.io',
        issueType: 'Bug Report',
        subject: 'Tailwind v3 config import issue in Next.js 14 template',
        description: 'Need assistance resolving custom font family theme extension in tailwind.config.js for Apex Cloud template.',
        orderId: 'ORD_SUP_10482',
        status: 'resolved',
        priority: 'medium'
      }
    ];

    await Issue.create(sampleIssues);
    console.log('Successfully seeded 3 sample customer issue tickets in MongoDB Issue collection!');
    process.exit(0);
  } catch (err) {
    console.error('Failed to seed issues:', err);
    process.exit(1);
  }
};

seedIssues();
