const router = require('express').Router();
const Controller = require('./controller');

router.post('/insert', Controller.insert);
router.get('/my-history', Controller.getMyHistory);
router.get('/generate-session-id', Controller.generateSessionId);
router.get('/session-list', Controller.getMySessionList);

module.exports = router;
