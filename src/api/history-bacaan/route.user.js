const router = require('express').Router();
const Controller = require('./controller');

router.post('/insert', Controller.insert);
router.get('/my-history', Controller.getMyHistory);

module.exports = router;
