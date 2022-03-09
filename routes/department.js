const express = require("express");
const router = express.Router();
const {PrismaClient} = require(".prisma/client");
const prisma = new PrismaClient();
const {verifyUser} = require('../middlewares/verifyUser');
const {verifySystemAdmin} = require('../middlewares/verifySystemAdmin');
const {checkPermission} = require('../functions/checkPermission');
const randomstring = require("randomstring");
const StudentPermissions = require('../permissions/student.json');
const TeacherPermissions = require('../permissions/teacher.json');
const DepartmentAdminPermissions = require('../permissions/departmentAdmin.json');

router.get('/', verifyUser, verifySystemAdmin, async (req, res) => {
    const departments = await prisma.department.findMany();
    return res.status(200).json(departments);
})

router.get('/:id', verifyUser, verifySystemAdmin, async (req, res) => {
    const department = await prisma.department.findUnique({
        where: {
            id: parseInt(req.params.id)
        }
    });
    return res.status(200).json(department);
})

router.post('/:id/add-admin', verifyUser, async (req, res) => {
    const isPermitted = await checkPermission(req.user, '07_' + req.params.id);
    const department = await prisma.department.findUnique({
        where: {
            id: parseInt(req.params.id)
        }
    })
    if (!req.body.email) return res.status(400).send("email not provided");
    const user = await prisma.user.findUnique({
        where: {
            email: req.body.email
        }
    })
    if (!user) return res.status(404).send("proposed user not found");
    if (!isPermitted) return res.status(400).send("unauthorized");
    if (!department) return res.status(404).send("department not found");
    const role = await prisma.role.findUnique({
        where: {
            name: 'DepartmentAdmin_' + req.params.id
        }
    });
    await prisma.userRole.upsert({
        where: {
            roleId_userId: {
                roleId: role.id,
                userId: user.id
            }
        },
        update: {},
        create: {
            roleId: role.id,
            userId: user.id
        }
    });
    res.send({message: "new department admin created"});
})

router.post('/:id/add-class', verifyUser, async (req, res) => {
    const isPermitted = await checkPermission(req.user, '15_' + req.params.id);
    if (!isPermitted) return res.status(403).send("not permitted")
    const newClass = await prisma.class.create({
        data: {
            name: req.body.name,
            description: req.body.description,
            departmentId: parseInt(req.params.id),
            code: randomstring.generate(5),
        }
    })
    const updatedClass = await prisma.class.update({
        where: {
            id: newClass.id,
        },
        data: {
            code: newClass.code + newClass.id
        }
    })
    const teacherRole = await prisma.role.upsert({
        where: {
            name: 'Teacher_' + newClass.id,
        },
        update: {},
        create: {
            name: 'Teacher_' + newClass.id,
            classId: newClass.id,
            departmentId: parseInt(req.params.id)
        }
    })
    const studentRole = await prisma.role.upsert({
        where: {
            name: 'Teacher_' + newClass.id,
        },
        update: {},
        create: {
            name: 'Teacher_' + newClass.id,
            classId: newClass.id,
            departmentId: parseInt(req.params.id)
        }
    })
    const departmentAdmin = await prisma.role.findUnique({
        where: {
            name: 'DepartmentAdmin_' + req.params.id
        }
    })

    //Generating permission for student role
    await StudentPermissions.permissions.map(async per => {
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
                roleId: studentRole.id
            }
        })
    });

    //Generating permission for teachers role
    await TeacherPermissions.permissions.map(async per => {
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
    });

    //Generating permission for department admin role
    await DepartmentAdminPermissions.permissions
        .filter(p => p.status === 'class')
        .map(async per => {
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
                    roleId: departmentAdmin.id
                }
            })
        });

    return res.send(updatedClass);
})
module.exports = router;
