const { getCatalogDb1Connection, getCatalogDb2Connection, getCatalogPrimaryConnection, getCatalogReadConnections, isCatalogOverflowActive } = require('../config/db');

function registerCatalogModels(modelName, schema) {
  for (const conn of getCatalogReadConnections()) {
    try {
      conn.model(modelName);
    } catch (e) {
      conn.model(modelName, schema);
    }
  }
}

async function catalogWrite(modelName, doc) {
  const conn = await getCatalogPrimaryConnection();
  const Model = conn.model(modelName);
  return Model.create(doc);
}

async function catalogFindOne(modelName, query) {
  const conns = getCatalogReadConnections();
  for (const conn of conns) {
    try {
      const Model = conn.model(modelName);
      const found = await Model.findOne(query);
      if (found) return found;
    } catch (e) {}
  }
  return null;
}

async function catalogFind(modelName, query, options = {}) {
  const conns = getCatalogReadConnections();
  for (const conn of conns) {
    try {
      const Model = conn.model(modelName);
      const cursor = Model.find(query, null, options).lean();
      const docs = await cursor;
      return docs;
    } catch (e) {}
  }
  return [];
}

async function catalogFindById(modelName, id) {
  const conns = getCatalogReadConnections();
  for (const conn of conns) {
    try {
      const Model = conn.model(modelName);
      const found = await Model.findById(id);
      if (found) return found;
    } catch (e) {}
  }
  return null;
}

async function catalogUpdate(modelName, query, update, options = {}) {
  const conns = getCatalogReadConnections();
  for (const conn of conns) {
    try {
      const Model = conn.model(modelName);
      const r = await Model.findOneAndUpdate(query, update, { new: true, ...options });
      if (r) return r;
    } catch (e) {}
  }
  return null;
}

async function catalogDelete(modelName, query) {
  const conns = getCatalogReadConnections();
  let total = 0;
  for (const conn of conns) {
    try {
      const Model = conn.model(modelName);
      const r = await Model.deleteMany(query);
      total += r.deletedCount || 0;
    } catch (e) {}
  }
  return total;
}

async function catalogCount(modelName, query = {}) {
  let total = 0;
  for (const conn of getCatalogReadConnections()) {
    try {
      const Model = conn.model(modelName);
      total += await Model.countDocuments(query);
    } catch (e) {}
  }
  return total;
}

module.exports = {
  registerCatalogModels,
  catalogWrite,
  catalogFindOne,
  catalogFind,
  catalogFindById,
  catalogUpdate,
  catalogDelete,
  catalogCount,
  isCatalogOverflowActive
};