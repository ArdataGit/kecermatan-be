const router = require('express').Router();
const Controller = require('./controller');

router.get('/get', Controller.get);
router.get('/find/:id', Controller.find);

module.exports = router;
