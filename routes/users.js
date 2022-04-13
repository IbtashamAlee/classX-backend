const express = require("express");
const router = express.Router();
const {verifySystemAdmin} = require("../middlewares/verifySystemAdmin");
const {verifyUser} = require("../middlewares/verifyUser");
const {PrismaClient} = require("@prisma/client");
const prisma = new PrismaClient();
const safeAwait = require('../services/safe_await');

//get public users
router.get("/public", verifyUser, async (req, res) => {
  const [users,usersErr] = await safeAwait(prisma.user.findMany({
    select: {
      id: true, name: true, userStatus: true, imageURL: true, email: true
    },
  }))
  if(usersErr) return res.status(409).send("unable to fetch users");
  return res.json(users);
});

//get a particular public user
router.get("/public/:id", verifyUser, async (req, res) => {
  const [user, userErr] = await safeAwait(prisma.user.findUnique({
    where: {
      id: parseInt(req.params.id)
    },
    select: {
      id: true, name: true, userStatus: true, imageURL: true, email: true
    },
  }));
  if(userErr) return res.status(409).send("unable to fetch user");
  return res.json(user);
});

//get all users (System Admin)
router.get("/", verifyUser, verifySystemAdmin, async (req, res) => {
  const [users, userErr] = await safeAwait(prisma.user.findMany());
  if (userErr) return res.status(409).send("unable to fetch users");
  return res.status(200).json(users);
});

//get a particular user (System Admin)
router.get("/:id", verifyUser, verifySystemAdmin, async (req, res) => {
  const [user,userErr] = await safeAwait(prisma.user.findUnique({
    where: {
      id: parseInt(req.params.id),
    },
  }));
  if(userErr) return res.status(409).send("unable to fetch user")
  return res.status(200).json(user);
});

//get current user
router.get("/me", verifyUser, async (req, res) => {
  const {id, name, email, userStatus, imageURL} = req.user;
  return res.status(200).json({id, name, email, userStatus, imageURL});
});

//return all the classes of user with his embedded roles.
router.get("/me/classes", verifyUser, async (req, res) => {
  const [classes, classesErr] = await safeAwait(prisma.$queryRaw`
      Select "Class".name        as           class,
             "Class".description as           description,
             "Department".name   as           department,
             "Institute".name    as           institute,
             "ClassParticipants"."classId",
             (Select "Role".name
              from "Role"
                       INNER JOIN "UserRole" ON "Role".id = "UserRole"."roleId"
              Where "Role"."classId" = "Class".id
                AND "userId" = ${req.user.id} LIMIT 1 )
        as role
      from "Class"
          INNER JOIN "ClassParticipants"
      ON "Class".id = "ClassParticipants"."classId" AND "ClassParticipants"."userId"=${req.user.id}
          LEFT JOIN "Department" ON
          "Class"."departmentId" = "Department".id
          LEFT JOIN "Institute" ON
          "Department"."instituteId" = "Institute".id
      ORDER BY "Institute".id
  `)
  if (classesErr) return res.send({message: 'Unable to fetch classes', err: classesErr});
  return res.json(classes)
})

//get current user roles
router.get("/me/roles", verifyUser, async (req, res) => {
  let role_arr = []
  let [roles, roleErr] = await safeAwait(prisma.role.findMany({
    include: {
      userRole: {
        where: {
          userId: req.user.id
        }
      }
    }
  }));
  if (!roles) return res.status(404).send("no current roles for this user");
  if (roleErr) return res.status(409).send("unable to fetch roles");
  roles
    .filter((r) => r.userRole.length > 0)
    .map(r => {
      const name = r.name.split('_')[0];
      if (!role_arr.includes(name))
        role_arr.push(name)
    })
  return res.send(role_arr);
});

//get all classes for certain department admin
router.get('/me/get-department-classes', verifyUser, async (req, res) => {
  const [classes, classesErr] = await safeAwait(prisma.department.findMany({
    where: {
      adminId: req.user.id
    },
    include: {
      class: true
    },
  }))
  if (classesErr) return res.status(409).send("Unable to get classes");
  return res.send(classes);
})

//get classes for institute Admin
router.get('/me/get-institute-classes', verifyUser, async (req, res) => {
  const [classes, classesErr] = await safeAwait(prisma.institute.findMany({
    where: {
      adminId: req.user.id
    },
    include: {
      departments: {
        include: {
          class: true
        }
      }
    }
  }))
  if (classesErr) return res.send(409).send("unable to fetch classes");
  return res.send(classes);
})

//block a user
router.put("/block/:id", verifyUser, verifySystemAdmin, async (req, res) => {
  if (parseInt(req.params.id) === req.user.id) return res.status(403).send("can't block yourself");
  const [user, userErr] = await safeAwait(prisma.user.findUnique({
    where: {
      id: parseInt(req.params.id),
    },
    include: {
      userRole: {
        include: {
          role: {
            include: {
              rolePermission: true
            }
          }
        }
      }
    }
  }))
  if (userErr) return res.status(409).send("unable to fetch user");
  if (!user) return res.status(404).send("user not found");
  const [Adminrole, AdminroleErr] = await safeAwait(prisma.role.findUnique({
    where: {
      name: "SystemAdmin",
    }
  }));
  if (!AdminroleErr && Adminrole) {
    const hasAdminRole = user.userRole.filter(t => {
      return t.roleId === Adminrole.id
    })
    if (hasAdminRole.length > 0)
      return res.status(403).send("User is System Admin.Not permitted to block this User.");
  }
  const [updatedUser, updateErr] = await safeAwait(prisma.user.update({
    where: {
      id: user.id
    },
    data: {
      deletedAt: new Date()
    }
  }))
  if (updateErr) return res.send(409).send("unable to block user's access");
  return res.send(updatedUser);
});

//unblock a user
router.put("/unblock/:id", verifyUser, verifySystemAdmin, async (req, res) => {
  try {
    const user = await prisma.user.update({
      where: {
        id: parseInt(req.params.id),
      }, data: {
        deletedAt: null,
      },
    });
    return res.json(user);
  } catch (e) {
    return res.status(404).send("User not found");
  }
});


module.exports = router;
