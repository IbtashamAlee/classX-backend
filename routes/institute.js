const express = require("express");
const router = express.Router();
const {PrismaClient} = require(".prisma/client");
const prisma = new PrismaClient();
const {verifyUser} = require('../middlewares/verifyUser');

router.get('/',async(req,res)=>{
    const institutes = await prisma.institute.findMany();
    return res.status(200).json(institutes);
})

router.get('/requests',verifyUser,async(req,res)=>{
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


module.exports = router;