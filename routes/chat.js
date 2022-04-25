const express = require("express");
const router = express.Router();
const {nanoid} = require("nanoid/async");

const {PrismaClient} = require(".prisma/client");
const safeAwait = require("../services/safe_await");
const {verifyUser} = require("../middlewares/verifyUser");
const {checkPermission} = require("../services/checkPermission");
const StudentPermissions = require("../permissions/student.json");
const TeacherPermissions = require("../permissions/teacher.json");
const {verifySystemAdmin} = require("../middlewares/verifySystemAdmin");

const prisma = new PrismaClient();

//create a new chat
router.post('/', verifyUser, async (req, res) => {
  const [chat, chatErr] = await safeAwait(prisma.chat.create({
    data: {
      createdAt: new Date(),
      createdBy: req.user.id
    }
  }));
  if (!chat) return res.status(409).send("unable to create chat");
  return res.json(chat);
})

//add participants to chat
router.post('/:id/participants', verifyUser, async (req, res) => {
  const [chat, chatErr] = await safeAwait(prisma.chat.findUnique({
    where: {
      id: parseInt(req.params.id)
    }
  }));
  if (!chatErr) return res.status(409).send("unable to find chat");
  if (!req.body.user) return res.status(409).send("users not provided");
  let participants_err = [];
  let unavailable_users = [];
  let added_participants = [];
  let already_participants = [];
  for await(participant of req.body.users) {
    const [user, userErr] = await safeAwait(prisma.user.findUnique({
        where: {
          email: reqUser.email
        }
      })
    )
    if (!user) {
      unavailable_users.push(reqUser)
      continue;
    }
    if (userErr) {
      participants_err.push(reqUser);
      continue;
    }
    const [alreadyParticipant] = await safeAwait(prisma.chatParticipants.findUnique({
      where: {
        chatId_participantId: {
          chatId: parseInt(req.params.id),
          participantId: user.id,
        }
      }
    }))
    if (alreadyParticipant) {
      already_participants.push(participant);
      continue;
    }
    const [addedParticipant] = await safeAwait(prisma.chatParticipants.create({
      data: {
        chatId: parseInt(req.params.id),
        participantId: user.id
      }
    }))
    if (addedParticipant) {
      added_participants.push(participant);
      continue;
    }
    participants_err.push(participant);
  }
  return res.send({participants_err, unavailable_users, already_participants, added_participants});
})

//add message to chat
router.post(':id/message', verifyUser , async(req,res)=>{
  const [chat,chatErr] = await safeAwait(prisma.chat.findUnique({
    where:{
      id : parseInt(req.params.id)
    }
  }))
  if(!chat || chatErr) return res.status(409).send("chat not found");
  const [chatParticipant,chatParticipantErr] = await safeAwait(prisma.chatParticipants.findUnique({
    where:{
      chatId_participantId:{
        chatId : parseInt(req.params.id),
        participantId : req.user.id
      },
      removedAt : null
    }
  }))
  if(!chatParticipant || chatParticipantErr) return res.status(403).send("unauthorized");
  const [message,messageErr] = await safeAwait(prisma.chatMessage.create({
    data:{
      chatId : parseInt(req.params.id),
      senderId : req.user.id,
      body : req.body.message,
      timeSent : new Date(),
      fileId : req.body.file.id
    }
  }))
})

//remove a participant
router.put('/:id/participants', verifyUser, async(req, res)=>{
  const [chat, chatErr] = await safeAwait(prisma.chat.findUnique({
    where: {
      id: parseInt(req.params.id)
    }
  }));
  const removed_users = [];
  const error_removing = [];
  if (!chatErr) return res.status(409).send("unable to find chat");
  if (!req.body.user) return res.status(409).send("users not provided");
  for await(user of req.body.users){
    const [excludedParticipant] = await safeAwait([prisma.chatParticipants.update({
      where:{
        chatId_participantId :{
          chatId : parseInt(req.params.id),
          participantId : user.id
        }
      }
    })]);
    if(excludedParticipant){
      removed_users.push(user)
      continue;
    }
    error_removing.push(user)
  }
  return res.send({removed_users,error_removing})
})

//get chat
router.get('/:id', verifyUser, async(req,res)=>{
  const [chat,chatErr] = await safeAwait(prisma.chat.findUnique({
    where:{
      id : parseInt(req.params.id)
    },
    include:{
      chatParticipants : {
        include : {
          user : true
        }
      },
      chatmessage: {
        include:{
          user : true
        }
      }
    }
  }))
  if(!chat || chatErr) return res.status(409).send("unable to fetch chat");
  return res.send(chat);
})

module.exports = router;