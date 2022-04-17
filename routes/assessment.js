const express = require("express");
const router = express.Router();
const {verifySystemAdmin} = require("../middlewares/verifySystemAdmin");
const {verifyUser} = require("../middlewares/verifyUser");
const {PrismaClient} = require("@prisma/client");
const prisma = new PrismaClient();
const safeAwait = require('../services/safe_await');

//get public users
router.get("/", verifyUser, async (req, res) => {
  const [assessments,assessmentsErr] = await safeAwait(prisma.assessment.findMany({
    where:{
      createdBy : req.user.id
    },
    include: {
      question: {
        include: {
          questionAttachment: {
            include:{
              file : true
            }
          },
          option: true
        }
      }
    }
  }))
  if(assessmentsErr) return res.status(409).send("unable to fetch assessments");
  return res.send(assessments);
});

router.post("/", verifyUser, async (req, res) => {
  if(!req.body.name) return res.status(409).send("Name not provided");
  if (req.body.questions.length < 1) return res.status(409).send("Can't create an empty assessment");
  const [assessment, assessmentErr] = await safeAwait(prisma.assessment.create({
    data: {
      name: req.body.name,
      body: req.body.body ?? " ",
      isPublic: req.body.isPublic ?? false,
      createdBy: req.user.id,
      createdAt: new Date()
    },
    include: {
      question: {
        include: {
          questionAttachment: true,
          option: true
        }
      }
    }
  }));
  console.log(assessmentErr)
  if (!assessment || assessmentErr) return res.status(409).send("unable to add assessment");
  for await (question of req.body.questions) {
    const [newQuestion] = await safeAwait(prisma.question.create({
      data: {
        statment: question.statment,
        questionScore: question.score,
        duration: question.duration,
        assessmentId: assessment.id
      }
    }))
    if (newQuestion) {
      if (question?.files?.length > 0) {
        for await(file of question.files) {
          await prisma.questionAttachment.create({
            data: {
              questionId: newQuestion.id,
              fileId: file.id
            }
          })
        }
      }
      for await(option of question.options) {
        await prisma.option.create({
          data: {
            questionId: newQuestion.id,
            value: option.value,
            isCorrect: option.isCorrect
          }
        })
      }
    }
  }
  return res.send({
    message: "The following assessment is saved successfully",
    assessment: await prisma.assessment.findUnique({
      where: {
        id: assessment.id
      },
      include: {
        question: {
          include: {
            questionAttachment: {
              include:{
                file : true
              }
            },
            option: true
          }
        }
      }
    })
  })
})
module.exports = router;
