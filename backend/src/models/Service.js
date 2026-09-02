const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    heroTitle: {
      type: String,
      default: ''
    },
    heroSubtitle: {
      type: String,
      default: ''
    },
    image: {
      type: String,
      required: true,
      trim: true
    },
    bgImage: {
      type: String,
      default: ''
    },
    features: {
      type: [String],
      default: []
    },
    techStack: {
      type: [String],
      default: []
    },
    pricingNote: {
      type: String,
      default: ''
    },
    fullContent: {
      type: String,
      default: ''
    },
    link: {
      type: String,
      default: '/contact',
      trim: true
    },
    order: {
      type: Number,
      default: 0
    },
    visible: {
      type: Boolean,
      default: true
    },
    code: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

const { getOperationsConnection } = require('../config/db');
const Service = getOperationsConnection().model('Service', serviceSchema);

const DEFAULT_SERVICES = [
  {
    title: 'Website Development',
    slug: 'website-development',
    description: 'Modern, responsive websites built for performance, usability, and business growth.',
    heroTitle: 'High-Performance Custom Website Development',
    heroSubtitle: 'Hand-crafted React & Next.js web applications engineered for lightning speed, mobile responsiveness, and maximum conversions.',
    image: 'https://beeimg.com/images/w86857036683.jpg',
    bgImage: '',
    features: [
      'Custom React & Next.js Architecture',
      'Pixel-perfect Responsive Mobile & Desktop Layouts',
      'High Converting UX/UI Design & Micro-interactions',
      '100% Core Web Vitals & Technical SEO Optimization',
      'CMS Integration (Headless / Sanity / WordPress API)',
      '14-Day Post-Launch Engineering Support'
    ],
    techStack: ['React', 'Tailwind CSS', 'Node.js', 'Vite', 'TypeScript', 'SEO'],
    pricingNote: 'Delivered in 1-2 weeks',
    fullContent: 'We design and develop custom websites that represent your brand with perfection.',
    link: '/services/website-development',
    order: 1,
    visible: true,
    code: ''
  },
  {
    title: 'E-commerce Development',
    slug: 'ecommerce-development',
    description: 'Complete online stores with products, cart, checkout, payments, orders, and admin management.',
    heroTitle: 'Full-Scale Custom E-commerce & Storefront Systems',
    heroSubtitle: 'Scalable online store solutions equipped with catalog management, seamless cart & checkout, multi-gateway payments, and order tracking.',
    image: 'https://beeimg.com/images/o35174122281.jpg',
    bgImage: '',
    features: [
      'Product Storefront & Category Filtering Engine',
      'Instant Cart, Wishlist & One-Click Checkout Flow',
      'Razorpay, Stripe & UPI Payment Gateways Integration',
      'Automated PDF Invoice Generation & Email Alerts',
      'Customer Order Tracking & Account Security',
      'Inventory & Stock Admin Dashboard'
    ],
    techStack: ['React', 'Node.js', 'MongoDB', 'Razorpay API', 'Tailwind', 'Express'],
    pricingNote: 'Complete Storefront Engine',
    fullContent: 'Build a profitable online business with our enterprise-grade custom e-commerce platforms.',
    link: '/services/ecommerce-development',
    order: 2,
    visible: true,
    code: ''
  },
  {
    title: 'SaaS Development',
    slug: 'saas-development',
    description: 'Scalable SaaS applications with authentication, dashboards, APIs, databases, and business workflows.',
    heroTitle: 'Production-Ready Enterprise SaaS Application Development',
    heroSubtitle: 'End-to-end Software-as-a-Service platforms featuring secure authentication, multi-tenant architecture, analytics, and payment billing.',
    image: 'https://beeimg.com/images/u04927086191.jpg',
    bgImage: '',
    features: [
      'JWT & OAuth2 Secure Authentication Architecture',
      'Interactive Analytics & Metrics Dashboard',
      'RESTful APIs & Microservices Integration',
      'Stripe & Razorpay Recurring Subscription Billing',
      'Role-Based Access Control (RBAC Admin & Customer)',
      'Automated Database Backups & Scalable Hosting'
    ],
    techStack: ['React', 'Express.js', 'MongoDB DB1-4', 'MFA Security', 'Docker', 'AWS'],
    pricingNote: 'Full MVP in 3-4 weeks',
    fullContent: 'Launch your SaaS business quickly with clean code, secure backend, and modern admin UI.',
    link: '/services/saas-development',
    order: 3,
    visible: true,
    code: ''
  },
  {
    title: 'Landing Pages & Dashboards',
    slug: 'landing-pages-dashboards',
    description: 'High-converting landing pages and powerful admin dashboards designed for clarity, speed, and results.',
    heroTitle: 'High-Converting Landing Pages & Admin Dashboards',
    heroSubtitle: 'Tailored landing pages built to maximize conversion rates alongside rich, data-driven internal admin control panels.',
    image: 'https://beeimg.com/images/j54848926372.jpg',
    bgImage: '',
    features: [
      'Conversion-Optimized Hero & Product Showcase Sections',
      'Ultra-Fast Loading Speeds under 1 second',
      'Interactive Charts, Data Tables & Live Statistics',
      'A/B Testing Ready Architecture',
      'Seamless Form Captures & Lead Notifications',
      'Dark & Light Theme Support'
    ],
    techStack: ['React', 'Lucide Icons', 'Recharts', 'Tailwind CSS', 'Framer Motion'],
    pricingNote: 'Free Hero Preview available',
    fullContent: 'Turn visitors into paying customers with high-impact landing page design.',
    link: '/services/landing-pages-dashboards',
    order: 4,
    visible: true,
    code: ''
  },
  {
    title: 'Mobile App Development',
    slug: 'mobile-app-development',
    description: 'Cross-platform iOS & Android apps crafted with React Native for smooth performance and high conversion.',
    heroTitle: 'Cross-Platform Mobile App Engineering',
    heroSubtitle: 'Delivering native-grade mobile applications for iOS and Android built on React Native for ultimate performance and rapid deployment.',
    image: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=800&q=80',
    bgImage: '',
    features: [
      'Single Codebase for iOS & Android App Store Releases',
      'Fluid 60FPS Animations & Micro-interactions',
      'Push Notifications & Real-Time Messaging Sync',
      'Offline Data Storage & Cloud Synchronization',
      'In-App Purchase & Payment Gateway Integration',
      'App Store & Play Store Publishing Assistance'
    ],
    techStack: ['React Native', 'Expo', 'Redux / Context', 'Firebase', 'Node.js API'],
    pricingNote: 'iOS & Android Unified',
    fullContent: 'Deploy sleek mobile applications that users love on both Apple App Store and Google Play.',
    link: '/services/mobile-app-development',
    order: 5,
    visible: true,
    code: ''
  },
  {
    title: 'AI Chatbots & Automation',
    slug: 'ai-chatbots-automation',
    description: 'Custom AI chatbots, n8n workflows, and automated integrations to streamline business operations 24/7.',
    heroTitle: 'Autonomous AI Agents & n8n Workflow Automations',
    heroSubtitle: 'Supercharge business productivity with custom OpenAI/Claude AI chatbots, WhatsApp/Telegram automation bots, and n8n integrations.',
    image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
    bgImage: '',
    features: [
      'Custom Trained AI Support & Sales Chatbots',
      'n8n & Zapier Multi-System Automated Workflows',
      'Telegram & WhatsApp Customer Bot Integrations',
      'Lead Qualification & Automatic CRM Sync',
      'Vector Database RAG Knowledge Retrieval',
      '24/7 Automated Business Operations'
    ],
    techStack: ['OpenAI API', 'n8n Workflow', 'Telegram Bot API', 'Node.js', 'Vector DB', 'Python'],
    pricingNote: '24/7 Automated Efficiency',
    fullContent: 'Automate repetitive workflows and engage customers 24/7 with custom AI bots.',
    link: '/services/ai-chatbots-automation',
    order: 6,
    visible: true,
    code: ''
  }
];

Service.seedDefaultsIfEmpty = async function () {
  try {
    const count = await Service.countDocuments();
    if (count === 0) {
      await Service.insertMany(DEFAULT_SERVICES);
      console.log('[DB4 Service Seed] Initialized default 6 service cards in operations_security_db (DB4).');
    }
  } catch (err) {
    console.error('[DB4 Service Seed Error]', err.message);
  }
};

module.exports = Service;
