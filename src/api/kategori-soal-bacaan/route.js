const express = require('express');

const router = express.Router();

const { get, find, insert, update, remove, getHistory, getDetailHistory } = require('./controller');

router.get('/get', get);
router.get('/find/:id', find);
router.post('/insert', insert);
router.patch('/update/:id', update);
router.delete('/remove/:id', remove);
router.get('/history', getHistory);
router.get('/history/detail', getDetailHistory);

module.exports = router;
