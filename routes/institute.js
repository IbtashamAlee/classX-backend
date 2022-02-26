const express = require("express");
const router = express.Router();
const {PrismaClient} = require(".prisma/client");
const prisma = new PrismaClient();
const {verifyUser} = require('../middlewares/verifyUser');
const {verifySystemAdmin} = require('../middlewares/verifySystemAdmin');

router.get('/',verifyUser,verifySystemAdmin,async(req,res)=>{
    const institutes = await prisma.institute.findMany();
    return res.status(200).json(institutes);
})

router.get('/requests',verifyUser,verifySystemAdmin,async(req,res)=>{
    const requests = await prisma.instituteRequest.findMany();
    return res.status(200).json(requests);
})

router.post('/request',verifyUser,async(req,res)=>{
    const request  = await prisma.instituteRequest.create({
        data:{
            name : req.body.name,
            instituteType : req.body.instituteType,
            adminId : req.user.id
        }
    })
    return res.json(request);
})

router.put('/request/process/:id',verifyUser,verifySystemAdmin,async(req,res)=>{
    if(!req.query.method || (req.query.method !== 'accept' && req.query.method !== 'reject'))
        return res.status(403).send("invalid request");
    const result  = await prisma.instituteRequest.findUnique({
        where : {
            id: parseInt(req.params.id)
        }
    });
    if(result.acceptedAt !== null || result.rejectedAt !== null)  return res.send("request already processed");
    const request  = await prisma.instituteRequest.update({
        where:{
            id : parseInt(req.params.id)
        },
        data:{
            acceptedAt : req.query.method === 'accept' ? new Date() : null ,
            rejectedAt : req.query.method === 'reject' ? new Date() : null
        }
    })
    res.json(request)
})

//todo : write accept request function that includes explicit permissions for admins.


module.exports = router;