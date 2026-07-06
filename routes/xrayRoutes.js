const express = require('express');
const router = express.Router();
const multer = require('multer');
const authMiddleware = require('../middlewares/authMiddleware');
const xrayController = require('../controllers/xrayController');

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed.'), false);
    }
  },
});

router.use(authMiddleware);

router.post('/upload', upload.single('cvFile'), xrayController.uploadXray);
router.get('/:id/pdf', xrayController.getPdf);
router.get('/', xrayController.listVersions);

module.exports = router;
