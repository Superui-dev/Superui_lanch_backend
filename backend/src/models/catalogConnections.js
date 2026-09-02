const { getCatalogPrimaryConnection, getCatalogReadConnections } = require('./db');

function bindCatalogModel(modelName, schema) {
  const connections = getCatalogReadConnections();
  connections.forEach(conn => {
    try { conn.model(modelName); } catch (e) {
      conn.model(modelName, schema);
    }
  });
}

async function getActiveCatalogModel(modelName) {
  const conn = await getCatalogPrimaryConnection();
  try {
    return conn.model(modelName);
  } catch (e) {
    throw new Error(`Catalog model ${modelName} not bound to ${conn.name || 'unknown'}`);
  }
}

async function listCatalogModels(modelName) {
  const out = [];
  for (const conn of getCatalogReadConnections()) {
    try {
      out.push(conn.model(modelName));
    } catch (e) {}
  }
  return out;
}

module.exports = { bindCatalogModel, getActiveCatalogModel, listCatalogModels };