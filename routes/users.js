const express = require('express');
const router = express.Router();
const {verifySystemAdmin} = require('../middlewares/verifySystemAdmin');
const {verifyUser} = require('../middlewares/verifyUser');
const{ PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

router.get('/',verifySystemAdmin, async (req, res) => {
  const users = await prisma.user.findMany()
  res.json(users)
})

//write a endpoint to get current user
router.get('/me',verifyUser, async (req, res) => {

  res.send(req.user)
})

module.exports = router;
