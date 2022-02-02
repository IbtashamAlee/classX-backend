const express = require('express');
const router = express.Router();
const {verifySystemAdmin} = require('../middlewares/verifySystemAdmin');
const{ PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

router.get('/',verifySystemAdmin, async (req, res) => {
  const users = await prisma.user.findMany()
  res.json(users)
})


module.exports = router;
