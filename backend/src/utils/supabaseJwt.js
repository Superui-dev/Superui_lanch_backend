const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const SUPABASE_JWKS_URL = process.env.SUPABASE_JWKS_URL;
const SUPABASE_JWT_ISSUER = process.env.SUPABASE_JWT_ISSUER;
const SUPABASE_JWT_AUDIENCE = 'authenticated';

if (!SUPABASE_JWKS_URL) {
  console.warn('SUPABASE_JWKS_URL is not set. JWT verification will fail.');
}

const client = jwksClient({
  jwksUri: SUPABASE_JWKS_URL
});

function getSigningKey(kid) {
  return new Promise((resolve, reject) => {
    client.getSigningKey(kid, (err, key) => {
      if (err) return reject(err);
      resolve(key.getPublicKey());
    });
  });
}

async function verifySupabaseJwt(token) {
  if (!SUPABASE_JWKS_URL || !SUPABASE_JWT_ISSUER) {
    throw new Error('Supabase JWT configuration is missing');
  }

  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || !decoded.header || !decoded.header.kid) {
    throw new Error('Invalid token format');
  }

  const publicKey = await getSigningKey(decoded.header.kid);

  return jwt.verify(token, publicKey, {
    issuer: SUPABASE_JWT_ISSUER,
    audience: SUPABASE_JWT_AUDIENCE,
    algorithms: ['RS256']
  });
}

module.exports = { verifySupabaseJwt };
