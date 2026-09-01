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

const { getCoreConnection, getUsersConnection } = require('../config/db');

const CounterModel = getCoreConnection().model('Counter', counterSchema);
try {
  getUsersConnection().model('Counter', counterSchema);
} catch (e) {}

module.exports = CounterModel;

