const express = require('express');

const router = express.Router();

const { uploadFile } = require('./controller');
const { upload } = require('#utils');

router.post('/upload', upload('file').single('upload'), uploadFile);

module.exports = router;
