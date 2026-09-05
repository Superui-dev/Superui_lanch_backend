const Service = require('../models/Service');
const Category = require('../models/Category');
const logger = require('../utils/logger');

const slugify = (text) => {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
};

async function syncServicesToCategories(services) {
  if (!Array.isArray(services) || services.length === 0) return;
  try {
    for (let i = 0; i < services.length; i++) {
      const s = services[i];
      if (!s.title) continue;
      const slug = s.slug || slugify(s.title);
      await Category.findOneAndUpdate(
        { slug: slug },
        {
          $set: {
            name: s.title,
            slug: slug,
            description: s.description || '',
            visible: s.visible !== false,
            productType: 'website-template'
          },
          $setOnInsert: {
            order: s.order || i + 1
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
  } catch (err) {
    logger.warn(`[Sync Services to Categories] ${err.message}`);
  }
}

// @desc    Get public services (visible only, sorted by order)
// @route   GET /api/public/services
// @access  Public
exports.getPublicServices = async (req, res) => {
  try {
    await Service.seedDefaultsIfEmpty();
    const services = await Service.find({ visible: true }).sort({ order: 1, createdAt: 1 }).lean();
    await syncServicesToCategories(services);
    return res.json({
      success: true,
      count: services.length,
      data: services
    });
  } catch (error) {
    logger.error(`Error fetching public services: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Server Error fetching services' });
  }
};

// @desc    Get single public service detail by slug
// @route   GET /api/public/services/:slug
// @access  Public
exports.getPublicServiceBySlug = async (req, res) => {
  try {
    await Service.seedDefaultsIfEmpty();
    const { slug } = req.params;
    
    // Find service by slug or _id
    let service = await Service.findOne({ slug: slug.toLowerCase() }).lean();
    if (!service && slug.match(/^[0-9a-fA-F]{24}$/)) {
      service = await Service.findById(slug).lean();
    }

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found.' });
    }

    // Fetch related services (other visible services)
    const relatedServices = await Service.find({
      _id: { $ne: service._id },
      visible: true
    })
      .sort({ order: 1 })
      .limit(3)
      .lean();

    return res.json({
      success: true,
      data: service,
      relatedServices
    });
  } catch (error) {
    logger.error(`Error fetching service by slug (${req.params.slug}): ${error.message}`);
    return res.status(500).json({ success: false, message: 'Server Error fetching service detail' });
  }
};

// @desc    Get all services for admin (including hidden, sorted by order)
// @route   GET /api/admin/services
// @access  Admin
exports.getAdminServices = async (req, res) => {
  try {
    await Service.seedDefaultsIfEmpty();
    const services = await Service.find({}).sort({ order: 1, createdAt: 1 }).lean();
    return res.json({
      success: true,
      count: services.length,
      data: services
    });
  } catch (error) {
    logger.error(`Error fetching admin services: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Server Error fetching admin services' });
  }
};

// @desc    Create a new service card in DB4
// @route   POST /api/admin/services
// @access  Admin
exports.createService = async (req, res) => {
  try {
    const { title, slug, description, heroTitle, heroSubtitle, image, bgImage, features, techStack, pricingNote, fullContent, link, order, visible, code } = req.body;
    if (!title || !image) {
      return res.status(400).json({ success: false, message: 'Title and image URL are required.' });
    }

    const currentCount = await Service.countDocuments();
    const finalSlug = (slug ? slugify(slug) : slugify(title)) || `service-${Date.now()}`;

    const newService = await Service.create({
      title: title.trim(),
      slug: finalSlug,
      description: (description || '').trim(),
      heroTitle: (heroTitle || title).trim(),
      heroSubtitle: (heroSubtitle || description || '').trim(),
      image: image.trim(),
      bgImage: (bgImage || '').trim(),
      features: Array.isArray(features) ? features : (features ? String(features).split(',').map(f => f.trim()) : []),
      techStack: Array.isArray(techStack) ? techStack : (techStack ? String(techStack).split(',').map(t => t.trim()) : []),
      pricingNote: (pricingNote || '').trim(),
      fullContent: (fullContent || '').trim(),
      link: (link || `/services/${finalSlug}`).trim(),
      order: order !== undefined ? Number(order) : currentCount + 1,
      visible: visible !== undefined ? Boolean(visible) : true,
      code: (code || '').trim()
    });

    return res.status(201).json({
      success: true,
      message: 'Service card created successfully in DB4.',
      data: newService
    });
  } catch (error) {
    logger.error(`Error creating service: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to create service: ' + error.message });
  }
};

// @desc    Update a service card in DB4 by ID
// @route   PUT /api/admin/services/:id
// @access  Admin
exports.updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    if (updateData.title && !updateData.slug) {
      updateData.slug = slugify(updateData.title);
    } else if (updateData.slug) {
      updateData.slug = slugify(updateData.slug);
    }

    if (typeof updateData.features === 'string') {
      updateData.features = updateData.features.split(',').map(f => f.trim()).filter(Boolean);
    }
    if (typeof updateData.techStack === 'string') {
      updateData.techStack = updateData.techStack.split(',').map(t => t.trim()).filter(Boolean);
    }

    const updatedService = await Service.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedService) {
      return res.status(404).json({ success: false, message: 'Service card not found.' });
    }

    return res.json({
      success: true,
      message: 'Service card updated successfully in DB4.',
      data: updatedService
    });
  } catch (error) {
    logger.error(`Error updating service ${req.params.id}: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to update service' });
  }
};

// @desc    Delete a service card from DB4
// @route   DELETE /api/admin/services/:id
// @access  Admin
exports.deleteService = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Service.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Service card not found.' });
    }

    return res.json({
      success: true,
      message: 'Service card deleted successfully from DB4.'
    });
  } catch (error) {
    logger.error(`Error deleting service ${req.params.id}: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to delete service' });
  }
};

// @desc    Bulk save / update all services in DB4
// @route   PUT /api/admin/services
// @access  Admin
exports.bulkSaveServices = async (req, res) => {
  try {
    const { services } = req.body;
    if (!Array.isArray(services)) {
      return res.status(400).json({ success: false, message: 'Services must be an array.' });
    }

    // Clear existing and replace with new bulk payload
    await Service.deleteMany({});
    const preparedServices = services.map((s, idx) => {
      const finalSlug = (s.slug ? slugify(s.slug) : slugify(s.title)) || `service-${idx + 1}`;
      return {
        title: s.title || 'Service Title',
        slug: finalSlug,
        description: s.description || '',
        heroTitle: s.heroTitle || s.title || '',
        heroSubtitle: s.heroSubtitle || s.description || '',
        image: s.image || '',
        bgImage: s.bgImage || '',
        features: Array.isArray(s.features) ? s.features : (typeof s.features === 'string' ? s.features.split(',').map(f => f.trim()).filter(Boolean) : []),
        techStack: Array.isArray(s.techStack) ? s.techStack : (typeof s.techStack === 'string' ? s.techStack.split(',').map(t => t.trim()).filter(Boolean) : []),
        pricingNote: s.pricingNote || '',
        fullContent: s.fullContent || '',
        link: s.link || `/services/${finalSlug}`,
        order: s.order || idx + 1,
        visible: s.visible !== false,
        code: typeof s.code === 'object' ? JSON.stringify(s.code, null, 2) : (s.code || '')
      };
    });

    const inserted = await Service.insertMany(preparedServices);
    await syncServicesToCategories(inserted);
    return res.json({
      success: true,
      message: 'Services synced successfully to DB4 (operations_security_db).',
      data: inserted
    });
  } catch (error) {
    logger.error(`Error bulk saving services: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to sync services: ' + error.message });
  }
};
