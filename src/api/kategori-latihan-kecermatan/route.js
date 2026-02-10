const express = require('express');

const router = express.Router();

const { get, find, insert, update, remove, getHistory, getUserHistory, insertRanking } = require('./controller');

router.get('/get', get);
router.get('/find/:id', find);
router.get('/history', getHistory);
router.get('/history/detail', getUserHistory);
router.post('/insert', insert);
router.post('/ranking', insertRanking);
router.patch('/update/:id', update);
router.delete('/remove/:id', remove);

module.exports = router;
