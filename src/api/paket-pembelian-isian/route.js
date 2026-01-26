
const router = require('express').Router();
const Controller = require('./controller');

router.get('/get', Controller.get);
router.post('/insert', Controller.insert);
router.delete('/remove/:id', Controller.remove);

module.exports = router;
