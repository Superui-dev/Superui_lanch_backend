/**
 * Express middleware wrapper to validate requests with Zod schemas.
 * Supports validation of body, query, and params.
 * @param {object} schemas - Object containing Zod schemas for body, query, or params.
 * @param {z.ZodSchema} [schemas.body] - Zod schema for req.body
 * @param {z.ZodSchema} [schemas.query] - Zod schema for req.query
 * @param {z.ZodSchema} [schemas.params] - Zod schema for req.params
 */
function validate(schemas) {
  return async (req, res, next) => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      if (schemas.query) {
        req.query = await schemas.query.parseAsync(req.query);
      }
      if (schemas.params) {
        req.params = await schemas.params.parseAsync(req.params);
      }
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = validate;

