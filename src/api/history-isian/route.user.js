
const router = require('express').Router();
const Controller = require('./controller');

router.post('/insert', Controller.insert);
router.get('/my-history', Controller.getMyHistory);
router.get('/sessions', Controller.getMySessionList);
router.get('/generate-session-id', Controller.generateSessionId);

module.exports = router;
