const Counter = require('../models/Counter');
const logger = require('./logger');

/**
 * Gets the next sequence number for a given model.
 * Uses atomic findOneAndUpdate to increment the sequence value.
 * @param {string} modelName
 * @returns {Promise<number>}
 */
async function getNextSequenceValue(modelName) {
  try {
    const counter = await Counter.findOneAndUpdate(
      { modelName },
      { $inc: { sequenceValue: 1 } },
      { new: true, upsert: true }
    );
    return counter.sequenceValue;
  } catch (error) {
    logger.error(`Error incrementing sequence value for ${modelName}: ${error.message}`);
    throw error;
  }
}

/**
 * Year-scoped sequence. Resets every calendar year.
 * Uses atomic findOneAndUpdate keyed on `${prefix}_${year}` so two services
 * cannot generate the same Product ID concurrently.
 */
async function getYearlySequenceValue(prefix, year) {
  const modelName = `${prefix}_${year}`;
  try {
    const counter = await Counter.findOneAndUpdate(
      { modelName },
      { $inc: { sequenceValue: 1 } },
      { new: true, upsert: true }
    );
    return counter.sequenceValue;
  } catch (error) {
    logger.error(`Error incrementing yearly sequence value for ${modelName}: ${error.message}`);
    throw error;
  }
}

/**
 * Generates a custom human-readable, sequential identifier.
 * Patterns:
 * - Customer: CUS-YYYY-XXXXX
 * - Order: ORD-YYYY-XXXXX
 * - Payment: PAY-YYYY-XXXXX
 * - Delivery: DEL-YYYY-XXXXX
 * - Product: PROD-XXXXX
 * - Invoice: INV-YYYY-XXXXX
 * - Download: DL-YYYY-XXXXX
 * - Email: EML-YYYY-XXXXX
 *
 * @param {string} type
 * @returns {Promise<string>}
 */
async function generateCustomId(type) {
  const year = new Date().getFullYear();
  const sequence = await getNextSequenceValue(type.toLowerCase());
  
  switch (type.toLowerCase()) {
    case 'customer':
      return `CUS-${year}-${String(sequence).padStart(5, '0')}`;
    case 'order':
      return `ORD-${year}-${String(sequence).padStart(5, '0')}`;
    case 'payment':
      return `PAY-${year}-${String(sequence).padStart(5, '0')}`;
    case 'delivery':
      return `DEL-${year}-${String(sequence).padStart(5, '0')}`;
    case 'product':
      return `PROD-${String(sequence).padStart(5, '0')}`;
    case 'product_sup': {
      const productYear = new Date().getFullYear();
      const productSeq = await getYearlySequenceValue('product_sup', productYear);
      return `SUP-${productYear}-${String(productSeq).padStart(6, '0')}`;
    }
    case 'invoice':
      return `INV-${year}-${String(sequence).padStart(6, '0')}`;
    case 'download':
      return `DL-${year}-${String(sequence).padStart(5, '0')}`;
    case 'email':
      return `EML-${year}-${String(sequence).padStart(5, '0')}`;
    default:
      throw new Error(`Unknown model type for custom ID generation: ${type}`);
  }
}

module.exports = {
  generateCustomId
};

