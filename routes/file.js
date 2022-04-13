const express = require("express");
const router = express.Router();
const aws = require('aws-sdk')
const multer = require('multer')
const multerS3 = require('multer-s3')
const {nanoid} = require("nanoid/async");


const s3 = new aws.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  Bucket: process.env.AWS_BUCKET_NAME
})
const upload = multer({
  limits: {fileSize: 10 * 1024 * 1024},
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_BUCKET_NAME,
    contentType: function (req, file, cb) {
      cb(null, file.mimetype)
    },
    acl: 'public-read',
    key: async function (req, file, cb) {
      console.log(file)
      cb(null, file.originalname.split('.')[0] + "__" + await nanoid() + '.' + file.originalname.split('.')[1])
    }
  })
})

router.get('/download-link/:key', async (req, res) => {
    return res.send(s3.getSignedUrl('getObject', {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: req.params.key, //filename
      Expires: 120 //time to expire in seconds
    }))
})

//Uploading single File to aws s3 bucket
router.post('/', upload.single('file'), function (req, res, next) {
  if (req.file)
    return res.send(req.file);
  return res.status(404).send("file not found");
})

//Uploading Multiple Files to aws s3 bucket
router.post('/multiple', upload.array('file', 5), function (req, res, next) {
  if (req.files) {
    return res.send({
      data: req.files,
      msg: 'Successfully uploaded ' + req.files.length + ' files!'
    })
  }
  return res.status(404).send("files not found");
})

module.exports = router;
