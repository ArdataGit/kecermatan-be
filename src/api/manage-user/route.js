const express = require('express');

const router = express.Router();

const { get, find, insert, update, remove, excel } = require('./controller');

router.get('/get', get);
router.get('/find/:id', find);
router.post('/insert', insert);
router.patch('/update/:id', update);
router.delete('/remove/:id', remove);
router.get('/excel', excel);

module.exports = router;
