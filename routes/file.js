const express = require("express");
const router = express.Router();
const aws = require('aws-sdk')
const multer = require('multer')
const multerS3 = require('multer-s3')
const {nanoid} = require("nanoid/async");
const {verifyUser} = require("../middlewares/verifyUser");
const {PrismaClient} = require("@prisma/client");
const prisma = new PrismaClient();

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
router.post('/', verifyUser, upload.single('file'),async function (req, res, next) {
  if (req.file){
    const newFile = await prisma.file.create({
      data: {
        originalName: req.file.originalname,
        key: req.file.key,
        publicUrl: req.file.location,
        createdAt: new Date(),
        uploadedBy: req.user.id,
      }
    })
    return res.send(newFile);
  }
  return res.status(404).send("file not found");
})

//Uploading Multiple Files to aws s3 bucket
router.post('/multiple', verifyUser, upload.array('file', 5), async function (req, res, next) {
  if (req.files) {
    files = []
    for await (file of req.files) {
      const newFile = await prisma.file.create({
        data: {
          originalName: file.originalname,
          key: file.key,
          publicUrl: file.location,
          createdAt: new Date(),
          uploadedBy: req.user.id,
        }
      })
      files.push(newFile)
    }
    return res.send(files);
  }
  return res.status(404).send("files not found");
})

module.exports = router;
