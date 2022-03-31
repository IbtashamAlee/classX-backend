const express = require("express");
const router = express.Router();
const {PrismaClient} = require(".prisma/client");
const prisma = new PrismaClient();
const {verifyUser} = require('../middlewares/verifyUser');
const {verifySystemAdmin} = require('../middlewares/verifySystemAdmin');
const {checkPermission} = require('../services/checkPermission');
const randomstring = require("randomstring");
const StudentPermissions = require('../permissions/student.json');
const TeacherPermissions = require('../permissions/teacher.json');
const DepartmentAdminPermissions = require('../permissions/departmentAdmin.json');
const safeAwait = require('../services/safe_await');
const {nanoid} = require('nanoid/async');

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
  console.log(req.user, '07_' + req.params.id)
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
  if (!req.body.name) return res.status(409).send('class name not provided')
  const className = req.body.name.trim();
  const [existingClass, ERR] = await safeAwait(prisma.class.findUnique({
    where: {
      name_departmentId: {
        name: className,
        departmentId: parseInt(req.params.id)
      },
    }
  }))
  if (existingClass && existingClass.departmentId === parseInt(req.params.id))
    return res.status(409).send("a class with same name already exists in this department");
  const isPermitted = await checkPermission(req.user, '15_' + req.params.id);
  if (!isPermitted) return res.status(403).send("not authorized");

  const [newClass, newClassErr] = await safeAwait(prisma.class.create({
    data: {
      name: className,
      description: req.body.description || '',
      departmentId: parseInt(req.params.id),
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
      departmentId: parseInt(req.params.id)
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
      departmentId: parseInt(req.params.id)
    }
  }))
  if (!studentRole || studentRoleErr) return res.status(409).send("unable to generate student's role");


  const [departmentAdmin, departmentAdminErr] = await safeAwait(prisma.role.findUnique({
    where: {
      name: 'DepartmentAdmin_' + req.params.id
    }
  }))
  if (!departmentAdmin || departmentAdminErr) return res.status(409).send("unable to find department admin's role")

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
    await prisma.rolePermission.create({
      data: {
        permissionId: permission.id,
        roleId: studentRole.id
      }
    })
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

  //Generating permission for department admin role
  for await(const per of DepartmentAdminPermissions.permissions) {
    if (per.status === 'class') {
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
    }
  }

  return res.json({message: "explicit permissions generated", newClass});
})
module.exports = router;
