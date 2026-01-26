
const express = require('express');

const router = express.Router();

const { get, find, insert, update, remove, getHistory, getDetailHistory, updateScore } = require('./controller');

router.get('/get', get);
router.get('/history', getHistory);
router.get('/history/detail', getDetailHistory);
router.get('/find/:id', find);
router.post('/insert', insert);
router.patch('/update/:id', update);
router.patch('/update-score', updateScore);
router.delete('/remove/:id', remove);

module.exports = router;
