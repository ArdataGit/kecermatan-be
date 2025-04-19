const express = require('express');

const router = express.Router();

const {
  update,
  remove,
  getSubCategory,
  insert,
  excel,
  importExcel,
} = require('./controller');
const { upload } = require('#utils');

router.get('/get-subcategory', getSubCategory);
router.post('/insert', insert);
router.patch('/update/:id', update);
router.delete('/remove/:id', remove);
router.get('/export/:id', excel);
router.post('/import/:id', upload('excel').single('file'), importExcel);

module.exports = router;
