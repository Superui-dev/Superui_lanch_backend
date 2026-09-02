const Product = require('../models/Product');
const { BadRequestError } = require('../utils/errors');

class PricingService {
  async calculatePrice(cartItems, userId) {
    if (!cartItems || cartItems.length === 0) {
      throw new BadRequestError('Cart is empty');
    }

    const calculatedItems = [];
    let subtotal = 0;

    for (const item of cartItems) {
      const mongoose = require('mongoose');
      const pId = item.productId;
      let product = null;

      if (pId) {
        const query = [];
        if (mongoose.Types.ObjectId.isValid(pId)) query.push({ _id: pId });
        query.push({ slug: pId }, { productId: pId });
        product = await Product.read.findOne({ $or: query, status: 'published' });
        if (product) {
          const cat = await require('../models/Category').read.findById(product.categoryId);
          if (cat) product.categoryId = cat;
        }
      }

      if (!product) {
        throw new BadRequestError(`Product not found or unavailable: ${pId}`);
      }

      const quantity = parseInt(item.quantity, 10) || 1;
      const sellingPrice = Number(product.sellingPrice || product.price || 0);
      const originalPrice = Number(product.originalPrice || product.compareAtPrice || sellingPrice);
      const itemSubtotal = sellingPrice * quantity;

      subtotal += itemSubtotal;

      calculatedItems.push({
        productId: product._id,
        name: product.name,
        price: sellingPrice,
        compareAtPrice: originalPrice,
        quantity,
        subtotal: itemSubtotal
      });
    }

    const discountAmount = 0;
    const taxAmount = 0;
    const totalAmount = subtotal;

    return {
      items: calculatedItems,
      subtotal,
      discountAmount,
      taxAmount,
      totalAmount
    };
  }
}

module.exports = new PricingService();

