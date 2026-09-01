const express = require('express');
const router = express.Router();
const wishlistController = require('../controllers/wishlist.controller');
const authenticate = require('../middleware/authenticate');
const { optionalAuthenticate } = require('../middleware/authenticate');

router.get('/', optionalAuthenticate, wishlistController.getWishlist);
router.post('/add/:productId', authenticate, wishlistController.addToWishlist);
router.delete('/remove/:productId', authenticate, wishlistController.removeFromWishlist);
router.delete('/clear', authenticate, wishlistController.clearWishlist);

module.exports = router;
