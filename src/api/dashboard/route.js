const express = require('express');

const router = express.Router();

const { admin, user, rekapPenjualan } = require('./controller');
const { authenticateUser, authorizeRoles } = require('#middlewares');

router.get('/admin', authenticateUser, authorizeRoles('ADMIN'), admin);
router.get('/user', authenticateUser, user);
router.get('/rekap-penjualan', authenticateUser, rekapPenjualan);
module.exports = router;
