const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menu.controller');

router.get('/', menuController.getMenu);
router.post('/', menuController.addItem);
router.patch('/:id', menuController.updateItem);
router.delete('/:id', menuController.deleteItem);

module.exports = router;
