const express = require('express');
const router = express.Router();
const tableController = require('../controllers/table.controller');

router.get('/', tableController.getTables);
router.post('/', tableController.addTable);
router.patch('/:id/status', tableController.updateTableStatus);
router.get('/:id/qr', tableController.getTableQR);

module.exports = router;
