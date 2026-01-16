const express = require('express');
const router = express.Router();
const {
  insert,
  update,
  remove,
  getTickets,
  excel,
  importExcel,
  getTicketsForUser
} = require('./controller');
const { upload } = require('#utils');

// Ticket routes
router.get('/', getTickets);
router.get('/user', getTicketsForUser);
router.post('/', upload('image').single('image'), insert);
router.patch('/:id', upload('image').single('image'), update);
router.delete('/:id', remove);
router.get('/export/:userId?', excel);
router.post('/import/:userId?', upload('excel').single('file'), importExcel);

module.exports = router;
