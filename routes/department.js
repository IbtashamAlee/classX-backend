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

router.post('/:id/add-admin',verifyUser,async (req,res)=>{
    const isPermitted = await checkPermission(req.user,'07_'+req.params.id);
    const department = await prisma.department.findUnique({
        where:{
            id : parseInt(req.params.id)
        }
    })
    if(!req.body.email) return res.status(400).send("email not provided");
    const user = await prisma.user.findUnique({
        where :{
            email : req.body.email
        }
    })
    if(!user) return res.status(404).send("proposed user not found");
    if(!isPermitted) return res.status(400).send("unauthorized");
    if(!department) return res.status(404).send("department not found");
    const role = await prisma.role.findUnique({
        where : {
            name : 'DepartmentAdmin_'+req.params.id
        }
    });
    console.log(role)
    const userRole = await prisma.userRole.upsert({
        where: {
            roleId_userId: {
                roleId: role.id,
                userId: user.id
            }
        },
        update:{},
        create:{
            roleId: role.id,
            userId: user.id
        }
    });
    res.send(userRole)
})
module.exports = router;