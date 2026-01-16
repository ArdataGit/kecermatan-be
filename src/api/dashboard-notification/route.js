const express = require('express');
const router = express.Router();
const {
  insert,
  update,
  remove,
  getNotifications,
  getActiveNotification
} = require('./controller');
const { upload } = require('#utils');

// Dashboard Notification routes
router.get('/', getNotifications);
router.get('/active', getActiveNotification);
router.post('/', insert);
router.patch('/:id', update);
router.delete('/:id', remove);

module.exports = router;