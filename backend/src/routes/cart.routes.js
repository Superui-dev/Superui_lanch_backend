const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cart.controller');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const zod = require('zod');

const addCartSchema = zod.object({
  productId: zod.string(),
  quantity: zod.number().int().min(1).default(1)
});

const updateCartSchema = zod.object({
  quantity: zod.number().int().min(1)
});

const { optionalAuthenticate } = require('../middleware/authenticate');

router.get('/', optionalAuthenticate, cartController.getCart.bind(cartController));
router.post('/', optionalAuthenticate, validate({ body: addCartSchema }), cartController.addToCart.bind(cartController));
router.put('/:productId', optionalAuthenticate, validate({ body: updateCartSchema }), cartController.updateCartItem.bind(cartController));
router.delete('/:productId', optionalAuthenticate, cartController.removeFromCart.bind(cartController));
router.delete('/', optionalAuthenticate, cartController.clearCart.bind(cartController));

module.exports = router;

