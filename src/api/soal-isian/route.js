const router = require('express').Router();
const Controller = require('./controller');

router.get('/get', Controller.get);
router.get('/find/:id', Controller.find);
router.post('/insert', Controller.insert);
router.patch('/update/:id', Controller.update);
router.delete('/remove/:id', Controller.remove);

module.exports = router;
