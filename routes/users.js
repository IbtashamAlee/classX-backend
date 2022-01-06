var express = require('express');
var router = express.Router();


var { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

router.get('/', async (req, res) => {
  const users = await prisma.user.findMany()
  res.json(users)
})

router.post(`/`, async (req, res) => {
  const result = await prisma.user.create({
    data: { ...req.body },
  })
  res.json(result)
})

router.post(`/post`, async (req, res) => {
  const { title, content, authorEmail } = req.body
  const result = await prisma.post.create({
    data: {
      title,
      content,
      published: false,
      author: { connect: { email: authorEmail } },
    },
  })
  res.json(result)
})


module.exports = router;
