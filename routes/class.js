const express = require("express");
const router = express.Router();
const {PrismaClient} = require(".prisma/client");
const prisma = new PrismaClient();
const {verifyUser} = require("../middlewares/verifyUser");
const safeAwait = require("../services/safe_await");
const {checkPermission} = require("../functions/checkPermission");
const {nanoid} = require("nanoid/async");
const StudentPermissions = require("../permissions/student.json");
const TeacherPermissions = require("../permissions/teacher.json");
const DepartmentAdminPermissions = require("../permissions/departmentAdmin.json");
const {verifySystemAdmin} = require("../middlewares/verifySystemAdmin");

router.get('/',verifyUser,verifySystemAdmin,async(req,res)=>{
    const [classes,classesErr] = await safeAwait(prisma.class.findMany());
    if(classesErr) return res.status(409).send("unable to fetch classes");
    return res.send(classes);
})

//To add an independent class
router.post('/add-class', verifyUser, async (req, res) => {
    if (!req.body.name) return res.status(409).send('class name not provided')
    const className = req.body.name.trim();

    const [newClass, newClassErr] = await safeAwait(prisma.class.create({
        data: {
            name: className,
            description: req.body.description || '',
            code: await nanoid(),
        }
    }));

    if (newClassErr || !newClass) return res.status(409).send("unable to create class");

    const [teacherRole, teacherRoleErr] = await safeAwait(prisma.role.upsert({
        where: {
            name: 'Teacher_' + newClass.id,
        },
        update: {},
        create: {
            name: 'Teacher_' + newClass.id,
            classId: newClass.id,
        }
    }))
    if (!teacherRole || teacherRoleErr) return res.status(409).send("unable to generate teacher's role");

    const [studentRole, studentRoleErr] = await safeAwait(prisma.role.upsert({
        where: {
            name: 'Student_' + newClass.id,
        },
        update: {},
        create: {
            name: 'Student_' + newClass.id,
            classId: newClass.id,
        }
    }))
    if (!studentRole || studentRoleErr) return res.status(409).send("unable to generate student's role");

    //Generating permission for student role
    for await (const per of StudentPermissions.permissions) {
        const permission = await prisma.permission.upsert({
            where: {
                code: per.code + '_' + newClass.id
            },
            update: {},
            create: {
                name: per.name + '_' + newClass.id,
                code: per.code + '_' + newClass.id,
            },
        })
        const rolePermission = await prisma.rolePermission.create({
            data: {
                permissionId: permission.id,
                roleId: studentRole.id
            }
        })
        console.log({permission,rolePermission})
    }


    //Generating permission for teachers role
    for await (const per of TeacherPermissions.permissions) {
        const permission = await prisma.permission.upsert({
            where: {
                code: per.code + '_' + newClass.id
            },
            update: {},
            create: {
                name: per.name + '_' + newClass.id,
                code: per.code + '_' + newClass.id,
            },
        })
        await prisma.rolePermission.create({
            data: {
                permissionId: permission.id,
                roleId: teacherRole.id
            }
        })
    }

    return res.json({message:"explicit permissions generated",newClass});
})

module.exports = router;