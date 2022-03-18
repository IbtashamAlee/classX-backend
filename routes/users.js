const express = require("express");
const router = express.Router();
const {verifySystemAdmin} = require("../middlewares/verifySystemAdmin");
const {verifyUser} = require("../middlewares/verifyUser");
const {PrismaClient} = require("@prisma/client");
const prisma = new PrismaClient();
const safeAwait = require('../services/safe_await');

//endpoint to get all users
router.get("/", verifyUser, verifySystemAdmin, async (req, res) => {
    const users = await prisma.user.findMany();
    return res.status(200).json(users);
});

//endpoint to get current user
router.get("/me", verifyUser, async (req, res) => {
    const {id, name, email, userStatus, imageURL} = req.user;
    return res.status(200).json({id, name, email, userStatus, imageURL});
});

// This endpoint returns all the classes of user with his embedded roles.
router.get("/me/getclasses", verifyUser, async (req, res) => {
    const[classes,classesErr]= await safeAwait(prisma.$queryRaw`
    select "Class".name, "Class".description,"Department".name,"Institute".name,"ClassParticipants"."classId",
        (Select "Role".name from "Role" INNER JOIN "UserRole" ON
        "Role".id = "UserRole"."roleId"
        Where "Role"."classId" = "Class".id AND "userId" = ${req.user.id} LIMIT 1)
        as role from "Class"
        INNER JOIN "ClassParticipants" ON "Class".id = "ClassParticipants"."classId" AND "ClassParticipants"."userId"=${req.user.id}
        LEFT JOIN "Department" ON
        "Class"."departmentId" = "Department".id
        LEFT JOIN "Institute" ON
        "Department"."instituteId" = "Institute".id
        ORDER BY "Institute".id
    `)
    if(classesErr) return res.send({message:'Unable to fetch classes',err:classesErr});
    return res.json(classes)
})

router.put("/block/:id", verifyUser, verifySystemAdmin, async (req, res) => {
    try {
        const user = await prisma.user.update({
            where: {
                id: parseInt(req.params.id),
            }, data: {
                deletedAt: new Date(),
            },
        });
        return res.status(200).json(user);
    } catch (e) {
        return res.status(404).send("User not found");
    }
});

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

//endpoint to get a particular user
router.get("/:id", verifyUser, verifySystemAdmin, async (req, res) => {
    const users = await prisma.user.findUnique({
        where: {
            id: parseInt(req.params.id),
        },
    });
    return res.status(200).json(users);
});


module.exports = router;
