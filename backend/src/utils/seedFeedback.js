require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Feedback = require('../models/Feedback');

const seedFeedback = async () => {
  try {
    const coreUri = process.env.MONGODB_URI_CORE || process.env.MONGODB_URI || 'mongodb://localhost:27017/superui_core';
    console.log('Connecting to MongoDB Core:', coreUri);
    await mongoose.connect(coreUri);

    console.log('Seeding sample customer feedback entries...');
    await Feedback.deleteMany({});

    const sampleFeedbacks = [
      {
        name: 'Rahul Kumar',
        email: 'rahul.kumar@devmail.com',
        rating: 5,
        comment: 'The Tailwind architecture and component setup saved our frontend team over 100 hours of development time!',
        recommend: true,
        orderId: 'ORD_SUP_84920',
        featured: true,
        status: 'approved'
      },
      {
        name: 'Priya Sharma',
        email: 'priya.sharma@designstudio.io',
        rating: 5,
        comment: 'Razorpay payment was instant and the download token arrived in my inbox in under 30 seconds. Brilliant service.',
        recommend: true,
        orderId: 'ORD_SUP_92014',
        featured: true,
        status: 'approved'
      },
      {
        name: 'Arun Verma',
        email: 'arun@saasfounder.co',
        rating: 5,
        comment: 'SuperUI templates helped us launch our MVP in 3 days. Clean code and responsive components!',
        recommend: true,
        orderId: 'ORD_SUP_10482',
        featured: true,
        status: 'approved'
      },
      {
        name: 'Sneha Patel',
        email: 'sneha.patel@ui-arch.com',
        rating: 4,
        comment: 'Great design system components. Dark mode looks crisp on all mobile breakpoints.',
        recommend: true,
        orderId: 'ORD_SUP_39281',
        featured: false,
        status: 'approved'
      }
    ];

    await Feedback.create(sampleFeedbacks);
    console.log('Successfully seeded 4 sample feedback entries in MongoDB Feedback collection!');
    process.exit(0);
  } catch (err) {
    console.error('Failed to seed feedback:', err);
    process.exit(1);
  }
};

seedFeedback();
