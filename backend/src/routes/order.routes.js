const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const authenticate = require('../middleware/authenticate');

router.use(authenticate);

router.get('/', orderController.getMyOrders.bind(orderController));
router.get('/my-orders', orderController.getMyOrders.bind(orderController));
router.get('/:id', orderController.getOrderById.bind(orderController));

module.exports = router;

