const express = require("express");
const router = express.Router();
const aws = require('aws-sdk')
const multer = require('multer')
const multerS3 = require('multer-s3')


const s3 = new aws.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_KEY,
    Bucket: process.env.AWS_BUCKET_NAME
})
const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: process.env.AWS_BUCKET_NAME,
    })
})

router.get('/getdownloadlink',async(req,res)=>{
    if(req.body.key){
        return res.send(s3.getSignedUrl('getObject', {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: req.body.key, //filename
            Expires: 1000 //time to expire in seconds
        }))
    }
    return res.status(404).send('key not found')
})

//Uploading single File to aws s3 bucket
router.post('/upload', upload.single('file'), function (req, res, next) {
    if(req.file)
        return res.send(req.file);
    return res.status(404).send("file not found");
})

//Uploading Multiple Files to aws s3 bucket
router.post('/uploadmultiple', upload.array('file',5), function (req, res, next) {
    if (req.files){
        res.send({
            data: req.files,
            msg: 'Successfully uploaded ' + req.files.length + ' files!'
        })
    }
    return res.status(404).send("files not found");
})

module.exports = router;
