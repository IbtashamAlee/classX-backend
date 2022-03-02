const express = require("express");
const router = express.Router();
const {PrismaClient} = require(".prisma/client");
const prisma = new PrismaClient();
const {verifyUser} = require('../middlewares/verifyUser');
const {verifySystemAdmin} = require('../middlewares/verifySystemAdmin');
const {verifyInstituteAdmin} = require('../middlewares/verifyInstituteAdmin')
const InstituteAdminPermissions = require('../permissions/instituteAdmin.json');
const DepartmentAdminPermissions = require('../permissions/departmentAdmin.json');

const {checkPermission} = require('../functions/checkPermission');

router.get('/', verifyUser, verifySystemAdmin, async (req, res) => {
    const institutes = await prisma.institute.findMany();
    return res.status(200).json(institutes);
})

router.get('/requests', verifyUser, verifySystemAdmin, async (req, res) => {
    const requests = await prisma.instituteRequest.findMany();
    return res.status(200).json(requests);
})

router.post('/request', verifyUser, async (req, res) => {
    const request = await prisma.instituteRequest.create({
        data: {
            name: req.body.name,
            instituteType: req.body.instituteType,
            adminId: req.user.id
        }
    })
    return res.json(request);
})

router.put('/request/process/:id', verifyUser, verifySystemAdmin, async (req, res) => {
    if (!req.query.method || (req.query.method !== 'accept' && req.query.method !== 'reject'))
        return res.status(403).send("invalid request");
    const result = await prisma.instituteRequest.findUnique({
        where: {
            id: parseInt(req.params.id)
        }
    });
    if(!result) return res.status(404).send("Institute Request not found")
    if (result.acceptedAt !== null || result.rejectedAt !== null) return res.send("request already processed");
    const request = await prisma.instituteRequest.update({
        where: {
            id: parseInt(req.params.id)
        },
        data: {
            acceptedAt: req.query.method === 'accept' ? new Date() : null,
            rejectedAt: req.query.method === 'reject' ? new Date() : null
        }
    })
    if (req.query.method === 'accept')
        var institute = await createInstitute(result)
    return institute ? res.json({
        request,
        institute,
        message: "institute and explicit permissions created"
    }) : res.json(request)
})

router.put('/delete/:id', verifyUser, verifySystemAdmin, async (req, res) => {
    const institute = await prisma.institute.update({
        where: {
            id: parseInt(req.params.id)
        },
        data: {
            deletedAt: new Date()
        }
    })
    res.send(institute);
})

router.put('/restore/:id', verifyUser, verifySystemAdmin, async (req, res) => {
    const institute = await prisma.institute.update({
        where: {
            id: parseInt(req.params.id)
        },
        data: {
            deletedAt: null
        }
    })
    res.send(institute);
})

router.post('/:id/add-department', verifyUser, async (req, res) => {
    console.log(req.body.name, req.params.id)
    const isPermitted = await checkPermission(req.user, '14_' + req.params.id);
    const institute = await prisma.institute.findUnique({
        where : {
            id : parseInt(req.params.id)
        }
    })
    const exisitingDepartment = await prisma.department.findUnique({
        where :{
            name: req.body.name+'_'+req.params.id,
        }
    })
    if(exisitingDepartment) return res.status(409).send("Department already Exists")
    if(!institute) return res.status(404).send("Institute not found");
    if (!isPermitted) return res.status(401).send("not permitted to perform this task");
    const departmentAdmin = await prisma.user.findUnique({
        where: {
            email: req.body.adminId,
        }
    })
    if (!departmentAdmin) return res.status(404).send("Proposed Admin user not found");
    const department = await prisma.department.create({
        data: {
            name: req.body.name+'_'+req.params.id,
            instituteId: parseInt(req.params.id),
            adminId: departmentAdmin.id
        },
    });
    const role = await prisma.role.create({
        data:{
            name : 'DepartmentAdmin_' + department.id,
            instituteId : parseInt(req.params.id),
            departmentId : department.id
        }
    });
    DepartmentAdminPermissions.permissions
        .filter(p => p.status === 'general')
        .map(async per => {
        const permission = await prisma.permission.upsert({
            where: {
                code: per.code + '_' + department.id
            },
            update: {},
            create: {
                name: per.name + '_' + department.id,
                code: per.code + '_' + department.id,
            },
        })
        await prisma.rolePermission.create({
            data: {
                permissionId: permission.id,
                roleId: role.id
            }
        })
    });
    await prisma.userRole.create({
        data: {
            userId: departmentAdmin.id,
            roleId: role.id
        }
    })
    return res.send(department)
})

/*This function created an institute after accepting request
* It adds a role and exlplicit permissions to database
* The admin user is assigned the newly created role
*/
async function createInstitute(request) {
    const institute = await prisma.institute.create({
        data: {
            name: request.name,
            adminId: request.adminId,
            instituteType: request.instituteType,
        }
    });
    const role = await prisma.role.create({
        data: {
            name: 'InstituteAdmin_' + institute.id,
            instituteId: institute.id,
        }
    })
    InstituteAdminPermissions.permissions.map(async per => {
        const permission = await prisma.permission.upsert({
            where: {
                code: per.code + '_' + institute.id
            },
            update: {},
            create: {
                name: per.name + '_' + institute.id,
                code: per.code + '_' + institute.id,
            },
        })
        await prisma.rolePermission.create({
            data: {
                permissionId: permission.id,
                roleId: role.id
            }
        })
    });
    await prisma.userRole.create({
        data: {
            userId: request.adminId,
            roleId: role.id
        }
    })
    return institute;
}

module.exports = router;