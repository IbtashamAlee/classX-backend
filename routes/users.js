const express = require("express");
const router = express.Router();
const { verifySystemAdmin } = require("../middlewares/verifySystemAdmin");
const { verifyUser } = require("../middlewares/verifyUser");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

//endpoint to get all users
router.get("/", verifySystemAdmin, async (req, res) => {
    const users = await prisma.user.findMany();
    res.json(users);
});

//endpoint to get current user
router.get("/me", verifyUser, async (req, res) => {
    const { id, name, email, userStatus, imageURL } = req.user;
    res.json({ id, name, email, userStatus, imageURL });
});

router.put("/block/:id", verifySystemAdmin, async (req, res) => {
    try {
        const user = await prisma.user.update({
            where: {
                id: parseInt(req.params.id),
            },
            data: {
                deletedAt: new Date(),
            },
        });
        return res.json(user);
    } catch (e) {
        return res.status(404).send("User not found");
    }
});

router.put("/unblock/:id", verifySystemAdmin, async (req, res) => {
  try {
      const user = await prisma.user.update({
          where: {
              id: parseInt(req.params.id),
          },
          data: {
              deletedAt: null,
          },
      });
      return res.json(user);
  } catch (e) {
      return res.status(404).send("User not found");
  }
});

//endpoint to get a particular user
router.get("/:id", verifySystemAdmin, async (req, res) => {
    const users = await prisma.user.findUnique({
        where: {
            id: parseInt(req.params.id),
        },
    });
    res.json(users);
});

module.exports = router;
