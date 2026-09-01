require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Category = require('../models/Category');
const Product = require('../models/Product');

const seedStore = async () => {
  try {
    const coreUri = process.env.MONGODB_URI_CORE || process.env.MONGODB_URI || 'mongodb://localhost:27017/superui_core';
    console.log('Connecting to MongoDB Core:', coreUri);
    await mongoose.connect(coreUri);

    console.log('Clearing old categories and products...');
    await Category.deleteMany({});
    await Product.deleteMany({});

    console.log('Seeding 6 Admin Created Categories...');
    const catUiKits = await Category.create({ name: 'UI Kits & Dashboards', slug: 'ui-kits', order: 1, visible: true });
    const catTemplates = await Category.create({ name: 'Landing Page Templates', slug: 'templates', order: 2, visible: true });
    const catMobile = await Category.create({ name: 'Mobile App Component Kits', slug: 'mobile-apps', order: 3, visible: true });
    const catWebsites = await Category.create({ name: 'Websites & Portfolios', slug: 'websites', order: 4, visible: true });
    const catEcommerce = await Category.create({ name: 'E-Commerce Storefronts', slug: 'ecommerce', order: 5, visible: true });
    const catDesignSys = await Category.create({ name: 'Design Systems & Icons', slug: 'design-systems', order: 6, visible: true });

    console.log('Seeding 18 Real Store Products for 12 per page pagination...');
    const productsData = [
      {
        name: 'SuperUI Glassmorphic Pro Kit',
        slug: 'superui-glassmorphic-pro-kit',
        shortDescription: 'Next-gen glassmorphic React components & design tokens for modern web apps.',
        price: 2499,
        compareAtPrice: 4999,
        currency: 'INR',
        categoryId: catUiKits._id,
        thumbnail: { url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80' },
        status: 'published',
        featured: true
      },
      {
        name: 'Aether Admin Dashboard React',
        slug: 'aether-admin-dashboard-react',
        shortDescription: 'Production-ready admin dashboard UI with charts, tables, and analytics modules.',
        price: 1999,
        compareAtPrice: 3999,
        currency: 'INR',
        categoryId: catUiKits._id,
        thumbnail: { url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80' },
        status: 'published',
        featured: true
      },
      {
        name: 'SaaS Mobile App UI Component Kit',
        slug: 'saas-mobile-app-ui-kit',
        shortDescription: 'Mobile-first React Native & PWA components for modern iOS & Android apps.',
        price: 1499,
        compareAtPrice: 2999,
        currency: 'INR',
        categoryId: catMobile._id,
        thumbnail: { url: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=800&q=80' },
        status: 'published',
        featured: true
      },
      {
        name: 'Nexus E-Commerce Storefront Template',
        slug: 'nexus-ecommerce-storefront-template',
        shortDescription: 'Full-stack storefront template with Razorpay integration & cart management.',
        price: 2999,
        compareAtPrice: 5999,
        currency: 'INR',
        categoryId: catEcommerce._id,
        thumbnail: { url: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=800&q=80' },
        status: 'published',
        featured: true
      },
      {
        name: 'Kortex Portfolio & Agency Suite',
        slug: 'kortex-portfolio-agency-suite',
        shortDescription: 'Ultra-clean portfolio landing page template for creative agencies & freelancers.',
        price: 999,
        compareAtPrice: 1999,
        currency: 'INR',
        categoryId: catWebsites._id,
        thumbnail: { url: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=800&q=80' },
        status: 'published',
        featured: true
      },
      {
        name: 'Apex Cloud SaaS Landing Page',
        slug: 'apex-cloud-saas-landing-page',
        shortDescription: 'High-converting SaaS landing page with pricing tables and social proof badges.',
        price: 1299,
        compareAtPrice: 2499,
        currency: 'INR',
        categoryId: catTemplates._id,
        thumbnail: { url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80' },
        status: 'published',
        featured: true
      },
      {
        name: 'CryptoX Web3 Dashboard & Wallet UI',
        slug: 'cryptox-web3-dashboard-wallet-ui',
        shortDescription: 'Modern crypto exchange & Web3 wallet dashboard design kit.',
        price: 3499,
        compareAtPrice: 6999,
        currency: 'INR',
        categoryId: catUiKits._id,
        thumbnail: { url: 'https://images.unsplash.com/photo-1622979135225-d2ba269bc1bd?auto=format&fit=crop&w=800&q=80' },
        status: 'published',
        featured: true
      },
      {
        name: 'Luminar Dark Mode Design System',
        slug: 'luminar-dark-mode-design-system',
        shortDescription: 'Complete dark mode design system with 200+ accessible UI components.',
        price: 1899,
        compareAtPrice: 3799,
        currency: 'INR',
        categoryId: catDesignSys._id,
        thumbnail: { url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80' },
        status: 'published',
        featured: true
      },
      {
        name: 'Fintech Payment Gateway Component Kit',
        slug: 'fintech-payment-gateway-component-kit',
        shortDescription: 'Razorpay, Stripe & UPI payment checkout modal UI components.',
        price: 2199,
        compareAtPrice: 4399,
        currency: 'INR',
        categoryId: catEcommerce._id,
        thumbnail: { url: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=800&q=80' },
        status: 'published',
        featured: true
      },
      {
        name: 'Hyperion AI Startup Landing Template',
        slug: 'hyperion-ai-startup-landing-template',
        shortDescription: 'Futuristic AI tool landing page with prompt generator preview widget.',
        price: 1699,
        compareAtPrice: 3399,
        currency: 'INR',
        categoryId: catTemplates._id,
        thumbnail: { url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80' },
        status: 'published',
        featured: true
      },
      {
        name: 'Vortex Analytical Dashboard System',
        slug: 'vortex-analytical-dashboard-system',
        shortDescription: 'High-density metrics dashboard UI kit built with Tailwind & React.',
        price: 2299,
        compareAtPrice: 4599,
        currency: 'INR',
        categoryId: catUiKits._id,
        thumbnail: { url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80' },
        status: 'published',
        featured: true
      },
      {
        name: 'Pulse Mobile Fintech App UI Kit',
        slug: 'pulse-mobile-fintech-app-ui-kit',
        shortDescription: 'Mobile banking, card management, and wallet transfer app screens.',
        price: 1799,
        compareAtPrice: 3599,
        currency: 'INR',
        categoryId: catMobile._id,
        thumbnail: { url: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80' },
        status: 'published',
        featured: true
      },
      {
        name: 'Zenith Studio Agency Portfolio Template',
        slug: 'zenith-studio-agency-portfolio-template',
        shortDescription: 'Sleek dark theme agency portfolio with smooth Framer Motion transitions.',
        price: 1199,
        compareAtPrice: 2399,
        currency: 'INR',
        categoryId: catWebsites._id,
        thumbnail: { url: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=800&q=80' },
        status: 'published',
        featured: true
      },
      {
        name: 'OmniStore Multi-Vendor E-Commerce Kit',
        slug: 'omnistore-multivendor-ecommerce-kit',
        shortDescription: 'Comprehensive multi-vendor e-commerce UI components and cart system.',
        price: 3199,
        compareAtPrice: 6399,
        currency: 'INR',
        categoryId: catEcommerce._id,
        thumbnail: { url: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=800&q=80' },
        status: 'published',
        featured: true
      },
      {
        name: 'Prism 3D Design Icons & Assets Package',
        slug: 'prism-3d-design-icons-assets-package',
        shortDescription: '100+ high-resolution 3D glass icons for websites and app headers.',
        price: 1399,
        compareAtPrice: 2799,
        currency: 'INR',
        categoryId: catDesignSys._id,
        thumbnail: { url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80' },
        status: 'published',
        featured: true
      },
      {
        name: 'Nova Next.js SaaS Starter Boilerplate',
        slug: 'nova-nextjs-saas-starter-boilerplate',
        shortDescription: 'Full-stack Next.js 14 SaaS template with Auth, MongoDB & Razorpay.',
        price: 3999,
        compareAtPrice: 7999,
        currency: 'INR',
        categoryId: catTemplates._id,
        thumbnail: { url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80' },
        status: 'published',
        featured: true
      },
      {
        name: 'Quantum Minimalist Blog & CMS Theme',
        slug: 'quantum-minimalist-blog-cms-theme',
        shortDescription: 'Clean typography blog template with MDX, search, and category tags.',
        price: 899,
        compareAtPrice: 1799,
        currency: 'INR',
        categoryId: catWebsites._id,
        thumbnail: { url: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=800&q=80' },
        status: 'published',
        featured: true
      },
      {
        name: 'Aura Fitness Mobile App Design System',
        slug: 'aura-fitness-mobile-app-design-system',
        shortDescription: 'Workout tracker, diet plan, and habit tracking mobile UI screens.',
        price: 1599,
        compareAtPrice: 3199,
        currency: 'INR',
        categoryId: catMobile._id,
        thumbnail: { url: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80' },
        status: 'published',
        featured: true
      }
    ];

    await Product.create(productsData);

    console.log('Store database successfully seeded with 6 Categories and 18 Published Products!');
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed store database:', error);
    process.exit(1);
  }
};

seedStore();
