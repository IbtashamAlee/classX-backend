const express = require("express");
const router = express.Router();
const {PrismaClient} = require(".prisma/client");
const prisma = new PrismaClient();
const {verifyUser} = require('../middlewares/verifyUser');
const {verifySystemAdmin} = require('../middlewares/verifySystemAdmin');
const {checkPermission} = require('../functions/checkPermission');



router.get('/', verifyUser, verifySystemAdmin, async (req, res) => {
    const departments = await prisma.department.findMany();
    return res.status(200).json(departments);
})

router.get('/:id', verifyUser, verifySystemAdmin, async (req, res) => {
    const department = await prisma.department.findUnique({
        where:{
            id : parseInt(req.params.id)
        }
    });
    return res.status(200).json(department);
})


module.exports = router;