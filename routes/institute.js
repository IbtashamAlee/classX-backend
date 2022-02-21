const express = require("express");
const router = express.Router();
const {PrismaClient} = require(".prisma/client");
const prisma = new PrismaClient();

router.get('/',async(req,res)=>{
    const institutes = await prisma.institute.findMany();
    res.json(institutes);
})

router.get('/requests',async(req,res)=>{
    const requests = await prisma.instituteRequest.findMany();
    res.json(requests);
})

module.exports = router;