const express = require("express");
const router = express.Router();
const {verifyUser} = require("../middlewares/verifyUser");
const {PrismaClient} = require("@prisma/client");
const prisma = new PrismaClient();
const safeAwait = require('../services/safe_await');
const {array} = require("joi");

//get all assessments from user's library
router.get("/", verifyUser, async (req, res) => {
  const [assessments, assessmentsErr] = await safeAwait(prisma.assessment.findMany({
    where: {
      createdBy: req.user.id,
      deletedAt: null
    },
    include: {
      question: {
        where: {
          deletedAt: null
        },
        include: {
          questionAttachment: {
            where:{
              deletedAt : null
            },
            include: {
              file: true,
            }
          },
          option: {
            where: {
              deletedAt: null
            }
          }
        }
      }
    }
  }))
  if (assessmentsErr) return res.status(409).send("unable to fetch assessments");
  return res.send(assessments);
});

//get all public assessments
router.get("/public", verifyUser, async (req, res) => {
  const [assessments, assessmentsErr] = await safeAwait(prisma.assessment.findMany({
    where: {
      isPublic: true,
      deletedAt: null
    },
    include: {
      question: {
        where: {
          deletedAt: null
        },
        include: {
          questionAttachment: {
            where:{
              deletedAt : null
            },
            include: {
              file: true
            }
          },
          option: {
            where: {
              deletedAt: null
            }
          }
        }
      }
    }
  }))
  if (assessmentsErr) return res.status(409).send("unable to fetch assessments");
  return res.send(assessments);
});

//delete an assessment
router.put('/:id', verifyUser, async (req, res) => {
  const [assessment, assessmentErr] = await safeAwait(prisma.assessment.findUnique({
      where: {
        id: parseInt(req.params.id),
      }
    })
  );
  if (!assessment || assessmentErr) return res.status(409).send("unable to fetch assessment");
  if (assessment.createdBy !== req.user.id) return res.status(403).send("unauthorized");
  const [updatedAssessment, updatedAssessmentErr] = await safeAwait(prisma.assessment.update({
      where: {
        id: parseInt(req.params.id),
      },
      data: {
        deletedAt: new Date()
      }
    })
  );
  if (updatedAssessment) return res.send("assessment deleted successfully");
  return res.send("unable to delete assessment");
})

//get specific assessment from user's library
router.get("/:id", verifyUser, async (req, res) => {
  const [assessments, assessmentsErr] = await safeAwait(prisma.assessment.findMany({
    where: {
      createdBy: req.user.id,
      id: parseInt(req.params.id),
      deletedAt: null
    },
    include: {
      question: {
        where: {
          deletedAt: null
        },
        include: {
          questionAttachment: {
            where:{
              deletedAt : null
            },
            include: {
              file: true
            }
          },
          option: {
            where: {
              deletedAt: null
            }
          }
        }
      }
    }
  }))
  if (assessmentsErr) return res.status(409).send("unable to fetch assessments");
  return res.send(assessments);
});

//create new assessment
router.post("/", verifyUser, async (req, res) => {
  if (!req.body.name) return res.status(409).send("Name not provided");
  const [assessment, assessmentErr] = await safeAwait(prisma.assessment.create({
    data: {
      name: req.body.name,
      body: req.body.body ?? " ",
      isPublic: req.body.isPublic ?? false,
      createdBy: req.user.id,
      createdAt: new Date()
    }
  }));
  if (!assessment || assessmentErr) return res.status(409).send("unable to add assessment");
  return res.send({message: "The Assessment is saved successfully", assessment});
})

//QUESTIONS
//add a question in assessment
//new question
router.post('/:id/question', async (req, res) => {
  const addedQuestions = []
  const failedQuestions = []
  for await (question of req.body.questions) {
    const [newQuestion, newQuestionErr] = await safeAwait(prisma.question.create({
      data: {
        statement: question.statement,
        assessmentId: parseInt(req.params.id),
        questionScore: question.score,
        duration: question.duration,
      },
      include: {
        option: true
      }
    }))
    if (!newQuestion || newQuestionErr) {
      failedQuestions.push(question)
    }
    if (newQuestion) {
      addedQuestions.push(newQuestion)
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
      if(question.options.length > 0) {
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
  }
  return res.send({addedQuestions, failedQuestions});
})

//update question
router.put('/:id/question/:questionId', async (req, res) => {
  const [question, questionErr] = await safeAwait(prisma.question.findUnique({
    where: {
      id: parseInt(req.params.questionId)
    }
  }))
  if (!question || questionErr) return res.status(404).send("unable to find question");
  const [newQuestion, newQuestionErr] = await safeAwait(prisma.question.create({
    data: {
      statement: req.body.question.statement,
      assessmentId: parseInt(req.params.id),
      questionScore: req.body.question.score,
      duration: req.body.question.duration,
    }
  }))
  console.log(newQuestionErr)
  if (!newQuestion || newQuestionErr) return res.status(409).send("unable to update question");
  if (req.body.question?.files?.length > 0) {
    for await(file of req.body.question.files) {
      await prisma.questionAttachment.create({
        data: {
          questionId: newQuestion.id,
          fileId: file.id
        }
      })
    }
  }
  if(req.body.question.options.length > 0 ) {
    for await(option of req.body.question.options) {
      await prisma.option.create({
        data: {
          questionId: newQuestion.id,
          value: option.value,
          isCorrect: option.isCorrect
        }
      })
    }
  }
  await safeAwait(prisma.question.update({
    where: {
      id: question.id
    },
    data: {
      deletedAt: new Date()
    }
  }))
  return res.send(newQuestion)
})

//remove a question from assessment
router.put('/:id/question/:questionId/remove', async (req, res) => {
  const [assessment, assessmentErr] = await safeAwait(prisma.assessment.findMany({
    where: {
      id: parseInt(req.params.id),
      deletedAt: null
    }
  }))
  if (assessment.length < 1 || assessmentErr) return res.status(404).send('assessment not found');
  const [question, questionErr] = await safeAwait(prisma.question.findMany({
    where: {
      id: parseInt(req.params.questionId),
      deletedAt: null
    }
  }))
  if (question.length < 1 || questionErr) return res.status(404).send("question not found")
  const [updatedQuestion, updatedQuestionErr] = await safeAwait(prisma.question.update({
    where: {
      id: parseInt(req.params.questionId)
    },
    data: {
      deletedAt: new Date()
    }
  }))
  if (!updatedQuestion || updatedQuestionErr) return res.status(409).send("unable to delete question")
  return res.send("question deleted successfully");
})

//add options to question [array of objects]
router.post('/:id/question/:questionId/options', async (req, res) => {
  const addedOptions = []
  const failedOptions = []
  for await(option of req.body.options) {
    const [newOption, newOptionErr] = await safeAwait(prisma.option.create({
      data: {
        questionId: parseInt(req.params.questionId),
        value: option.value,
        isCorrect: option.isCorrect
      }
    }))
    if (!newOption || newOptionErr) failedOptions.push(option)
    addedOptions.push(newOption)
  }
  return res.send({addedOptions, failedOptions})
})

//remove option from question
router.put('/:id/question/:questionId/option/:optionId', async (req, res) => {
  const [deletedOption, deletedOptionErr] = await safeAwait(prisma.option.update({
    where: {
      id: parseInt(req.params.optionId)
    },
    data: {
      deletedAt: new Date()
    }
  }))
  if (!deletedOption || deletedOptionErr) return res.status(409).send("unable to delete assessment");
  return res.send("option deleted successfully")
})

//Attachments
//remove attachments from question
router.put('/:id/question/:questionId/attachment/:attachmentId', async (req, res) => {
  const [deletedAttachment, deletedAttachmentErr] = await safeAwait(prisma.questionAttachment.update({
    where: {
      id: parseInt(req.params.attachmentId)
    },
    data: {
      deletedAt: new Date()
    }
  }))
  if (!deletedAttachment || deletedAttachmentErr) return res.status(409).send("unable to remove attachment");
  return res.send("assessment removed successfully");
})

module.exports = router;
