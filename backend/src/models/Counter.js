const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  modelName: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  sequenceValue: { 
    type: Number, 
    default: 0 
  }
});

const { getCatalogDb1Connection, getCommerceConnection } = require('../config/db');

const CounterModel = getCatalogDb1Connection().model('Counter', counterSchema);
try {
  getCommerceConnection().model('Counter', counterSchema);
} catch (e) {}

module.exports = CounterModel;

