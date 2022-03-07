const express = require("express");
const router = express.Router();
var aws = require('aws-sdk')
var multer = require('multer')
var multerS3 = require('multer-s3')


var s3 = new aws.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_KEY,
    Bucket: process.env.AWS_BUCKET_NAME
})
var upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: process.env.AWS_BUCKET_NAME,
    })
})
//
function getdownloadlink(key){
        return s3.getSignedUrl('getObject', {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: key, //filename
            Expires: 1000 //time to expire in seconds
        })
}



//Uploading single File to aws s3 bucket
router.post('/upload', upload.single('file'), function (req, res, next) {
    res.send(getdownloadlink(req.file.key))
})

// //Uploading Multiple Files to aws s3 bucket
// router.post('/uploadmultiple', upload.array('file',3), function (req, res, next) {
//     res.send({
//         data: getdownloadlink(req.files),
//         msg: 'Successfully uploaded ' + req.files.length + ' files!'
//     })
// })

module.exports = router;
