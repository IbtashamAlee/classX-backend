const express = require("express");
const router = express.Router();

const {PrismaClient} = require(".prisma/client");
const safeAwait = require("../services/safe_await");
const {verifyUser} = require("../middlewares/verifyUser");

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
  await safeAwait(prisma.chatParticipants.create({
    data: {
      chatId: chat.id,
      participantId: req.user.id
    }
  }))
  return res.json(chat);
})

//add participants to chat
router.post('/:id/participants', verifyUser, async (req, res) => {
  const [chat, chatErr] = await safeAwait(prisma.chat.findUnique({
    where: {
      id: parseInt(req.params.id)
    }
  }));
  if (chat.createdBy !== req.user.id) return res.status(403).send("unauthorized");
  if (!chat || chatErr) return res.status(409).send("unable to find chat");
  if (!req.body.users) return res.status(409).send("users not provided");
  let participants_err = [];
  let unavailable_users = [];
  let added_participants = [];
  let already_participants = [];
  for await(userMail of req.body.users) {
    const [user, userErr] = await safeAwait(prisma.user.findUnique({
        where: {
          email: userMail
        }
      })
    )
    if (!user) {
      unavailable_users.push(userMail)
      continue;
    }
    if (userErr) {
      participants_err.push(userMail);
      continue;
    }
    const [alreadyParticipant] = await safeAwait(prisma.chatParticipants.findMany({
      where: {
        removedAt: null,
        chatId: parseInt(req.params.id),
        participantId: user.id,
      }
    }))
    if (alreadyParticipant.length > 0) {
      already_participants.push(userMail);
      continue;
    }
    const [addedParticipant] = await safeAwait(prisma.chatParticipants.upsert({
      where: {
        chatId_participantId: {
          chatId: parseInt(req.params.id),
          participantId: user.id,
        }
      },
      create: {
        chatId: parseInt(req.params.id),
        participantId: user.id,
      },
      update: {
        removedAt: null
      }
    }))
    if (addedParticipant) {
      added_participants.push(userMail);
      continue;
    }
    participants_err.push(userMail);
  }
  return res.send({participants_err, unavailable_users, already_participants, added_participants});
})

//add message to chat
router.post('/:id/message', verifyUser, async (req, res) => {
  const [chat, chatErr] = await safeAwait(prisma.chat.findUnique({
    where: {
      id: parseInt(req.params.id)
    }
  }))
  if (!chat || chatErr) return res.status(409).send("chat not found");
  const [chatParticipant, chatParticipantErr] = await safeAwait(prisma.chatParticipants.findMany({
    where: {
      chatId: parseInt(req.params.id),
      participantId: req.user.id,
      removedAt: null
    }
  }))
  console.log(chatParticipantErr)
  if (chatParticipantErr || chatParticipant?.length < 1) return res.status(403).send("unauthorized");
  const [message, messageErr] = await safeAwait(prisma.chatMessage.create({
    data: {
      chatId: parseInt(req.params.id),
      senderId: req.user.id,
      body: req.body.message,
      timeSent: new Date(),
      fileId: req.body.file.id ?? null
    }
  }))
  return res.send(message)
})

//remove a participant
router.put('/:id/participants', verifyUser, async (req, res) => {
  const [chat, chatErr] = await safeAwait(prisma.chat.findUnique({
    where: {
      id: parseInt(req.params.id)
    }
  }));
  if (!chat || chatErr) return res.status(409).send("unable to find chat");
  if (!req.body.users) return res.status(409).send("users not provided");
  if (chat.createdBy !== req.user.id) return res.status(403).send("unauthorized");
  const removed_users = [];
  const unavailable_user = [];
  const error_removing = [];
  const not_participant = [];
  for await(userMail of req.body.users) {
    const [user, userErr] = await safeAwait(prisma.user.findUnique({
      where: {
        email: userMail
      }
    }))
    if (!user || userErr) {
      unavailable_user.push(userMail)
      continue;
    }
    const [isParticipant, participantErr] = await safeAwait(prisma.chatParticipants.findUnique({
      where: {
        chatId_participantId: {
          chatId: parseInt(req.params.id),
          participantId: user.id
        },
      }
    }));
    if (!isParticipant || participantErr || isParticipant.removedAt !== null) {
      not_participant.push(userMail);
      continue;
    }
    const [excludedParticipant] = await safeAwait(prisma.chatParticipants.update({
      where: {
        chatId_participantId: {
          chatId: parseInt(req.params.id),
          participantId: user.id
        }
      },
      data: {
        removedAt: new Date()
      }
    }));
    if (excludedParticipant) {
      removed_users.push(userMail)
      continue;
    }
    error_removing.push(userMail)
  }
  return res.send({not_participant, unavailable_user, removed_users, error_removing})
})


//get all user chats
router.get('/conversations', verifyUser, async (req, res) => {
  let [chat, chatErr] = await safeAwait(prisma.chatParticipants.findMany({
      where:{
        participantId : req.user.id
      },
      include:{
        chat:{
          include:{
            chatParticipants: {
              include : {
                user: {
                  select:{
                    name : true,
                    imageUrl : true
                  }
                }
              }
            },
            chatmessage: {
              orderBy:{
                timeSent : 'desc'
              },
              take: 1
            }
          }

        }
      }
    })
  )
  console.log(chat)
  if (!chat || chatErr) return res.status(409).send("unable to fetch chat");
  chat  = chat.map(p=>{
      return {chatId:p.chat.id,userName:p.chat.chatParticipants.filter(ptc => ptc.participantId !== req.user.id)[0],
      lastMessage:p.chat?.chatmessage[0]?.body}
  })
  return res.send(chat);
})

//get chat
router.get('/:id', verifyUser, async (req, res) => {
  console.log(req.params.id)
  //checking if user is participant of requested chat
  const [isParticipant, participantErr] = await safeAwait(prisma.chatParticipants.findMany({
      where: {
        chatId: parseInt(req.params.id),
        participantId: req.user.id,
        removedAt: null
      }
    }
  ))
  if (isParticipant?.length < 1 || participantErr) return res.status(403).send("unauthorized");
  const [chat, chatErr] = await safeAwait(prisma.chat.findUnique({
    where: {
      id: parseInt(req.params.id)
    },
    include: {
      chatParticipants: {
        where: {
          removedAt: null
        },
        include: {
          user: {
            select: {
              id: true, name: true, email: true, imageUrl: true, userStatus: true
            }
          }
        }
      },
      chatmessage: {
        where: {
          deletedAt: null
        },
        include: {
          user: {
            select: {
              id: true
            }
          }
        }
      }
    }
  }))
  console.log(chatErr)
  if (!chat || chatErr) return res.status(409).send("unable to fetch chat");
  return res.send(chat);
})




module.exports = router;